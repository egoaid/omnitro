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

  // パニック後フラグが立っている場合: chordSynthを再構築してからアタック。
  // これにより旧ボイスのリリーステールが完全に消えた後に
  // クリーンな状態で新しい発音が始まる（濁り防止）。
  if (chordNeedsRebuild) {
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
}

function releaseChord() {
  if (activeChordNotes.length > 0) {
    try { chordSynth.triggerRelease(activeChordNotes, Tone.now()); } catch(e){}
    activeChordNotes = [];
  }
  activeSubNotes = [];
}

// ─── STRUMPLATE ───────────────────────────────────────────────────────────────
let lastArpX    = -1;
let lastArpNote = null;   // 1本目の指の直前発音ノート。同一ノートの重複発音を防ぐ
const STRUM_THRESHOLD = 8;

