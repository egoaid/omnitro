// ─── STATE ───────────────────────────────────────────────────────────────────
const state = {
  strumPolyphony: 2,    // 1/2/3 — UI setting only, NativeStrumSynth already overlaps freely
  selectedRoot: null,   // e.g. 'C'
  selectedType: 'major',
  currentChord: null,
  isPlaying: false,
  tempo: 80,
  beat: 0,
  voice: 'omni1',
  volumes: { master: 0.8, chord: 0.7, main: 0.8, sub: 0.4, sustain: 0.6, rhythm: 0.45 },
  transpose: 0,
  octaveShift: 0,
  tuneCents: 0,
  chordAuto: false,
  chordHold: true,
  strumActive: false,
  lastStrumX: null,
  tremoloRate: 5.0,   // Hz
  tremoloDepth: 0.7,  // 深め（0=なし、1=最大）
  midiStrumMode: false, // false=通常の半音階演奏 / true=MIDIノートをストラムプレートの音配列に強制マッピング
};

