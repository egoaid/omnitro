// ─── TONE.JS SETUP ────────────────────────────────────────────────────────────
let chordSynth, strumSynth, subSynth;
let chordGain, strumGain, strumTremoloGain, strumNativeGain, subGain, drumGain;
let strumTremoloLfo, strumTremoloMod;
let masterComp, masterLimiter, masterVol;
let audioReady = false;

async function ensureAudio() {
  if (audioReady) return;
  await Tone.start();
  audioReady = true;

  const ctx = Tone.getContext().rawContext;

  // ── Master chain: 100% native Web Audio ─────────────────────────────────
  //
  //  chordGain ──┐
  //  subGain   ──┼──► recBus ──► nativeComp ──► nativeLimiter ──► masterOut
  //  drumGain  ──┤                                                 ├──► ctx.destination
  //  strumGain ──┘                                                 └──► rec.tap (recording)
  //
  // All gain nodes are native GainNodes — no Tone.js wrappers in the chain.
  // Tone.js synths connect to native GainNodes via .connect(nativeNode).

  // Final output gain — recording taps here in parallel with speakers
  const masterOut = ctx.createGain();
  masterOut.gain.value = 0.85;
  masterOut.connect(ctx.destination);
  window._recMasterOut = masterOut;   // recording code reads this

  // Limiter
  const nativeLimiter = ctx.createDynamicsCompressor();
  nativeLimiter.threshold.value = -3;
  nativeLimiter.knee.value      = 0;
  nativeLimiter.ratio.value     = 20;
  nativeLimiter.attack.value    = 0.001;
  nativeLimiter.release.value   = 0.1;
  nativeLimiter.connect(masterOut);

  // Bus compressor
  const nativeComp = ctx.createDynamicsCompressor();
  nativeComp.threshold.value = -20;
  nativeComp.knee.value      = 6;
  nativeComp.ratio.value     = 4;
  nativeComp.attack.value    = 0.003;
  nativeComp.release.value   = 0.15;
  nativeComp.connect(nativeLimiter);

  // Summing bus
  const recBus = ctx.createGain();
  recBus.gain.value = 1.0;
  recBus.connect(nativeComp);
  window._recBus = recBus;

  // ── Per-source gain nodes ────────────────────────────────────────────────
  //
  // 設計:
  //   instBus ─── chord/strum/sub ──┐
  //                                  ├──► nativeComp → nativeLimiter → masterOut → ctx.destination
  //   drumBus ─── drum ─────────────┘
  //
  //   録音タップ:
  //     instMR ← instBus（omniのみ、drum混入なし）
  //     drumMR ← drumBus（drumのみ）
  //     mix録音 ← masterOut（全体: コンプ/リミッター通過後）
  //
  //   instBus/drumBus は両方 nativeComp に接続して ctx.destination まで繋がるため
  //   MediaStreamDestinationNode の track は確実に live になる

  // instBus: chord/strum/sub → nativeComp
  const instBus = ctx.createGain(); instBus.gain.value = 1.0;
  instBus.connect(nativeComp);
  window._instBus = instBus;

  // drumBus: drum → nativeComp（instBusと同じ先に合流）
  const drumBus = ctx.createGain(); drumBus.gain.value = 1.0;
  drumBus.connect(nativeComp);
  window._drumBus = drumBus;

  // chord/sub → instBus
  const mkGain = (v) => { const g = ctx.createGain(); g.gain.value = v; g.connect(instBus); return g; };
  chordGain = mkGain(0.32);
  subGain   = mkGain(0.25);

  // drumGain → drumBus
  drumGain = ctx.createGain(); drumGain.gain.value = 0.56;
  drumGain.connect(drumBus);

  // recBus はもう使わないが window._recBus として保持（互換性のため）
  // masterLimiter stub は recBus の代わりに instBus を指す
  window._recBus = instBus;

  // Compatibility stubs
  masterLimiter = { input: instBus };  // instBus が新しい合流点
  masterComp    = {};
  masterVol     = { volume: { value: -2 } };
  window._recNativeOut = masterOut;

  // ── Strum chain (native) ─────────────────────────────────────────────
  strumNativeGain = ctx.createGain();
  strumNativeGain.gain.value = 1.0;
  strumNativeGain.connect(instBus);  // instBus → nativeComp（omni stem に含める）

  strumTremoloGain = ctx.createGain();
  strumTremoloGain.gain.value = 1.0;
  strumTremoloGain.connect(strumNativeGain);

  strumTremoloLfo = ctx.createOscillator();
  strumTremoloLfo.type = 'sine';
  strumTremoloLfo.frequency.value = state.tremoloRate;
  strumTremoloMod = ctx.createGain();
  strumTremoloMod.gain.value = state.tremoloDepth * 0.22;
  strumTremoloGain.gain.setValueAtTime(1.0, ctx.currentTime);
  strumTremoloLfo.connect(strumTremoloMod);
  strumTremoloMod.connect(strumTremoloGain.gain);
  strumTremoloLfo.start();

  strumGain = { _nativeNode: strumTremoloGain };

  updateVoice('omni1');

  // gainノード生成後にスライダーの現在値を全て適用
  const _applySliders = () => {
    const byId = id => document.getElementById(id);
    if (drumGain)       { const s = byId('vol-rhythm');  if (s) drumGain.gain.value       = parseInt(s.value) / 100 * 0.7; }
    if (chordGain)      { const s = byId('vol-chord');   if (s) chordGain.gain.value       = parseInt(s.value) / 100 * 0.46; }
    if (window._recNativeOut) { const s = byId('vol-master'); if (s) window._recNativeOut.gain.value = parseInt(s.value) / 100; }
    syncStrumplateVolumes();
  };
  _applySliders();

  // 単一経路キャプチャ（録音）グラフを構築。ここでの失敗はライブ演奏には
  // 一切影響しない（録音機能のみ無効化され、REC開始時にエラーを表示する）。
  recCaptureInit().catch(e => console.warn('[REC] recCaptureInit failed:', e.message));
}

function syncStrumplateVolumes() {
  const main = Math.max(0, Number.isFinite(state.volumes.main) ? state.volumes.main : 0.8);
  const sub  = Math.max(0, Number.isFinite(state.volumes.sub) ? state.volumes.sub : 0.4);

  if (strumSynth) {
    // Default at 80% -> original peak; 0 mutes; 100% gives a small lift.
    strumSynth.gainVal = 0.22 * (main / 0.8);
    // Sub layer is mixed inside the strum synth so the slider always affects audible output.
    strumSynth.subGainVal = 0.08 * (sub / 0.4);
  }
}

// ネイティブAudioNodeを取得するヘルパー
// chordGain等はネイティブGainNodeになったのでそのまま返す
function getNativeNode(toneNode) {
  if (!toneNode) return Tone.getContext().rawContext.destination;
  // Native AudioNode — return directly
  if (toneNode instanceof AudioNode) return toneNode;
  // Tone.js wrapper — dig for native node
  if (toneNode.input && toneNode.input instanceof AudioNode) return toneNode.input;
  if (toneNode._gainNode instanceof AudioNode) return toneNode._gainNode;
  // masterLimiter stub — return recBus
  if (toneNode.input instanceof AudioNode) return toneNode.input;
  return window._recBus || Tone.getContext().rawContext.destination;
}


// Tone.jsのPolySynth制限を完全に回避するWeb Audio APIネイティブ実装
// 各ノートを独立したOscillator+GainNodeで生成し使い捨てる
