// ─── CHORD PLAYBACK ───────────────────────────────────────────────────────────
// 現在鳴っているコードの音符を保持（releaseに使う）
let activeChordNotes = [];
let activeSubNotes = [];
// パニック後フラグ: 次のplayChord呼び出し時にchordSynthを再構築する
let chordNeedsRebuild = false;

function getSubNotes(transposed) {
  const def = VOICE_DEFS[state.voice] || VOICE_DEFS['omni1'];
  const subDef = normalizeSubDef(def.sub);

  if (subDef.type === 'strings8') {
    return [
      ...transposed,
      ...transposed.map(n => Tone.Frequency(n).transpose(-12).toNote()),
    ].slice(0, 5);
  }

  if (subDef.type === 'pad' || subDef.type === 'tremolo' || subDef.type === 'strings') {
    return transposed.slice(0, 5);
  }

  return transposed.slice(0, 5);
}

async function playChord(root, type) {
  await ensureAudio();
  const _pc0 = window._frecOn ? performance.now() : 0; // 計測のみ（挙動は不変）
  let _rebuilt = 0;

  // パニック後フラグが立っている場合: chordSynthを再構築してからアタック。
  // これにより旧ボイスのリリーステールが完全に消えた後に
  // クリーンな状態で新しい発音が始まる（濁り防止）。
  if (chordNeedsRebuild) {
    _rebuilt = 1;
    updateVoice(state.voice);
    chordNeedsRebuild = false;
  }

  // 前の音を即座にリリース
  releaseChord();

  const notes = getChordNotes(root, type, 4 + state.octaveShift);
  const transposed = notes.map(n => Tone.Frequency(n).transpose(state.transpose).toNote());
  activeChordNotes = transposed;

  // triggerAttack: 明示的にreleaseするまで鳴り続ける
  chordSynth.triggerAttack(transposed, Tone.now());
  if (_pc0) {
    const dt = performance.now() - _pc0;
    omniProfEnd('playChord', _pc0);
    let av = 0; try { av = chordSynth.activeVoices | 0; } catch (e) {}
    frec(FREC.PLAY, transposed.length, dt, _rebuilt, av);
  }
}

function releaseChord() {
  if (activeChordNotes.length > 0) {
    const _rl0 = window._frecOn ? performance.now() : 0;
    const _n = activeChordNotes.length;
    try { chordSynth.triggerRelease(activeChordNotes, Tone.now()); } catch(e){}
    activeChordNotes = [];
    if (_rl0) { omniProfEnd('releaseChord', _rl0); frec(FREC.REL, _n, performance.now() - _rl0); }
  }
  activeSubNotes = [];
}

// ─── STRUMPLATE ───────────────────────────────────────────────────────────────
let lastArpX    = -1;
let lastArpNote = null;   // 1本目の指の直前発音ノート。同一ノートの重複発音を防ぐ
const STRUM_THRESHOLD = 8;

