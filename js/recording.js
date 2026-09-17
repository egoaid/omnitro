// ─── RECORDING v3: Single-path AudioWorklet capture, Mix Studio ───────────────
//
// Architecture (replaces the former 4x-independent-MediaRecorder design):
//   omni tap (_instBus) ──┐
//   drum tap (_drumBus) ──┤
//   vocal tap (mic, always-present _vocalCaptureBus) ──┤
//   mix tap (_recMasterOut) ──┘
//                             │ each mono→stereo duplicated via ChannelMergerNode
//                             │ (never relies on browser auto-upmix — this also
//                             │  fixes the Safari/iOS mono-vocal-left-channel bug)
//                             ▼
//                    8ch ChannelMergerNode → single AudioWorkletNode
//                             │
//              every render-quantum block (128 samples) carries all 8
//              channels together — sync between stems is structural,
//              not empirically close. Verified in a standalone prototype
//              (recording-prototype-v1.html) under simulated main-thread
//              congestion: sample counts matched exactly across all 8
//              channels, drift between OMNI/DRUM ticks stayed <1ms across
//              the whole recording, and vocal was captured true-stereo.
//
// On stop: chunks are concatenated per channel and wrapped directly into
// AudioBuffers (createBuffer + copyToChannel) — no MediaRecorder, no Opus/
// WebM encode/decode round-trip at all, so no codec artifacts and no need
// for the old "primer tone" silence-trimming workaround.
//
// Mix Studio, WAV export, and all offline rendering below are UNCHANGED —
// they only ever consumed recState.instBuf/omniBuf/drumBuf/micBuf as plain
// AudioBuffers, which this new capture path still produces.

// ── DEBUG: バッファの状態を可視化するための計測ヘルパー ─────────────────────────
// MIX STUDIOで再生を繰り返すと左チャンネルが徐々に劣化する不具合の調査用に追加。
// 原因は studioDrawWaveform() が再生アニメーションのたびにバッファ実データを
// 読み直していたことと特定・修正済み（詳細は REFACTOR_NOTES.md 参照）。
//
// コードは今後の再調査に備えて残してあるが、通常利用時にコンソールを
// 埋め尽くさないよう、デフォルトでは無効化してある。再度調査が必要になったら
// 下の REC_DEBUG_ENABLED を true にすればすぐ復活する。
const REC_DEBUG_ENABLED = false;
let _debugBufIdSeq = 0;
function _debugBufferStats(label, buf) {
  if (!REC_DEBUG_ENABLED) return;
  if (!buf) { console.log('[REC-DEBUG]', label, '- buffer is null/undefined'); return; }
  if (!buf._debugId) buf._debugId = ++_debugBufIdSeq;
  const parts = [];
  for (let c = 0; c < buf.numberOfChannels; c++) {
    const data = buf.getChannelData(c);
    const stride = Math.max(1, Math.floor(data.length / 20000)); // 最大2万点サンプリング
    let peak = 0, sumSq = 0, n = 0;
    for (let i = 0; i < data.length; i += stride) {
      const a = Math.abs(data[i]);
      if (a > peak) peak = a;
      sumSq += data[i] * data[i];
      n++;
    }
    const rms = Math.sqrt(sumSq / Math.max(1, n));
    parts.push(`ch${c}: peak=${peak.toFixed(4)} rms=${rms.toFixed(4)}`);
  }
  console.log(`[REC-DEBUG] ${label} | id=${buf._debugId} len=${buf.length} ch=${buf.numberOfChannels} | ${parts.join('  |  ')}`);
}

// ── Recording state ──────────────────────────────────────────────────────────
const recState = {
  instBuf:      null,   // AudioBuffer = mix tap (_recMasterOut), mix.wav用
  omniBuf:      null,   // AudioBuffer = omni tap (_instBus, コンプ前), omni.wav用
  drumBuf:      null,   // AudioBuffer = drum tap (_drumBus), drum.wav用
  micBuf:       null,   // AudioBuffer = vocal tap (mic, 明示的ステレオ複製済み), mic.wav用

  _chunks:      Array.from({length: 8}, () => []), // per-channel Float32Array[] while recording

  // mic input nodes (live, persistent while mic is connected)
  micStream:    null,   // MediaStream from getUserMedia
  micSource:    null,   // MediaStreamAudioSourceNode
  micGain:      null,   // GainNode (level control + monitor path)
  micMonNode:   null,   // GainNode connecting mic to speakers (monitor)

  active:       false,
  elapsed:      0,
  timer:        null,

  micEnabled:   false,
  micMonitor:   false,
  micLevel:     1.0,
};

// ── Mix Studio state ─────────────────────────────────────────────────────────
const studioState = {
  open:         false,
  playing:      false,

  // playback graph nodes (created fresh, destroyed on close)
  ctx:          null,
  instSrc:      null,
  micSrc:       null,
  // per-channel processing nodes
  instChain:    null,  // { gain, hpf, lpf, comp, rvbGraph }
  vocalChain:   null,  // { gain, hpf, lpf, comp, rvbGraph }
  playBus:      null,
  busNodes:     null,  // バス共有エフェクト (wow/flutter + busRvb + airLPF)
  masterLim:    null,
  playOut:      null,

  // Vocal Dynamics
  micGainDb:    0,     // Mic gain boost/cut in dB (-12 to +24)
  ottAmt:       0,     // OTT multiband dynamics strength (0-100)
  deEssAmt:     0,     // 6-8kHz de-esser amount (0-100)

  // Mix bus
  glueAmt:      0,     // Glue bus compressor amount (0-100)
  busRvb:       0,     // Bus reverb wet (0-100)
  rvbSize:      45,    // Bus reverb room size (0-100)
  limitDb:      -1,

  playStartCtxTime:   0,
  playStartBufOffset: 0,
  animFrame:    null,
  canvasCtx:    null,
};

// ── Utility ───────────────────────────────────────────────────────────────────
function recFmt(s) {
  return String(Math.floor(s/60)).padStart(2,'0') + ':' + String(s%60).padStart(2,'0');
}

function recSetUI(on) {
  document.getElementById('rec-btn').textContent = on ? 'STOP' : 'REC';
  document.getElementById('rec-btn').classList.toggle('on', on);
  document.getElementById('rec-led').classList.toggle('on', on);
  document.getElementById('rec-timer').classList.toggle('on', on);
  if (!on) document.getElementById('rec-timer').textContent = '00:00';
}

function recFmtMB(buf) {
  if (!buf) return '';
  const mb = (buf.length * buf.numberOfChannels * 4 / 1048576).toFixed(1);
  return mb + ' MB';
}

// ── Mic setup / teardown ─────────────────────────────────────────────────────
async function micConnect() {
  if (recState.micSource) return; // already connected
  try {
    recState.micStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation:  false,
        autoGainControl:   false,
        noiseSuppression:  false,
        sampleRate:        48000,
      },
      video: false,
    });
  } catch(e) {
    console.warn('[MIC] getUserMedia failed:', e.message);
    const tog = document.getElementById('tog-mic-record');
    if (tog) tog.classList.remove('on');
    recState.micEnabled = false;
    alert('Microphone access denied. Please allow mic access and try again.');
    return;
  }
  await ensureAudio();
  const rawCtx = Tone.getContext().rawContext;
  recState.micSource = rawCtx.createMediaStreamSource(recState.micStream);

  // MIC LEVEL スライダー（デフォルト1.0 = 素通し）
  recState.micGain = rawCtx.createGain();
  recState.micGain.gain.value = recState.micLevel;

  // モニター用 GainNode（monitor off 時は gain=0）
  recState.micMonNode = rawCtx.createGain();
  recState.micMonNode.gain.value = recState.micMonitor ? 1.0 : 0.0;

  // チェーン: micSource → micGain → micMonNode → destination (monitor only)
  // 録音タップは micGain から window._vocalCaptureBus へ並列に fan-out する
  // （既存のモニター経路は一切変更しない、追加接続のみ）
  recState.micSource.connect(recState.micGain);
  recState.micGain.connect(recState.micMonNode);
  recState.micMonNode.connect(rawCtx.destination);
  if (window._vocalCaptureBus) {
    try { recState.micGain.connect(window._vocalCaptureBus); } catch(e){}
  }
  document.getElementById('mic-led').classList.add('on');
}

function micDisconnect() {
  if (recState.micSource) {
    try { recState.micSource.disconnect(); } catch(e){}
    recState.micSource = null;
  }
  if (recState.micGain) {
    try { recState.micGain.disconnect(); } catch(e){}
    recState.micGain = null;
  }
  if (recState.micMonNode) {
    try { recState.micMonNode.disconnect(); } catch(e){}
    recState.micMonNode = null;
  }
  if (recState.micStream) {
    recState.micStream.getTracks().forEach(t => t.stop());
    recState.micStream = null;
  }
  document.getElementById('mic-led').classList.remove('on');
}

// ── Single-path capture graph: AudioWorklet, 8ch (omni/drum/vocal/mix L/R) ────
// See header comment above for the full rationale. This function is called
// once, at the end of ensureAudio(). It is purely additive to the existing
// live signal path — no existing connection is disturbed, only parallel
// fan-out taps are added (same pattern the app already used for the old
// MediaRecorder taps: instBus/drumBus → tap(gain=1.0) → recorder).
//
// The processor is loaded from a real companion file, `omnitro-capture-
// worklet.js`, served alongside this HTML — NOT from a Blob URL. Safari has
// an unreliable implementation of audioWorklet.addModule() with blob: URLs
// that can throw a bare "SyntaxError" even for syntactically valid module
// code; loading a real same-origin .js file sidesteps this entirely and is
// the standard cross-browser-compatible approach.
const REC_WORKLET_URL = 'omnitro-capture-worklet.js';

let captureWorklet = null;
let captureReady   = false;
let captureInitPromise = null; // guards against concurrent recCaptureInit() calls
let captureInitError   = null; // human-readable reason for the last failed init attempt

// NOTE: this function is called from two places that can race each other —
// ensureAudio()'s fire-and-forget call, and recStart()'s own guarded call.
// Without an in-flight promise guard, both could run the body concurrently,
// and the second call to audioWorklet.addModule()/registerProcessor() with
// the same processor name would throw (registerProcessor rejects duplicate
// names), causing recCaptureInit() to silently fail even though the first
// (in-flight) call would have succeeded on its own. All callers must await
// the SAME promise instead of starting a new one.
function recCaptureInit() {
  if (captureReady) return Promise.resolve();
  if (captureInitPromise) return captureInitPromise;

  captureInitPromise = (async () => {
    try {
      if (!window._instBus || !window._drumBus || !window._recMasterOut) {
        captureInitError = 'コアの音声グラフがまだ準備できていません（recCaptureInit was called too early）。';
        console.warn('[REC] ' + captureInitError);
        return;
      }

      // Tone.js v14 internally wraps the native AudioContext with the
      // `standardized-audio-context` polyfill library. `Tone.getContext()
      // .rawContext` (and any node's `.context` reference derived from it,
      // including window._instBus.context) is that polyfill wrapper — NOT
      // the literal native BaseAudioContext. Ordinary factory methods
      // (createGain, createChannelMerger, etc.) work fine against it because
      // the polyfill implements them itself, but the native
      // `new AudioWorkletNode(ctx, ...)` constructor performs a strict
      // internal brand check that this wrapper object does not satisfy,
      // which is what produced the earlier
      // "parameter 1 is not of type 'BaseAudioContext'" error.
      //
      // Fix: use Tone.js's own `addAudioWorkletModule()` / `createAudio
      // WorkletNode()` methods, which are the polyfill's dedicated entry
      // points for this exact situation — they operate correctly on the
      // wrapped context and return a node that interoperates with the rest
      // of the (also-wrapped) graph, e.g. captureMerger.
      const toneCtx = Tone.getContext();
      const rawCtx  = toneCtx.rawContext;

      if (!rawCtx.audioWorklet) {
        captureInitError = 'このブラウザ/コンテキストは AudioWorklet に対応していません（rawCtx.audioWorklet が undefined）。';
        console.warn('[REC] ' + captureInitError);
        return;
      }

      try {
        await toneCtx.addAudioWorkletModule(REC_WORKLET_URL);
      } catch(e) {
        captureInitError = 'addAudioWorkletModule(' + REC_WORKLET_URL + ') 失敗: ' + (e && e.name ? e.name + ': ' : '') + (e && e.message ? e.message : e);
        console.error('[REC] ' + captureInitError);
        return;
      }

      // Explicit mono→stereo duplication for every tap (never rely on browser
      // auto-upmixing — this is what caused the Safari/iOS mono-vocal bug).
      function dupStereo(sourceNode) {
        const merger = rawCtx.createChannelMerger(2);
        sourceNode.connect(merger, 0, 0);
        sourceNode.connect(merger, 0, 1);
        return merger;
      }

      const omniTap = rawCtx.createGain(); omniTap.gain.value = 1.0;
      window._instBus.connect(omniTap);
      const omniStereo = dupStereo(omniTap);

      const drumTap = rawCtx.createGain(); drumTap.gain.value = 1.0;
      window._drumBus.connect(drumTap);
      const drumStereo = dupStereo(drumTap);

      const mixTap = rawCtx.createGain(); mixTap.gain.value = 1.0;
      window._recMasterOut.connect(mixTap);
      const mixStereo = dupStereo(mixTap);

      // Vocal tap: always-present bus; micConnect() fans the mic signal into
      // this in addition to (not instead of) its existing monitor chain.
      window._vocalCaptureBus = rawCtx.createGain();
      window._vocalCaptureBus.gain.value = 1.0;
      const vocalStereo = dupStereo(window._vocalCaptureBus);

      // 8ch capture merger: 0/1=omni, 2/3=drum, 4/5=vocal, 6/7=mix
      const captureMerger = rawCtx.createChannelMerger(8);
      const wireStereo = (stereoMerger, chL, chR) => {
        const splitter = rawCtx.createChannelSplitter(2);
        stereoMerger.connect(splitter);
        splitter.connect(captureMerger, 0, chL);
        splitter.connect(captureMerger, 1, chR);
      };
      wireStereo(omniStereo,  0, 1);
      wireStereo(drumStereo,  2, 3);
      wireStereo(vocalStereo, 4, 5);
      wireStereo(mixStereo,   6, 7);

      captureWorklet = toneCtx.createAudioWorkletNode('omnitro-multi-channel-capture', {
        numberOfInputs: 1,
        numberOfOutputs: 0,
        channelCount: 8,
        channelCountMode: 'explicit',
        channelInterpretation: 'discrete',
      });
      captureMerger.connect(captureWorklet);

      captureWorklet.port.onmessage = (e) => {
        if (!recState.active) return;
        const channels = e.data.channels;
        for (let c = 0; c < 8; c++) recState._chunks[c].push(channels[c]);
      };

      captureReady = true;
      captureInitError = null;
      console.log('[REC] Single-path capture graph ready (8ch AudioWorklet, sampleRate=' + rawCtx.sampleRate + ')');
    } catch(e) {
      // Catches anything unguarded above (e.g. node construction/wiring
      // errors) so a thrown exception here can never silently vanish.
      captureInitError = (e && e.name ? e.name + ': ' : '') + (e && e.message ? e.message : String(e));
      console.error('[REC] recCaptureInit() unexpected error:', e);
    }
  })();

  return captureInitPromise.finally(() => { captureInitPromise = null; });
}

// ── Recording start/stop ──────────────────────────────────────────────────────
async function recStart() {
  await ensureAudio();
  if (recState.active) return;

  if (!captureReady) await recCaptureInit();
  if (!captureReady) {
    const detail = captureInitError ? ('\n原因: ' + captureInitError) : '';
    throw new Error('録音エンジン（AudioWorklet）を初期化できませんでした。https:// または http://localhost で開いているか確認してください。' + detail);
  }

  recState._chunks = Array.from({length: 8}, () => []);
  recState.instBuf = null;
  recState.omniBuf = null;
  recState.drumBuf = null;
  recState.micBuf  = null;
  recState.active  = true;
  recState.elapsed = 0;

  captureWorklet.port.postMessage({ cmd: 'start' });

  recSetUI(true);
  recState.timer = setInterval(() => {
    recState.elapsed++;
    document.getElementById('rec-timer').textContent = recFmt(recState.elapsed);
    if (recState.elapsed >= 600) recStop(); // 10 min max
  }, 1000);
}

function recStop() {
  if (!recState.active) return;
  recState.active = false;
  clearInterval(recState.timer);
  recState.timer = null;
  recSetUI(false);

  // ── 録音停止と同時にリズムも停止 ──────────────────────────────────────────
  // 録音停止時は演奏を即座に止める（ENDINGのフレーズを挟まない）。
  // ENDINGはあくまで「演奏中にユーザーがRHYTHMを止めた」場合の演出のため。
  if (state.isPlaying) {
    state.isPlaying = false;
    if (typeof arrangementState !== 'undefined') {
      arrangementState.mode = 'stopped';
      arrangementState.fillScheduled = false;
    }
    stopRhythm();
    if (typeof _arrSyncButtonsUI === 'function') {
      _arrSyncButtonsUI(false, false);
    } else {
      const playBtn = document.getElementById('play-btn');
      if (playBtn) { playBtn.textContent = 'RHYTHM'; playBtn.classList.remove('playing'); }
    }
  }

  captureWorklet.port.postMessage({ cmd: 'stop' });

  // 最後の数ブロック分の postMessage が届くのを少し待ってから組み立てる
  // （MediaRecorder のような非同期エンコーダは存在しないため、待機はこれだけでよい）
  setTimeout(() => {
    const sr = Tone.getContext().rawContext.sampleRate;

    const concat = (chunks) => {
      let total = 0;
      for (const c of chunks) total += c.length;
      const out = new Float32Array(total);
      let off = 0;
      for (const c of chunks) { out.set(c, off); off += c.length; }
      return out;
    };
    // NOTE: use the global native AudioBuffer constructor here, NOT
    // Tone.getContext().rawContext.createBuffer(). Tone.js v14 wraps the
    // native context with the `standardized-audio-context` polyfill, and
    // that polyfill's createBuffer() returns its own wrapped buffer object
    // rather than a genuine native AudioBuffer. Feeding a wrapped buffer
    // into the (fully native) OfflineAudioContext-based export pipeline
    // below causes an extremely slow compatibility path — this is what
    // was hanging the page on export. The global AudioBuffer constructor
    // is unambiguously native and requires no AudioContext at all (the
    // app already uses this same pattern elsewhere, in subtractBuffers()).
    const toStereoBuffer = (chL, chR) => {
      if (!chL || chL.length === 0) return null;
      const buf = new AudioBuffer({ numberOfChannels: 2, length: chL.length, sampleRate: sr });
      buf.copyToChannel(chL, 0);
      buf.copyToChannel(chR, 1);
      return buf;
    };

    const ch = recState._chunks.map(concat);
    recState.omniBuf = toStereoBuffer(ch[0], ch[1]);
    recState.drumBuf = toStereoBuffer(ch[2], ch[3]);
    recState.micBuf  = toStereoBuffer(ch[4], ch[5]);
    recState.instBuf = toStereoBuffer(ch[6], ch[7]); // "instBuf" = mix tap（既存命名を踏襲）

    // マイク未接続時、vocalチャンネルは無音バッファになるので既存仕様と同じく null 扱いにする
    if (!recState.micEnabled) recState.micBuf = null;

    // ── DEBUG: 録音直後（＝再生を1回もしていない状態）のベースライン計測 ──────
    console.log('[REC-DEBUG] ====== recStop() 完了: ベースライン ======');
    _debugBufferStats('recStop直後 omniBuf', recState.omniBuf);
    _debugBufferStats('recStop直後 drumBuf', recState.drumBuf);
    _debugBufferStats('recStop直後 micBuf',  recState.micBuf);

    recState._chunks = Array.from({length: 8}, () => []);
    openMixStudio();
  }, 150);
}

// ── WAV encoder (offline render of AudioBuffer to 16-bit WAV) ─────────────────
function encodeWav(audioBuf) {
  const sr  = audioBuf.sampleRate;
  const len = audioBuf.length;
  const nCh = Math.min(audioBuf.numberOfChannels, 2);
  const bpa = nCh * 2;
  const buf  = new ArrayBuffer(44 + len * bpa);
  const view = new DataView(buf);
  const wr   = (o,...b) => b.forEach((v,i) => view.setUint8(o+i, v));
  wr(0, 0x52,0x49,0x46,0x46); view.setUint32(4, 36+len*bpa, true);
  wr(8, 0x57,0x41,0x56,0x45); wr(12,0x66,0x6D,0x74,0x20);
  view.setUint32(16,16,true); view.setUint16(20,1,true);
  view.setUint16(22,nCh,true); view.setUint32(24,sr,true);
  view.setUint32(28,sr*bpa,true); view.setUint16(32,bpa,true);
  view.setUint16(34,16,true);
  wr(36,0x64,0x61,0x74,0x61); view.setUint32(40,len*bpa,true);

  // getChannelData() must be called ONCE per channel, not once per sample.
  // Calling it inside the sample loop (as before) meant up to len*nCh calls
  // for a multi-minute recording — tens of millions of calls — which is
  // what was blocking the main thread long enough to trigger the browser's
  // "Page Unresponsive" warning on export.
  const channelData = [];
  for (let c = 0; c < nCh; c++) channelData.push(audioBuf.getChannelData(c));

  let off = 44;
  for (let i = 0; i < len; i++) {
    for (let c = 0; c < nCh; c++) {
      const s = Math.max(-1,Math.min(1, channelData[c][i]));
      view.setInt16(off, s<0 ? s*0x8000 : s*0x7FFF, true);
      off += 2;
    }
  }
  return new Blob([buf], { type: 'audio/wav' });
}

function dlBlob(blob, filename) {
  const a = document.getElementById('dl');
  const url = URL.createObjectURL(blob);
  a.href = url; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function tsStr() {
  const now = new Date(), pad = n => String(n).padStart(2,'0');
  return now.getFullYear()+pad(now.getMonth()+1)+pad(now.getDate())
        +'-'+pad(now.getHours())+pad(now.getMinutes())+pad(now.getSeconds());
}

// ── Offline render helpers ────────────────────────────────────────────────────
// Render a vocal buffer through the current studio EQ/comp settings offline
// ── Schroeder アルゴリズミックリバーブ ────────────────────────────────────────
// オムニコードの世界観に合わせた小部屋〜プレート風リバーブ。
// IRファイル不要、Web Audio API ネイティブノードのみで構成。
//
// 構成:
//   input → preDelayNode → 4× Comb Filter (並列) → 2× Allpass Filter (直列) → wet gain
//   input                                                                      → dry gain
//   wet + dry → output
//
// Comb フィルタ: DynamicsCompressor を逆用したフィードバックではなく、
// DelayNode + BiquadFilter(lowpass=damping) + GainNode(feedback) のループで実装。
// ループは完全閉ループではなく「ソースを連続的に混合」する疑似フィードバック方式を採用
// (Web Audio でのフィードバックループはブラウザ実装が不安定なため避ける)。
// → 代わりに ConvolverNode に IR を生成する方式をオフライン/オンライン両対応で使う。

function setupMicSettings() {
  const togRec     = document.getElementById('tog-mic-record');
  const togMon     = document.getElementById('tog-mic-monitor');
  const levelSlider = document.getElementById('ctrl-mic-level');
  const levelVal    = document.getElementById('val-mic-level');

  if (togRec) {
    togRec.addEventListener('click', async () => {
      recState.micEnabled = togRec.classList.contains('on');
      if (recState.micEnabled) {
        await micConnect();
        if (!recState.micSource) { togRec.classList.remove('on'); recState.micEnabled = false; }
      } else {
        micDisconnect();
      }
    });
  }
  if (togMon) {
    togMon.addEventListener('click', () => {
      recState.micMonitor = togMon.classList.contains('on');
      if (recState.micMonNode) recState.micMonNode.gain.value = recState.micMonitor ? 1.0 : 0.0;
    });
  }
  if (levelSlider) {
    levelSlider.addEventListener('input', () => {
      recState.micLevel = parseInt(levelSlider.value) / 100;
      if (levelVal) levelVal.textContent = levelSlider.value;
      if (recState.micGain) recState.micGain.gain.value = recState.micLevel;
    });
  }
}

function setupRecording() {
  document.getElementById('rec-btn').addEventListener('click', async () => {
    if (!recState.active) {
      try {
        await recStart();
      } catch(e) {
        console.error('[REC] recStart error:', e);
        alert('Recording failed to start: ' + e.message);
        recSetUI(false);
      }
    } else {
      recStop();
    }
  });
}
