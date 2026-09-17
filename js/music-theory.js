// ─── MUSIC THEORY ─────────────────────────────────────────────────────────────
const NOTES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
const NOTE_DISPLAY = ['C','C♯','D','D♯','E','F','F♯','G','G♯','A','A♯','B'];
const BLACK_NOTES = new Set([1,3,6,8,10]); // index in NOTES

const CHORD_TYPES = {
  // ①4声コードは5度音程を省略
  // ②diminishedはdim7th（4声）、減5度省略 → [0,3,9]
  'major':     { label: 'MAJ',  intervals: [0,4,7] },
  'minor':     { label: 'MIN',  intervals: [0,3,7] },
  '7th':       { label: '7',    intervals: [0,4,10] },      // 5度(7)省略
  'major7th':  { label: 'MAJ7', intervals: [0,4,11] },     // 5度(7)省略
  'minor7th':  { label: 'MIN7', intervals: [0,3,10] },     // 5度(7)省略
  'augmented': { label: 'AUG',  intervals: [0,4,8] },
  'diminished':{ label: 'DIM',  intervals: [0,3,9] },      // dim7th、減5度(6)省略
  'sus4':      { label: 'SUS4', intervals: [0,5,7] },
  'add9th':    { label: 'ADD9', intervals: [0,4,14] },     // 5度(7)省略
};

// Omnichord F# fold-over rule:
// Pitch class >= 6 (F#, G, Ab, A, Bb, B) folds DOWN one octave.
// Pitch classes: C=0,C#=1,D=2,Eb=3,E=4,F=5,F#=6,G=7,Ab=8,A=9,Bb=10,B=11
function applyOmniOctaveFold(noteIdx, octave) {
  return noteIdx >= 6 ? octave - 1 : octave;
}

function getChordNotes(root, type, baseOctave = 4) {
  const rootIdx = NOTES.indexOf(root);
  if (rootIdx < 0) return [];
  const intervals = CHORD_TYPES[type].intervals;
  return intervals.map(interval => {
    const noteIdx = (rootIdx + interval) % 12;
    let octave = baseOctave + Math.floor((rootIdx + interval) / 12);
    octave = applyOmniOctaveFold(noteIdx, octave);
    return NOTES[noteIdx] + octave;
  });
}

// ─── STRUMPLATE ARPEGGIO MODE ─────────────────────────────────────────────────
// 'omnicord' = hardware wiring order (fixed degree order, pitch discontinuities authentic)
// 'regular'  = frequency-sorted smooth ascending arpeggio
let strumArpMode = 'omnicord'; // default: authentic Omnichord order

function buildOmnicordStrumList(root, type) {
  const rootIdx = NOTES.indexOf(root);
  if (rootIdx < 0) return [];
  const intervals = CHORD_TYPES[type].intervals;
  const BASE = 3;
  const allNotes = [];
  for (let g = 0; g < 4; g++) {
    for (const interval of intervals) {
      const noteIdx = (rootIdx + interval) % 12;
      const foldOct = noteIdx >= 6 ? -1 : 0;
      const octave = BASE + g + foldOct;
      allNotes.push(NOTES[noteIdx] + octave);
    }
  }
  const terminalOctave = rootIdx >= 6 ? BASE + 3 : BASE + 4;
  allNotes.push(NOTES[rootIdx] + terminalOctave);
  return allNotes;
}

function buildRegularStrumList(root, type) {
  const base = buildOmnicordStrumList(root, type);
  const ordered = [...base].sort((a, b) => noteNameToMidi(a) - noteNameToMidi(b));
  return ordered.filter((n, i, arr) => i === 0 || n !== arr[i - 1]);
}

function noteNameToMidi(noteName) {
  const match = noteName.match(/^([A-G]#?)(-?\d+)$/);
  if (!match) return Number.POSITIVE_INFINITY;
  const noteIdx = NOTES.indexOf(match[1]);
  const octave = Number(match[2]);
  return (octave + 1) * 12 + noteIdx;
}

function getArpeggioNotes(root, type, position) {
  const allNotes = strumArpMode === 'omnicord'
    ? buildOmnicordStrumList(root, type)
    : buildRegularStrumList(root, type);

  if (!allNotes || allNotes.length === 0) return null;

  const idx = Math.floor(position * allNotes.length);
  return allNotes[Math.min(idx, allNotes.length - 1)];
}

