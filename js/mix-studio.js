function buildReverbIR(ctx, sizeVal, dampVal, preDelayMs, durationSec) {
  // Exponential decay noise IR (= infinite impulse response convolution reverb)
  // size: 0-1 → decay speed, damp: 0-1 → lowpass cutoff on decay
  const sr      = ctx.sampleRate;
  const nSec    = Math.max(0.3, durationSec ?? (0.5 + sizeVal * 3.5)); // 0.5s〜4s
  const nSamp   = Math.floor(sr * nSec);
  const preSamp = Math.floor(sr * preDelayMs / 1000);
  const total   = nSamp + preSamp;
  const ir      = ctx.createBuffer(2, total, sr);

  // Damping: lowpass on each sample as we generate (simulates HF absorption)
  // Simple single-pole IIR lowpass: y[n] = (1-a)*x[n] + a*y[n-1]
  // a → 0: bright (no damping), a → 1: dark (heavy damping)
  const lpAlpha = dampVal * 0.92; // max 0.92 to keep stability

  for (let ch = 0; ch < 2; ch++) {
    const data = ir.getChannelData(ch);
    // silence in pre-delay zone
    for (let i = 0; i < preSamp; i++) data[i] = 0;

    let prev = 0;
    for (let i = 0; i < nSamp; i++) {
      const t   = i / sr;
      // Exponential decay envelope — faster decay for small rooms
      const env = Math.exp(-t * (3.0 + (1 - sizeVal) * 8.0));
      // Random noise: two slightly different channels for stereo spread
      const noise = (Math.random() * 2 - 1) * (ch === 0 ? 1.0 : 0.97);
      // Apply 1-pole lowpass (damping)
      prev = prev * lpAlpha + noise * (1 - lpAlpha);
      data[preSamp + i] = prev * env;
    }
  }
  return ir;
}

// Build wet/dry reverb graph for live playback.
// input → preOut → convolver → wetGain ─┐
// input            ───────── → dryGain ─┴→ output (= returned node to connect downstream)
// Returns { inputNode, outputNode, convolver, wetGain, dryGain }
function buildReverbGraph(ctx, destNode, wet, size, damp, preDelayMs) {
  const inputGain  = ctx.createGain(); inputGain.gain.value  = 1.0;
  const dryGain    = ctx.createGain(); dryGain.gain.value    = 1.0 - wet;
  const wetGain    = ctx.createGain(); wetGain.gain.value    = wet;
  const convolver  = ctx.createConvolver(); convolver.normalize = true;

  const ir = buildReverbIR(ctx, size, damp, preDelayMs);
  convolver.buffer = ir;

  inputGain.connect(dryGain);
  inputGain.connect(convolver);
  convolver.connect(wetGain);

  dryGain.connect(destNode);
  wetGain.connect(destNode);

  return { inputNode: inputGain, dryGain, wetGain, convolver };
}

// Build reverb for OfflineAudioContext (IR generated in the offline ctx)
function buildOfflineReverbGraph(offCtx, destNode, wet, size, damp, preDelayMs) {
  const dryGain   = offCtx.createGain(); dryGain.gain.value  = 1.0 - wet;
  const wetGain   = offCtx.createGain(); wetGain.gain.value  = wet;
  const convolver = offCtx.createConvolver(); convolver.normalize = true;

  convolver.buffer = buildReverbIR(offCtx, size, damp, preDelayMs);

  return { dryGain, wetGain, convolver };
}

// Mix two AudioBuffers together (sample-accurate sum, output clamped)
async function mixBuffers(bufA, bufB) {
  if (!bufA && !bufB) return null;
  if (!bufA) return bufB;
  if (!bufB) return bufA;
  const sr   = bufA.sampleRate;
  const len  = Math.max(bufA.length, bufB.length);
  const nCh  = Math.max(Math.min(bufA.numberOfChannels,2), Math.min(bufB.numberOfChannels,2));
  const off  = new OfflineAudioContext(nCh, len, sr);
  const srcA = off.createBufferSource(); srcA.buffer = bufA;
  const srcB = off.createBufferSource(); srcB.buffer = bufB;
  srcA.connect(off.destination); srcB.connect(off.destination);
  srcA.start(0); srcB.start(0);
  return await off.startRendering();
}

// ── Mix Studio: open / close ──────────────────────────────────────────────────
function openMixStudio() {
  if (!recState.instBuf && !recState.micBuf) {
    alert('No audio was captured.');
    return;
  }

  // 新しい録音データが確定したので、古い波形キャッシュ（別の録音の波形データ）
  // が残っていれば必ず破棄する。次の studioDrawWaveform() 呼び出しで
  // 新しいバッファから再計算される。
  studioState._waveformCache = null;

  // ── 方法A: ボーカルバッファのノーマライズ ──────────────────────────────────
  // ピーク値を測定してターゲットレベル（-3dBFS = 0.708）に正規化。
  // AGCで圧縮済みの音量をさらに底上げし、かつ絶対に音割れしない。
  if (recState.micBuf) {
    const TARGET_PEAK = 0.708; // -3dBFS
    let peak = 0;
    for (let ch = 0; ch < recState.micBuf.numberOfChannels; ch++) {
      const data = recState.micBuf.getChannelData(ch);
      for (let i = 0; i < data.length; i++) {
        const abs = Math.abs(data[i]);
        if (abs > peak) peak = abs;
      }
    }
    if (peak > 0.001 && peak < TARGET_PEAK) {
      // ピークが低い（小さい声）→ 正規化で底上げ
      const gain = Math.min(TARGET_PEAK / peak, 8.0); // 最大8倍（+18dB）まで
      for (let ch = 0; ch < recState.micBuf.numberOfChannels; ch++) {
        const data = recState.micBuf.getChannelData(ch);
        for (let i = 0; i < data.length; i++) data[i] *= gain;
      }
    } else if (peak >= TARGET_PEAK) {
      // ピークが高すぎる→ -3dBFSに収める（音割れ防止）
      const gain = TARGET_PEAK / peak;
      for (let ch = 0; ch < recState.micBuf.numberOfChannels; ch++) {
        const data = recState.micBuf.getChannelData(ch);
        for (let i = 0; i < data.length; i++) data[i] *= gain;
      }
    }
  }

  console.log('[REC-DEBUG] ====== openMixStudio() 開始（マイク正規化後） ======');
  _debugBufferStats('openMixStudio omniBuf', recState.omniBuf);
  _debugBufferStats('openMixStudio drumBuf', recState.drumBuf);
  _debugBufferStats('openMixStudio micBuf',  recState.micBuf);

  studioState.open = true;
  document.getElementById('mix-studio').classList.add('open');

  const hasMic  = !!recState.micBuf;
  const hasDrum = !!recState.drumBuf;

  // MIC — DYNAMICS（GAIN/OTT/DE-ESS）は、マイク未収録時はグレーアウト＋操作不可にする。
  const vocalEqSection = document.getElementById('vocal-eq-section');
  if (vocalEqSection) {
    vocalEqSection.classList.toggle('ch-col-disabled', !hasMic);
    vocalEqSection.querySelectorAll('input').forEach(inp => { inp.disabled = !hasMic; });
  }

  // Export checkbox defaults（未収録チャンネルはチェックボックス自体も無効化）
  document.getElementById('chk-mix').checked   = true;
  document.getElementById('chk-vocal').checked  = hasMic;
  document.getElementById('chk-vocal').disabled = !hasMic;
  document.getElementById('chk-music').checked = false;
  const chkDrum = document.getElementById('chk-drum');
  if (chkDrum) { chkDrum.checked = hasDrum; chkDrum.disabled = !hasDrum; }

  // Memory info
  const instMb = recState.instBuf ? (recState.instBuf.length * recState.instBuf.numberOfChannels * 4 / 1048576).toFixed(1) : 0;
  const micMb  = recState.micBuf  ? (recState.micBuf.length  * recState.micBuf.numberOfChannels  * 4 / 1048576).toFixed(1) : 0;
  const totalMb = (parseFloat(instMb) + parseFloat(micMb)).toFixed(1);
  document.getElementById('studio-mem').textContent = totalMb + ' MB in RAM';

  // Warn if long
  const warnEl = document.getElementById('studio-warn');
  const dur = recState.instBuf ? recState.instBuf.duration : 0;
  warnEl.classList.toggle('visible', dur > 600);

  studioDrawWaveform();
  studioState.playStartBufOffset = 0;
  studioUpdateTime(0);

  // Build playback graph
  studioGraphBuild();
}

function closeMixStudio() {
  studioPause();
  studioGraphDestroy();
  document.getElementById('mix-studio').classList.remove('open');
  studioState.open = false;
}

function discardRecording() {
  closeMixStudio();
  recState.instBuf = null;
  recState.omniBuf = null;
  recState.drumBuf = null;
  recState.micBuf  = null;
  recState._chunks = Array.from({length: 8}, () => []);
  studioState._waveformCache = null;
}

// ── テープエフェクト ──────────────────────────────────────────────────────────
// ミックスバス全体（ボーカル+オムニコード）にかける。
// 両者を同じテープ空間に通すことで「録音された同じ場所の音」として馴染む。
//
// 構成（ライブ再生時）:
//   playBus → tapeHPF(rumble cut 40Hz) → tapeShaperGain → tapeShaper(saturation)
//           → tapeLPF(HF rolloff) → tapeMixGain → playOut
//
// Wow/Flutter: DelayNode.delayTime を LFO で変調する方式。
//   DelayNodeの遅延時間変調 = 可変遅延 = ピッチ変動 (テープのピッチ揺れと同原理)
//   wow:     0.5〜1.2Hz、最大±1.5ms  → ゆっくりした音程のうねり
//   flutter: 8〜12Hz、  最大±0.12ms → 細かい速い揺れ（モーター周波数）
//
// ── バス共有エフェクト ─────────────────────────────────────────────────────────
//
// 「馴染む」を作る3要素をミックスバス後段で共有処理:
//
//   1. WOW/FLUTTER（テープ走行揺らぎ）
//      DelayNode.delayTime を極小LFOで変調。
//      サチュレーション完全なし。音はクリアなまま。
//      両者が同じ揺らぎを共有 → 「同じテープを通った」感覚。
//
//   2. BUS REVERB（共有空間リバーブ）
//      各チャンネルのリバーブは「近さ」の調整。
//      バスリバーブは「部屋」の統一。同じIRを通ることで
//      演奏音とボーカルが同一空間に配置されたと耳が判断する。
//
//   3. AIR LPF（帯域の統一）
//      オムニコードは元々高域が制限された楽器。
//      ボーカルの高域だけ鮮明だと浮く。
//      バスに軽いLPFをかけて帯域感を揃える。

// Wow/Flutter パラメータ（IEC 60386 準拠、サチュレーションなし）
function getBusParams(tapeAmt, airAmt) {
  return {
    wowDepth:  tapeAmt * 0.00015,  // 0〜0.15ms : ほぼ知覚できない微小な揺れ
    flutDepth: tapeAmt * 0.000012, // 0〜0.012ms: さらに細かい
    airFreq:   20000 - airAmt * 8000, // 20kHz〜12kHz: 高域をそっと丸める
  };
}

// ライブ再生用バスエフェクトグラフ
// playBus → [wow/flutter delay] → [bus reverb wet/dry] → [air LPF] → nextNode
function buildBusGraph(ctx, playBus, nextNode, tapeAmt, busRvbWet, rvbSize, airAmt) {
  try { playBus.disconnect(nextNode); } catch(e){}

  const p = getBusParams(tapeAmt, airAmt);
  const nodes = {};

  // ─ Air LPF（常に生成 — チェーンの終端） ─
  const airLPF = ctx.createBiquadFilter();
  airLPF.type  = 'lowpass';
  airLPF.frequency.value = p.airFreq;
  airLPF.Q.value = 0.5;
  nodes.airLPF = airLPF;
  airLPF.connect(nextNode);

  // ─ Bus Reverb ─
  // dryGain/wetGain は両方 airLPF に直接つなぐ。destNode=null は使わない。
  if (busRvbWet > 0.005) {
    const ir       = buildReverbIR(ctx, rvbSize, 0.55, 18);
    const convolver = ctx.createConvolver(); convolver.normalize = true;
    convolver.buffer = ir;
    const dryGain  = ctx.createGain(); dryGain.gain.value  = 1.0 - busRvbWet;
    const wetGain  = ctx.createGain(); wetGain.gain.value  = busRvbWet;
    const rvbIn    = ctx.createGain(); rvbIn.gain.value    = 1.0;
    rvbIn.connect(dryGain);
    rvbIn.connect(convolver);
    convolver.connect(wetGain);
    dryGain.connect(airLPF);
    wetGain.connect(airLPF);
    nodes.busRvbIn  = rvbIn;
    nodes.busRvbDry = dryGain;
    nodes.busRvbWet = wetGain;
    nodes.busRvbConv = convolver;
  }

  // ─ Wow/Flutter ─
  if (tapeAmt > 0.005) {
    const wowLfo = ctx.createOscillator();
    wowLfo.type  = 'sine';
    wowLfo.frequency.value = 0.6 + Math.random() * 0.5;
    const wowDepth = ctx.createGain();
    wowDepth.gain.value = p.wowDepth;

    const flutLfo = ctx.createOscillator();
    flutLfo.type  = 'sine';
    flutLfo.frequency.value = 8.0 + Math.random() * 4.0;
    const flutDepth = ctx.createGain();
    flutDepth.gain.value = p.flutDepth;

    const delayNode = ctx.createDelay(0.02);
    delayNode.delayTime.value = 0.002;
    wowLfo.connect(wowDepth);   wowDepth.connect(delayNode.delayTime);
    flutLfo.connect(flutDepth); flutDepth.connect(delayNode.delayTime);
    wowLfo.start(); flutLfo.start();

    nodes.wowLfo    = wowLfo;   nodes.flutLfo  = flutLfo;
    nodes.wowDepth  = wowDepth; nodes.flutDepth = flutDepth;
    nodes.delayNode = delayNode;
  }

  // ─ チェーン構築: playBus → [delay?] → [rvbIn? | airLPF直結] ─
  let cur = playBus;

  if (nodes.delayNode) {
    cur.connect(nodes.delayNode);
    cur = nodes.delayNode;
  }

  if (nodes.busRvbIn) {
    cur.connect(nodes.busRvbIn);
  } else {
    cur.connect(airLPF);
  }

  return nodes;
}

function destroyBusGraph(nodes, playBus, nextNode) {
  if (!nodes) return;
  if (nodes.wowLfo)  { try { nodes.wowLfo.stop();  } catch(e){} }
  if (nodes.flutLfo) { try { nodes.flutLfo.stop(); } catch(e){} }
  ['wowLfo','flutLfo','wowDepth','flutDepth','delayNode',
   'busRvbIn','busRvbDry','busRvbWet','busRvbConv','airLPF'].forEach(k => {
    if (nodes[k]) try { nodes[k].disconnect(); } catch(e){}
  });
  try { if (playBus && nextNode) playBus.connect(nextNode); } catch(e){}
}

// オフライン処理: バスに Wow/Flutter + BusReverb + AirLPF を適用
async function applyBusOffline(srcBuf, tapeAmt, busRvbWet, rvbSize, airAmt) {
  if (!srcBuf) return srcBuf;
  const anyEffect = tapeAmt > 0.005 || busRvbWet > 0.005 || airAmt > 0.005;
  if (!anyEffect) return srcBuf;

  const sr  = srcBuf.sampleRate;
  const nCh = Math.min(srcBuf.numberOfChannels, 2);
  // リバーブのテール分だけ延長
  const rvbTail = busRvbWet > 0.005 ? Math.floor(sr * (0.4 + rvbSize * 2.5)) : 0;
  const len = srcBuf.length + rvbTail + Math.floor(sr * 0.03);
  const off = new OfflineAudioContext(nCh, len, sr);
  const src = off.createBufferSource(); src.buffer = srcBuf;

  const p = getBusParams(tapeAmt, airAmt);
  let cur = src;

  // Wow/Flutter
  if (tapeAmt > 0.005) {
    const wowLfo  = off.createOscillator(); wowLfo.type = 'sine';
    wowLfo.frequency.value = 0.6 + Math.random() * 0.5;
    const wowD    = off.createGain(); wowD.gain.value = p.wowDepth;
    const flutLfo = off.createOscillator(); flutLfo.type = 'sine';
    flutLfo.frequency.value = 8.0 + Math.random() * 4.0;
    const flutD   = off.createGain(); flutD.gain.value = p.flutDepth;
    const delay   = off.createDelay(0.02); delay.delayTime.value = 0.002;
    wowLfo.connect(wowD);   wowD.connect(delay.delayTime);
    flutLfo.connect(flutD); flutD.connect(delay.delayTime);
    wowLfo.start(0); flutLfo.start(0);
    cur.connect(delay);
    cur = delay;
  }

  // Bus Reverb
  if (busRvbWet > 0.005) {
    const rv  = buildOfflineReverbGraph(off, off.destination, busRvbWet, rvbSize, 0.55, 18);
    const airLPF = off.createBiquadFilter();
    airLPF.type = 'lowpass'; airLPF.frequency.value = p.airFreq; airLPF.Q.value = 0.5;
    cur.connect(rv.dryGain);
    cur.connect(rv.convolver);
    rv.convolver.connect(rv.wetGain);
    rv.dryGain.connect(airLPF);
    rv.wetGain.connect(airLPF);
    airLPF.connect(off.destination);
  } else {
    const airLPF = off.createBiquadFilter();
    airLPF.type = 'lowpass'; airLPF.frequency.value = p.airFreq; airLPF.Q.value = 0.5;
    cur.connect(airLPF);
    airLPF.connect(off.destination);
  }

  src.start(0);
  return await off.startRendering();
}

// 後方互換エイリアス（studioExportから呼ばれる）
async function applyTapeOffline(srcBuf, tapeAmt) { return srcBuf; } // saturation削除につき no-op

// ── Playback graph ─────────────────────────────────────────────────────────────
// 信号フロー:
//   instBuf → instChain(gain→HPF→LPF→Reverb) ──────────────────────────────────────────┐
//   micBuf  → vocalChain(gain→HPF→LPF→MidScoop→Presence→OTT→DeEss→Reverb) ─────────────┤
//                                                                                        ▼
//                                                               playBus → [GlueComp] → [Tape/BusRvb/Air] → masterLim → playOut → dest
//
// 全ノードはここでのみ生成。ライブ演奏ノードとは完全分離。

// ── OTT (Over The Top) multiband dynamics ────────────────────────────────────
// Ableton OTT の近似。3バンド分割（LP/BP/HP）それぞれに独立コンプを適用し
// 再合成。upward compression（低いシグナルを引き上げる）を簡易的に gain で近似。
//
// 構成:
//   input ─┬─ LP (< 250Hz) → comp_L → gainL ─┐
//           ├─ BP (250–4k)  → comp_M → gainM ─┼─► output
//           └─ HP (> 4kHz)  → comp_H → gainH ─┘
//
// amt: 0-100 (スライダー値)
function buildOttGraph(ctx, destNode, amt) {
  if (amt < 1) return null; // OTTオフ

  const a       = amt / 100;              // 0-1
  const inputG  = ctx.createGain(); inputG.gain.value = 1.0;

  // Band split: LP / BP / HP
  const lpf1  = ctx.createBiquadFilter(); lpf1.type = 'lowpass';   lpf1.frequency.value = 250;  lpf1.Q.value = 0.5;
  const hpf1  = ctx.createBiquadFilter(); hpf1.type = 'highpass';  hpf1.frequency.value = 250;  hpf1.Q.value = 0.5;
  const lpf2  = ctx.createBiquadFilter(); lpf2.type = 'lowpass';   lpf2.frequency.value = 4000; lpf2.Q.value = 0.5;
  const hpf2  = ctx.createBiquadFilter(); hpf2.type = 'highpass';  hpf2.frequency.value = 4000; hpf2.Q.value = 0.5;

  // Band compressors:
  //   Low band  – downward comp（胸声の膨らみを抑制）
  //   Mid band  – downward comp + upward gain（声の芯を持ち上げ）
  //   High band – downward comp（歯擦音・過剰な高域を抑制）
  const mkComp = (threshDb, ratio, atk, rel) => {
    const c = ctx.createDynamicsCompressor();
    c.threshold.value = threshDb;
    c.ratio.value     = ratio;
    c.knee.value      = 4;
    c.attack.value    = atk;
    c.release.value   = rel;
    return c;
  };

  const compL = mkComp(-24 + (1-a)*18, 2 + a*4,   0.030, 0.200); // 低域: -24〜-6dB, ratio 2〜6
  const compM = mkComp(-30 + (1-a)*20, 2 + a*3,   0.010, 0.080); // 中域: -30〜-10dB, ratio 2〜5
  const compH = mkComp(-28 + (1-a)*18, 2 + a*3.5, 0.003, 0.060); // 高域: -28〜-10dB, ratio 2〜5.5

  // Upward gain per band (OTTの「引き上げ」効果を近似)
  // amt=0 → gain=1.0, amt=100 → midが最も持ち上がる
  const gainL = ctx.createGain(); gainL.gain.value = 1.0 + a * 0.15;  // 低域は控えめ
  const gainM = ctx.createGain(); gainM.gain.value = 1.0 + a * 0.35;  // 中域を引き上げ（声の芯）
  const gainH = ctx.createGain(); gainH.gain.value = 1.0 + a * 0.20;  // 高域は中程度

  // Output summing gain: 3バンド合計の膨張を補正（固定）
  const outG  = ctx.createGain(); outG.gain.value = 0.50;

  // Routing
  inputG.connect(lpf1);
  inputG.connect(hpf1);
  hpf1.connect(lpf2);   // BP band
  hpf1.connect(hpf2);   // HP band

  lpf1.connect(compL); compL.connect(gainL); gainL.connect(outG);
  lpf2.connect(compM); compM.connect(gainM); gainM.connect(outG);
  hpf2.connect(compH); compH.connect(gainH); gainH.connect(outG);
  outG.connect(destNode);

  return {
    inputNode: inputG,
    nodes: [lpf1, hpf1, lpf2, hpf2, compL, compM, compH, gainL, gainM, gainH, outG],
  };
}

// ── De-Esser: 6–8kHz narrowband downward compressor ──────────────────────────
// BiquadFilter(bandpass 7kHz) で歯擦音帯域を検出し、
// DynamicsCompressor で圧縮 → DryGain + WetGain の並列合成で自然な聴こえに。
// amt 0-100
function buildDeEssGraph(ctx, destNode, amt) {
  if (amt < 1) return null;
  const a = amt / 100;

  const inputG = ctx.createGain(); inputG.gain.value = 1.0;

  // Side-chain 検出 (LF 除去して歯擦音成分を抽出)
  // Web Audio に側鎖接続はないので直接 7kHz 周辺をコンプ処理
  const bpf = ctx.createBiquadFilter();
  bpf.type = 'peaking';
  bpf.frequency.value = 7000;
  bpf.Q.value         = 1.8;
  bpf.gain.value      = -(a * 10);  // 0〜-10dB のピーキング減衰

  inputG.connect(bpf);
  bpf.connect(destNode);

  return {
    inputNode: inputG,
    nodes: [bpf],
  };
}

// ── Mid Scoop EQ: 300Hz peaking cut (声とオムニコードの帯域分離) ───────────────
// Q=1.5 でナロー気味にカット。オムニコードが強い 200-500Hz に切れ込む。
function buildMidScoopNode(ctx, depthDb) {
  const filter = ctx.createBiquadFilter();
  filter.type  = 'peaking';
  filter.frequency.value = 300;
  filter.Q.value         = 1.5;
  filter.gain.value      = -Math.abs(depthDb); // 負のゲイン (カット)
  return filter;
}

// ── Presence EQ: 3kHz high-shelf boost ───────────────────────────────────────
function buildPresenceNode(ctx, gainDb) {
  const filter = ctx.createBiquadFilter();
  filter.type  = 'highshelf';
  filter.frequency.value = 3000;
  filter.gain.value      = gainDb;
  return filter;
}

// ── Glue Bus Compressor ───────────────────────────────────────────────────────
// 透明感のある軽い圧縮でまとまり感を出す。
// amt 0-100 → threshold -12〜-6dB, ratio 2:1〜3:1
// Attack 20ms（過渡音を通す）、Release 80ms（ポンピング防止）
function buildGlueComp(ctx, destNode, amt) {
  const comp = ctx.createDynamicsCompressor();
  const a = amt / 100;
  comp.threshold.value = a > 0.01 ? -6 - a * 14 : 0;  // 0=完全オフ(threshold 0dB), 100=-20dB
  comp.ratio.value     = a > 0.01 ? 1.5 + a * 2.0 : 1.0; // 0=ratio 1:1(完全スルー)
  comp.knee.value      = 8;                               // ソフトニー
  comp.attack.value    = 0.020;
  comp.release.value   = 0.080;
  comp.connect(destNode);
  return comp;
}

// ── 再生専用バッファの複製 ────────────────────────────────────────────────────
// recState.omniBuf / drumBuf / micBuf は「録音の原本」であり、波形表示・書き出し
// (WAV export) の両方が直接参照する唯一のソース・オブ・トゥルース。
//
// もしこの原本を AudioBufferSourceNode.buffer に直接割り当てて繰り返し再生すると、
// Tone.js v14 が内部で使用する `standardized-audio-context` ポリフィル層
// （Tone.getContext().rawContext は native ではなくこのポリフィルのラッパー —
// audio-core.js / recording.js のコメント参照）が、native な AudioBuffer
// （`new AudioBuffer(...)` グローバルコンストラクタ生成、ctx.createBuffer()
// 生成ではない）を "foreign" なバッファとして扱い、再生のたびに内部的な
// 適応/書き込み処理を行うことがある。これが疑われる原因で、再生を繰り返すほど
// 原本データ（特に左チャンネル）が徐々に減衰していくバグが発生していた
// （MIX STUDIOの波形表示・書き出しファイル双方に影響、テンポには無関係）。
//
// 対策: 再生のたびに「使い捨てのコピー」を作り、それを AudioBufferSourceNode
// に渡す。ポリフィル層が何をしようと、コピーが汚れるだけで recState.omniBuf/
// drumBuf/micBuf の原本は常にクリーンなまま保たれる。
function cloneAudioBufferForPlayback(buf) {
  if (!buf) return null;
  const clone = new AudioBuffer({
    numberOfChannels: buf.numberOfChannels,
    length: buf.length,
    sampleRate: buf.sampleRate,
  });
  for (let c = 0; c < buf.numberOfChannels; c++) {
    clone.copyToChannel(buf.getChannelData(c), c);
  }
  return clone;
}

// ── OMNI / DRUM チャンネル: src → playBus（直結、レベル/HPF処理なし） ────────
// 以前はOMNI/DRUM個別にLEVEL/HPFスライダーを持っていたが、接続の複雑さの
// 割に実用上不要という判断で撤去した。録音そのまま（instBus/drumBusの
// タップ内容そのまま）をplayBusへ流すだけのシンプルな経路にしている。
function buildMusicChainNodes(ctx, buf, playBus) {
  const src = ctx.createBufferSource(); src.buffer = buf;
  src.connect(playBus);
  return { src };
}

function buildDrumChainNodes(ctx, buf, playBus) {
  const src = ctx.createBufferSource(); src.buffer = buf;
  src.connect(playBus);
  return { src };
}

// ── MIC チャンネル: gain(dB指定のブースト) → [OTT] → [DeEss] → playBus ──────
// LEVEL(0-100%減衰専用)とHPFは撤去。代わりに「MIC — DYNAMICS」の GAIN
// スライダー(-12dB〜+24dB)で必要なだけブーストできるようにした。
function buildVocalChainNodes(ctx, buf, ss, playBus) {
  const src  = ctx.createBufferSource(); src.buffer = buf;
  const gain = ctx.createGain(); gain.gain.value = Math.pow(10, (ss.micGainDb || 0) / 20);
  src.connect(gain);

  let lastNode  = gain;
  let ottGraph  = null;
  let deEssGraph = null;

  // OTT
  if (ss.ottAmt >= 1) {
    const ottDest = ctx.createGain(); ottDest.gain.value = 1.0;
    ottGraph = buildOttGraph(ctx, ottDest, ss.ottAmt);
    if (ottGraph) { lastNode.connect(ottGraph.inputNode); lastNode = ottDest; }
  }

  // De-Ess
  if (ss.deEssAmt >= 1) {
    const deEssDest = ctx.createGain(); deEssDest.gain.value = 1.0;
    deEssGraph = buildDeEssGraph(ctx, deEssDest, ss.deEssAmt);
    if (deEssGraph) { lastNode.connect(deEssGraph.inputNode); lastNode = deEssDest; }
  }

  lastNode.connect(playBus);
  return { src, gain, ottGraph, deEssGraph };
}

function destroyChain(chain) {
  if (!chain) return;
  try { chain.src.stop(); } catch(e){}
  ['src','gain','hpf'].forEach(k => {
    if (chain[k]) try { chain[k].disconnect(); } catch(e){}
  });
  if (chain.ottGraph) {
    chain.ottGraph.nodes.forEach(n => { try { n.disconnect(); } catch(e){} });
    try { chain.ottGraph.inputNode.disconnect(); } catch(e){}
  }
  if (chain.deEssGraph) {
    chain.deEssGraph.nodes.forEach(n => { try { n.disconnect(); } catch(e){} });
    try { chain.deEssGraph.inputNode.disconnect(); } catch(e){}
  }
}

function studioGraphBuild() {
  studioGraphDestroy();
  studioState.drumChain = null;
  studioState.ctx = Tone.getContext().rawContext;
  const ctx = studioState.ctx;
  const ss  = studioState;

  // playOut → destination
  ss.playOut = ctx.createGain(); ss.playOut.gain.value = 0.88;
  ss.playOut.connect(ctx.destination);

  // masterLim → playOut
  ss.masterLim = ctx.createDynamicsCompressor();
  ss.masterLim.threshold.value = ss.limitDb;
  ss.masterLim.knee.value      = 0;
  ss.masterLim.ratio.value     = 20;
  ss.masterLim.attack.value    = 0.001;
  ss.masterLim.release.value   = 0.08;
  ss.masterLim.connect(ss.playOut);

  // Bus Reverb: glueComp出力 → [convolver wet + dry] → masterLim
  // busRvbInNode が glueComp の接続先になる
  let busRvbInNode;
  if (ss.busRvb > 0.5) {
    const wet  = ss.busRvb / 100;
    const size = ss.rvbSize / 100;
    const ir   = buildReverbIR(ctx, size, 0.55, 18);
    const conv = ctx.createConvolver(); conv.normalize = true; conv.buffer = ir;
    const dryG = ctx.createGain(); dryG.gain.value = 1.0 - wet;
    const wetG = ctx.createGain(); wetG.gain.value = wet;
    const rvbIn = ctx.createGain(); rvbIn.gain.value = 1.0;
    rvbIn.connect(dryG); rvbIn.connect(conv);
    conv.connect(wetG);
    dryG.connect(ss.masterLim); wetG.connect(ss.masterLim);
    ss.busRvbNodes = { rvbIn, conv, dryG, wetG };
    busRvbInNode = rvbIn;
  } else {
    ss.busRvbNodes = null;
    busRvbInNode = ss.masterLim;
  }
  ss.busInNode = busRvbInNode;

  // Glue Compressor: glueComp → busRvbIn (or masterLim)
  ss.glueCompNode = buildGlueComp(ctx, busRvbInNode, ss.glueAmt);

  // playBus: チャンネル合流点 → glueComp
  ss.playBus = ctx.createGain(); ss.playBus.gain.value = 1.0;
  ss.playBus.connect(ss.glueCompNode);
}

function studioGraphDestroy() {
  studioPause();
  if (studioState.busRvbNodes) {
    const n = studioState.busRvbNodes;
    ['rvbIn','conv','dryG','wetG'].forEach(k => { if (n[k]) try { n[k].disconnect(); } catch(e){} });
    studioState.busRvbNodes = null;
  }
  studioState.busNodes = null;
  ['masterLim','playBus','playOut','glueCompNode','busInNode'].forEach(k => {
    if (studioState[k]) { try { studioState[k].disconnect(); } catch(e){} studioState[k] = null; }
  });
  destroyChain(studioState.instChain);  studioState.instChain  = null;
  destroyChain(studioState.drumChain);  studioState.drumChain  = null;
  destroyChain(studioState.vocalChain); studioState.vocalChain = null;
}

// ── Playback ──────────────────────────────────────────────────────────────────
function studioPlay(offsetSec) {
  if (!studioState.playBus) return;

  console.log('[REC-DEBUG] ====== studioPlay() 呼び出し ======');
  _debugBufferStats('studioPlay開始時点 recState.omniBuf(原本)', recState.omniBuf);
  _debugBufferStats('studioPlay開始時点 recState.drumBuf(原本)', recState.drumBuf);

  studioPause();

  const ctx = studioState.ctx;
  const off = offsetSec != null ? offsetSec : studioState.playStartBufOffset;
  const ss  = studioState;

  // OMNI と DRUM をそれぞれ独立したバッファ（omniBuf / drumBuf）から個別に
  // 再生する（LEVEL/HPF処理は撤去、録音そのままを直結）。MICのみゲイン調整
  // と OTT/DE-ESS を適用する。
  // 再生には必ず cloneAudioBufferForPlayback() で複製したバッファを渡す
  // （recState.*Buf の原本は波形表示・書き出し用に絶対に汚さない — 詳細は
  // cloneAudioBufferForPlayback() 直前のコメント参照）。
  if (recState.omniBuf) {
    const omniClone = cloneAudioBufferForPlayback(recState.omniBuf);
    _debugBufferStats('studioPlay: omniBufの複製(再生に使うのはこちら)', omniClone);
    ss.instChain = buildMusicChainNodes(ctx, omniClone, ss.playBus);
    ss.instChain.src.start(0, Math.min(off, recState.omniBuf.duration));
    ss.instChain.src.onended = () => { if (ss.playing) studioPause(); };
  }

  if (recState.drumBuf) {
    const drumClone = cloneAudioBufferForPlayback(recState.drumBuf);
    _debugBufferStats('studioPlay: drumBufの複製(再生に使うのはこちら)', drumClone);
    ss.drumChain = buildDrumChainNodes(ctx, drumClone, ss.playBus);
    ss.drumChain.src.start(0, Math.min(off, recState.drumBuf.duration));
  }

  if (recState.micBuf) {
    ss.vocalChain = buildVocalChainNodes(ctx, cloneAudioBufferForPlayback(recState.micBuf), ss, ss.playBus);
    ss.vocalChain.src.start(0, Math.min(off, recState.micBuf.duration));
  }

  ss.playing            = true;
  ss.playStartCtxTime   = ctx.currentTime;
  ss.playStartBufOffset = off;

  document.getElementById('studio-play-btn').textContent = '⏸ PAUSE';
  document.getElementById('studio-play-btn').classList.add('playing');
  studioAnimLoop();
}

function studioPause() {
  destroyChain(studioState.instChain);  studioState.instChain  = null;
  destroyChain(studioState.drumChain);  studioState.drumChain  = null;
  destroyChain(studioState.vocalChain); studioState.vocalChain = null;

  console.log('[REC-DEBUG] ====== studioPause() 実行 (destroyChain後) ======');
  _debugBufferStats('studioPause後 recState.omniBuf(原本)', recState.omniBuf);
  _debugBufferStats('studioPause後 recState.drumBuf(原本)', recState.drumBuf);

  if (studioState.playing && studioState.ctx) {
    studioState.playStartBufOffset += studioState.ctx.currentTime - studioState.playStartCtxTime;
  }
  studioState.playing = false;
  if (studioState.animFrame) { cancelAnimationFrame(studioState.animFrame); studioState.animFrame = null; }
  document.getElementById('studio-play-btn').textContent = '▶ PLAY';
  document.getElementById('studio-play-btn').classList.remove('playing');
}

function studioStop() {
  studioPause();
  studioState.playStartBufOffset = 0;
  studioUpdateTime(0);
}

function studioAnimLoop() {
  if (!studioState.playing) return;
  const elapsed = studioState.ctx.currentTime - studioState.playStartCtxTime;
  const pos = studioState.playStartBufOffset + elapsed;
  studioUpdateTime(pos);
  studioDrawPlayhead(pos);
  const dur = recState.instBuf ? recState.instBuf.duration : (recState.drumBuf ? recState.drumBuf.duration : (recState.micBuf ? recState.micBuf.duration : 0));
  if (pos >= dur) { studioStop(); return; }
  studioState.animFrame = requestAnimationFrame(studioAnimLoop);
}

function studioUpdateTime(sec) {
  document.getElementById('studio-time').textContent =
    String(Math.floor(sec/60)).padStart(1,'0') + ':' + String(Math.floor(sec%60)).padStart(2,'0');
}

// ── Waveform drawing ──────────────────────────────────────────────────────────
//
// ★重要★ 以前は studioDrawPlayhead() が再生アニメーションループ
// （requestAnimationFrame、秒間約60回）から毎フレーム studioDrawWaveform() を
// 呼んでおり、そのたびに recState.omniBuf / recState.drumBuf の
// getChannelData(0)（実データそのもの）を丸ごと読み直していた。
//
// 「MIX STUDIOで再生を繰り返すと左チャンネルだけが徐々に劣化する」不具合を
// デバッグログで調査した結果、劣化は再生開始のAPI呼び出し自体ではなく
// 「実際に音が鳴っている時間」に比例して進行し、かつ recState.omniBuf と
// recState.drumBuf の"左チャンネル(channel 0)だけ"が劣化する、という
// 特徴的なパターンが確認された。コード全体の中で「再生中に毎フレーム
// 両バッファのチャンネル0だけを繰り返し読み取っている」箇所はここ
// （studioDrawWaveform経由のgetChannelData(0)呼び出し）以外に存在しない。
//
// 波形の見た目（ピクセル単位の最大振幅）は録音内容が変わらない限り不変なので、
// MIX STUDIOを開いた時（＝新しい波形データが確定した時）に一度だけ計算して
// キャッシュしておき、再生中の毎フレーム描画はキャッシュされた配列だけを見て
// 行うように変更した。これにより、再生中にバッファの実データへ一切
// アクセスしなくなる。
function computeWaveformCache() {
  const canvas = document.getElementById('studio-canvas');
  const W = (canvas && canvas.offsetWidth) || 300;
  const cache = { width: W, tracks: [] };

  const tracks = [
    { buf: recState.omniBuf, color: 'rgba(79,195,247,0.7)' },
    { buf: recState.drumBuf, color: 'rgba(212,224,64,0.6)' },
    { buf: recState.micBuf,  color: 'rgba(167,139,250,0.55)' },
  ];
  for (const { buf, color } of tracks) {
    if (!buf) { cache.tracks.push(null); continue; }
    const data = buf.getChannelData(0);
    const step = Math.ceil(data.length / W);
    const peaks = new Float32Array(W);
    for (let x = 0; x < W; x++) {
      let max = 0;
      for (let j = 0; j < step; j++) { const v = Math.abs(data[x * step + j] || 0); if (v > max) max = v; }
      peaks[x] = max;
    }
    cache.tracks.push({ peaks, color });
  }

  studioState._waveformCache = cache;
  if (typeof REC_DEBUG_ENABLED !== 'undefined' && REC_DEBUG_ENABLED) {
    console.log('[REC-DEBUG] computeWaveformCache: 波形キャッシュを計算しました (width=' + W + ')');
  }
  return cache;
}

function studioDrawWaveform() {
  const canvas = document.getElementById('studio-canvas');
  if (!canvas) return;
  const W = canvas.offsetWidth || 300;
  const H = 60;

  // キャッシュが無い、または表示幅が変わった場合のみバッファを読んで再計算する。
  // 再生中に幅が変わることは通常ないため、再生アニメーション中にここへは来ない。
  if (!studioState._waveformCache || studioState._waveformCache.width !== W) {
    computeWaveformCache();
  }

  canvas.width  = W * devicePixelRatio;
  canvas.height = H * devicePixelRatio;
  const ctx2d = canvas.getContext('2d');
  ctx2d.scale(devicePixelRatio, devicePixelRatio);
  studioState.canvasCtx = ctx2d;
  ctx2d.fillStyle = '#060e18';
  ctx2d.fillRect(0, 0, W, H);

  for (const track of studioState._waveformCache.tracks) {
    if (!track) continue;
    const { peaks, color } = track;
    ctx2d.strokeStyle = color;
    ctx2d.lineWidth   = 1;
    ctx2d.beginPath();
    for (let x = 0; x < W; x++) {
      const max = peaks[x];
      const y = (1 - max) * H / 2, h = max * H;
      if (x === 0) ctx2d.moveTo(x, H / 2);
      ctx2d.lineTo(x, y); ctx2d.lineTo(x, y + h);
    }
    ctx2d.stroke();
  }
}

function studioDrawPlayhead(pos) {
  const canvas = document.getElementById('studio-canvas');
  if (!canvas || !studioState.canvasCtx) return;
  studioDrawWaveform();
  const W = canvas.offsetWidth || 300;
  const H = 60;
  const dur = recState.instBuf ? recState.instBuf.duration : (recState.drumBuf ? recState.drumBuf.duration : (recState.micBuf ? recState.micBuf.duration : 1));
  const x = (pos / dur) * W;
  studioState.canvasCtx.strokeStyle = 'rgba(232,201,90,0.9)';
  studioState.canvasCtx.lineWidth   = 1.5;
  studioState.canvasCtx.beginPath();
  studioState.canvasCtx.moveTo(x, 0); studioState.canvasCtx.lineTo(x, H);
  studioState.canvasCtx.stroke();
}

// ── Offline render helpers (rewritten for dual-channel) ───────────────────────

// OTT をオフライン OfflineAudioContext で適用
function buildOfflineOtt(offCtx, destNode, amt) {
  if (amt < 1) return null;
  const a = amt / 100;
  const inputG = offCtx.createGain(); inputG.gain.value = 1.0;
  const lpf1  = offCtx.createBiquadFilter(); lpf1.type='lowpass';  lpf1.frequency.value=250;  lpf1.Q.value=0.5;
  const hpf1  = offCtx.createBiquadFilter(); hpf1.type='highpass'; hpf1.frequency.value=250;  hpf1.Q.value=0.5;
  const lpf2  = offCtx.createBiquadFilter(); lpf2.type='lowpass';  lpf2.frequency.value=4000; lpf2.Q.value=0.5;
  const hpf2  = offCtx.createBiquadFilter(); hpf2.type='highpass'; hpf2.frequency.value=4000; hpf2.Q.value=0.5;
  const mkC = (th,ra,atk,rel) => { const c=offCtx.createDynamicsCompressor(); c.threshold.value=th; c.ratio.value=ra; c.knee.value=4; c.attack.value=atk; c.release.value=rel; return c; };
  const compL = mkC(-24+(1-a)*18, 2+a*4, 0.030, 0.200);
  const compM = mkC(-30+(1-a)*20, 2+a*3, 0.010, 0.080);
  const compH = mkC(-28+(1-a)*18, 2+a*3.5, 0.003, 0.060);
  const gainL = offCtx.createGain(); gainL.gain.value = 1.0+a*0.15;
  const gainM = offCtx.createGain(); gainM.gain.value = 1.0+a*0.35;
  const gainH = offCtx.createGain(); gainH.gain.value = 1.0+a*0.20;
  const outG  = offCtx.createGain(); outG.gain.value  = 0.50;
  inputG.connect(lpf1); inputG.connect(hpf1);
  hpf1.connect(lpf2); hpf1.connect(hpf2);
  lpf1.connect(compL); compL.connect(gainL); gainL.connect(outG);
  lpf2.connect(compM); compM.connect(gainM); gainM.connect(outG);
  hpf2.connect(compH); compH.connect(gainH); gainH.connect(outG);
  outG.connect(destNode);
  return { inputNode: inputG };
}

// MIC channel offline render: gain(dB) → [OTT] → [DeEss] → destination
async function renderVocal(srcBuf) {
  if (!srcBuf) return null;
  const ss  = studioState;
  const sr  = srcBuf.sampleRate;
  const nCh = Math.min(srcBuf.numberOfChannels, 2);
  const off = new OfflineAudioContext(nCh, srcBuf.length, sr);

  const src  = off.createBufferSource(); src.buffer = srcBuf;
  const gain = off.createGain(); gain.gain.value = Math.pow(10, (ss.micGainDb || 0) / 20);
  src.connect(gain);

  let lastNode = gain;

  // OTT
  if (ss.ottAmt >= 1) {
    const ottDest = off.createGain(); ottDest.gain.value = 1.0;
    const ott = buildOfflineOtt(off, ottDest, ss.ottAmt);
    if (ott) { lastNode.connect(ott.inputNode); lastNode = ottDest; }
  }

  // De-Ess
  if (ss.deEssAmt >= 1) {
    const deEssDest = off.createGain(); deEssDest.gain.value = 1.0;
    const bpf = off.createBiquadFilter(); bpf.type='peaking';
    bpf.frequency.value=7000; bpf.Q.value=1.8;
    bpf.gain.value = -(ss.deEssAmt/100)*10;
    lastNode.connect(bpf); bpf.connect(deEssDest);
    lastNode = deEssDest;
  }

  lastNode.connect(off.destination);
  src.start(0);
  return await off.startRendering();
}

// Glue compressor offline
async function applyGlueOffline(srcBuf, amt) {
  if (!srcBuf || amt < 1) return srcBuf;
  const sr  = srcBuf.sampleRate;
  const nCh = Math.min(srcBuf.numberOfChannels, 2);
  const off = new OfflineAudioContext(nCh, srcBuf.length, sr);
  const src = off.createBufferSource(); src.buffer = srcBuf;
  const a = amt / 100;
  const comp = off.createDynamicsCompressor();
  comp.threshold.value = a > 0.01 ? -6 - a * 14 : 0;
  comp.ratio.value     = a > 0.01 ? 1.5 + a * 2.0 : 1.0;
  comp.knee.value      = 8;
  comp.attack.value    = 0.020;
  comp.release.value   = 0.080;
  src.connect(comp); comp.connect(off.destination);
  src.start(0);
  return await off.startRendering();
}

// Bus Reverb offline: buildReverbIR を使ったコンボリューションリバーブ
// busRvb: 0-100 (wet量), rvbSize: 0-100 (部屋サイズ)
async function applyBusRvbOffline(srcBuf, busRvb, rvbSize) {
  if (!srcBuf || busRvb < 1) return srcBuf;
  const wet  = busRvb / 100;
  const size = rvbSize / 100;
  const sr   = srcBuf.sampleRate;
  const nCh  = Math.min(srcBuf.numberOfChannels, 2);
  // リバーブのテール分だけ長さを延長
  const tailSamp = Math.floor(sr * (0.4 + size * 2.5));
  const len  = srcBuf.length + tailSamp;
  const off  = new OfflineAudioContext(nCh, len, sr);

  const src  = off.createBufferSource(); src.buffer = srcBuf;
  const dryG = off.createGain(); dryG.gain.value = 1.0 - wet;
  const wetG = off.createGain(); wetG.gain.value = wet;
  const conv = off.createConvolver(); conv.normalize = true;
  conv.buffer = buildReverbIR(off, size, 0.55, 18);

  src.connect(dryG);
  src.connect(conv);
  conv.connect(wetG);
  dryG.connect(off.destination);
  wetG.connect(off.destination);
  src.start(0);
  return await off.startRendering();
}

// ── Export ─────────────────────────────────────────────────────────────────────

// ── サンプル単位減算: instBuf（omni+drum）- drumBuf（drum）= omniのみ ─────────
// 音の接続は変えず、オフライン処理で omni を分離する
// drumBus は recBus → nativeComp → nativeLimiter → masterOut を経由するため
// masterOut の drumBuf と drumBus の drumBuf はゲインが異なる可能性がある。
// そのためまず drumBuf を同じ経路（nativeComp + nativeLimiter + masterOut gain）で
// レンダリングし、instBuf から引き算することで omni のみを得る。
async function subtractBuffers(fullBuf, subBuf) {
  if (!fullBuf) return null;
  if (!subBuf)  return fullBuf;  // drumがなければそのまま返す
  const sr   = fullBuf.sampleRate;
  const nCh  = Math.min(fullBuf.numberOfChannels, 2);
  const len  = fullBuf.length;
  const out  = new AudioBuffer({ numberOfChannels: nCh, length: len, sampleRate: sr });
  for (let c = 0; c < nCh; c++) {
    const full = fullBuf.getChannelData(c);
    const sub  = subBuf.numberOfChannels > c ? subBuf.getChannelData(c) : new Float32Array(len);
    const dst  = out.getChannelData(c);
    for (let i = 0; i < len; i++) {
      dst[i] = full[i] - (i < sub.length ? sub[i] : 0);
    }
  }
  return out;
}

// drumBuf を masterOut と同じゲイン/コンプ経路でオフラインレンダリング
// → instBuf との減算でゲイン差をキャンセル
async function renderDrumForSubtraction(srcBuf) {
  if (!srcBuf) return null;
  // drumBus → recBus → nativeComp(threshold=-20,ratio=4) → nativeLimiter(threshold=-3,ratio=20)
  // → masterOut(gain=0.85) の経路を OfflineAudioContext で再現
  const sr  = srcBuf.sampleRate;
  const nCh = Math.min(srcBuf.numberOfChannels, 2);
  const off = new OfflineAudioContext(nCh, srcBuf.length, sr);
  const src = off.createBufferSource(); src.buffer = srcBuf;

  // nativeComp 相当
  const comp = off.createDynamicsCompressor();
  comp.threshold.value = -20; comp.knee.value = 6;
  comp.ratio.value = 4; comp.attack.value = 0.003; comp.release.value = 0.15;
  // nativeLimiter 相当
  const lim = off.createDynamicsCompressor();
  lim.threshold.value = -3; lim.knee.value = 0;
  lim.ratio.value = 20; lim.attack.value = 0.001; lim.release.value = 0.1;
  // masterOut gain 相当
  const masterGain = off.createGain(); masterGain.gain.value = 0.85;

  src.connect(comp); comp.connect(lim); lim.connect(masterGain);
  masterGain.connect(off.destination);
  src.start(0);
  return await off.startRendering();
}

async function studioExport() {
  const exportBtn = document.getElementById('studio-export-btn');
  exportBtn.textContent = '⏳ RENDERING…';
  exportBtn.disabled = true;
  studioPause();

  const doMix   = document.getElementById('chk-mix').checked;
  const doVocal = document.getElementById('chk-vocal').checked;
  const doOmni  = document.getElementById('chk-music').checked;
  const doDrum  = document.getElementById('chk-drum')?.checked;
  const ts      = tsStr();

  try {
    // omniBuf = instBus録音（コンプ前のomniのみ、omni.wav用、処理なしそのまま）
    // drumBuf = drumBus録音（drumのみ、drum.wav用、処理なしそのまま）
    // micBuf  = mic録音（GAIN/OTT/DE-ESSを適用した上でmic.wav用）
    // mix.wav は「omni」+「drum」+「処理済みvocal」を合算して作る。

    const omniR  = recState.omniBuf;
    const drumR  = recState.drumBuf;
    const vocalR = recState.micBuf ? await renderVocal(recState.micBuf) : null;

    console.log('[REC-DEBUG] ====== studioExport() 書き出し直前 ======');
    _debugBufferStats('EXPORT直前 omniR(=recState.omniBuf)', omniR);
    _debugBufferStats('EXPORT直前 drumR(=recState.drumBuf)', drumR);

    async function finalize(buf) {
      if (!buf) return null;
      const ss = studioState;
      const withGlue   = await applyGlueOffline(buf, ss.glueAmt);
      const withBusRvb = await applyBusRvbOffline(withGlue, ss.busRvb, ss.rvbSize);
      return applyLimiterOffline(withBusRvb, ss.limitDb);
    }

    // omni.wav = omniBuf（instBusから直接タップした正確なomni単独信号）
    if (doOmni && omniR) {
      dlBlob(encodeWav(omniR), 'omnitro-omni-'+ts+'.wav');
      await new Promise(r => setTimeout(r, 300));
    }

    // drum.wav = drumBufのみ
    if (doDrum && drumR) {
      dlBlob(encodeWav(drumR), 'omnitro-drum-'+ts+'.wav');
      await new Promise(r => setTimeout(r, 300));
    }

    // mic.wav = micBuf
    if (doVocal && vocalR) {
      dlBlob(encodeWav(vocalR), 'omnitro-mic-'+ts+'.wav');
      await new Promise(r => setTimeout(r, 300));
    }

    // mix.wav = omni + drum（いずれも処理なし） + 処理済みvocal を合算
    if (doMix && (omniR || drumR)) {
      let mixed = await mixBuffers(omniR, drumR);
      if (vocalR) mixed = await mixBuffers(mixed, vocalR);
      dlBlob(encodeWav(await finalize(mixed)), 'omnitro-mix-'+ts+'.wav');
    }

  } catch(e) {
    console.error('[STUDIO] Export error:', e);
    alert('Export failed: ' + e.message);
  }

  exportBtn.textContent = '⬇ EXPORT';
  exportBtn.disabled = false;
}

// Apply master limiter offline (reuse DynamicsCompressor in hard-limit mode)
async function applyLimiterOffline(srcBuf, threshDb) {
  if (!srcBuf) return null;
  const sr  = srcBuf.sampleRate;
  const nCh = Math.min(srcBuf.numberOfChannels, 2);
  const off = new OfflineAudioContext(nCh, srcBuf.length, sr);
  const src = off.createBufferSource(); src.buffer = srcBuf;
  const lim = off.createDynamicsCompressor();
  lim.threshold.value = threshDb; lim.knee.value = 0; lim.ratio.value = 20;
  lim.attack.value = 0.001; lim.release.value = 0.08;
  src.connect(lim); lim.connect(off.destination);
  src.start(0);
  return await off.startRendering();
}

// ── Studio presets ─────────────────────────────────────────────────────────────
// OMNI/DRUMは処理なしで直結のため、プリセットが調整するのはMICのGAINと
// DYNAMICS（OTT/DE-ESS）、および共有バスの処理のみ。
const PRESETS = {
  // FLAT: 完全素通し。全エフェクト無効。録音の確認用。
  flat: {
    micGainDb:0,
    ottAmt:0, deEssAmt:0,
    glueAmt:0, busRvb:0, rvbSize:45, limitDb:-1,
  },
  // CLEAN: エフェクトは最小限。ボーカルと演奏音のバランスを自分で決めたいときに。
  clean: {
    micGainDb:0,
    ottAmt:0, deEssAmt:0,
    glueAmt:0, busRvb:0, rvbSize:45, limitDb:-1,
  },
  // WARM: MICを軽くブースト + OTT軽め + Glue Compで自然にまとめる。日常的な弾き語りに。
  warm: {
    micGainDb:3,
    ottAmt:35, deEssAmt:20,
    glueAmt:30, busRvb:15, rvbSize:40, limitDb:-1,
  },
  // DEEP: MICをしっかりブースト + OTT強め + Bus Reverbで豊かな空間感。
  deep: {
    micGainDb:6,
    ottAmt:60, deEssAmt:35,
    glueAmt:45, busRvb:35, rvbSize:55, limitDb:-1,
  },
};

function applyPreset(name) {
  const p = PRESETS[name];
  if (!p) return;
  const ss = studioState;
  ss.micGainDb = p.micGainDb;
  ss.ottAmt   = p.ottAmt;       ss.deEssAmt = p.deEssAmt;
  ss.glueAmt  = p.glueAmt;      ss.busRvb   = p.busRvb;
  ss.rvbSize  = p.rvbSize;      ss.limitDb  = p.limitDb;

  const set = (id, val, fmtFn) => {
    const el = document.getElementById(id); if(el) el.value = val;
    const vl = document.getElementById(id.replace(/^s-/,'v-')); if(vl) vl.textContent = fmtFn ? fmtFn(val) : val;
  };
  set('s-mic-gain',  p.micGainDb, v=>v+' dB');
  set('s-ott',       p.ottAmt,   v=>v);
  set('s-deess',     p.deEssAmt, v=>v);
  set('s-glue',      p.glueAmt,  v=>v);
  set('s-bus-rvb',   p.busRvb,   v=>v);
  set('s-rvb-size',  p.rvbSize,  v=>v);
  set('s-limit',     p.limitDb,  v=>v+' dB');

  document.querySelectorAll('.preset-btn').forEach(b => b.classList.toggle('active', b.dataset.preset === name));

  const wasPlaying = ss.playing;
  const pos = wasPlaying ? ss.playStartBufOffset + (ss.ctx.currentTime - ss.playStartCtxTime) : ss.playStartBufOffset;
  studioGraphBuild();
  if (wasPlaying) studioPlay(pos);
}

function setupMixStudio() {
  ['studio-discard-btn','studio-discard2-btn'].forEach(id => {
    document.getElementById(id).addEventListener('click', () => {
      if (confirm('Discard this recording? All audio data will be released.')) discardRecording();
    });
  });

  document.getElementById('studio-play-btn').addEventListener('click', () => {
    if (studioState.playing) studioPause(); else studioPlay();
  });
  document.getElementById('studio-stop-btn').addEventListener('click', studioStop);

  document.getElementById('studio-canvas').addEventListener('click', e => {
    const W = e.currentTarget.offsetWidth;
    const dur = recState.instBuf ? recState.instBuf.duration : (recState.drumBuf ? recState.drumBuf.duration : (recState.micBuf ? recState.micBuf.duration : 1));
    const pos = (e.offsetX / W) * dur;
    studioState.playStartBufOffset = pos;
    studioUpdateTime(pos);
    studioDrawPlayhead(pos);
    if (studioState.playing) studioPlay(pos);
  });

  document.querySelectorAll('.preset-btn').forEach(btn => {
    btn.addEventListener('click', () => applyPreset(btn.dataset.preset));
  });

  // Mic dynamics + bus sliders
  const BUS_REBUILD = true;
  const chSliders = [
    ['s-mic-gain',   'micGainDb',   v=>v,     v=>v+' dB', false],
    ['s-ott',        'ottAmt',      v=>v,     v=>v,   false],
    ['s-deess',      'deEssAmt',    v=>v,     v=>v,   false],
    ['s-glue',       'glueAmt',     v=>v,     v=>v,   BUS_REBUILD],
    ['s-bus-rvb',    'busRvb',      v=>v,     v=>v,       BUS_REBUILD],
    ['s-rvb-size',   'rvbSize',     v=>v,     v=>v,       BUS_REBUILD],
    ['s-limit',      'limitDb',     v=>v,     v=>v+' dB', false],
  ];

  chSliders.forEach(([inputId, key, storeVal, fmtFn, rebuild]) => {
    const el = document.getElementById(inputId);
    if (!el) return;
    const valId = inputId.replace(/^s-/, 'v-');
    const vl = document.getElementById(valId);
    el.addEventListener('input', () => {
      const raw = parseFloat(el.value);
      studioState[key] = storeVal(raw);
      if (vl) vl.textContent = fmtFn(raw);
      document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));

      const wasPlaying = studioState.playing;
      const pos = wasPlaying
        ? studioState.playStartBufOffset + (studioState.ctx.currentTime - studioState.playStartCtxTime)
        : studioState.playStartBufOffset;

      if (rebuild) {
        // Tape: rebuild full graph (topology changes)
        studioGraphBuild();
        if (wasPlaying) studioPlay(pos);
      } else if (wasPlaying) {
        // All others: hot-swap sources (stop current sources, restart with new settings)
        studioPlay(pos);
      }
    });
  });

  document.getElementById('studio-export-btn').addEventListener('click', studioExport);
}

// ── Mic settings wiring ────────────────────────────────────────────────────────
