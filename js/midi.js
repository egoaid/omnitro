// ─── WEB MIDI API — MIDIキーボード演奏 ─────────────────────────────────────────
//
// 2つのモードを持つ（state.midiStrumModeで切替、SETTINGSの「MIDI STRUM MODE」トグル）:
//
//   ① NORMAL（既定）: 普通のMIDIキーボードとして半音階（クロマチック）でそのまま鳴らす。
//      MIDIノート番号 → Tone.Frequency(note, 'midi').toNote() で直接ピッチに変換。
//
//   ② STRUM: MIDIノート番号をストラムプレート上の position(0〜1) に変換し、
//      getArpeggioNotes() で現在選択中のコードの音配列に強制的にマッピングする。
//      つまり鍵盤のどこを弾いても「今押しているコードの構成音」しか出ない、
//      ストラムプレートをMIDIキーボードで弾いているのと同じ状態になる。
//
//      有効範囲: MIDI 36(C2) 〜 60(C4) = 25鍵（2オクターブ）相当
//      ストラムプレートは4オクターブ分の配列でも実際は13音（buildOmnicordStrumList：
//      3音×4グループ＋ターミナル音1つ）しか鳴らないため、25鍵MIDIキーボード1台分の
//      2オクターブに13音を収めることで、鍵盤の端から端まで使い切れるようにしている。
//      position = clamp((noteNumber - MIDI_LOW) / (MIDI_HIGH - MIDI_LOW), 0, 1)
//      低い鍵盤 → ストラムプレート低音側、高い鍵盤 → 高音側。
//      ※お使いのMIDIキーボードの最低鍵がMIDIノート36(C2)前後に来るよう、
//        キーボード本体のオクターブシフト機能で合わせてください。
//
//   同時押し: ストラムプレートと同様、最大3音同時（_activeVoices は無制限）
//   ベロシティ: MIDI 0〜127 → strum velocity 0.35〜0.85 にマッピング
//   Note Off: triggerAttackRelease は自然減衰なので処理不要

const MIDI_LOW  = 36;  // C2
const MIDI_HIGH = 60;  // C4（MIDI_LOWから2オクターブ＝25鍵）

// 現在MIDIで発音中のノートを追跡（Note Off / Instant Off 用）
const midiHeldNotes = new Map(); // noteNumber → noteName (e.g. "C4")

function midiNoteToStrumPosition(noteNumber) {
  return Math.max(0, Math.min(1, (noteNumber - MIDI_LOW) / (MIDI_HIGH - MIDI_LOW)));
}

function midiVelocityToStrumVelocity(midiVel) {
  return 0.35 + (midiVel / 127) * 0.50;
}

function onMidiNoteOn(noteNumber, velocity) {
  if (velocity === 0) { onMidiNoteOff(noteNumber); return; }

  ensureAudio().then(() => {
    let noteName;

    if (state.midiStrumMode) {
      // ── STRUM MODE: ストラムプレートの音配列に強制マッピング ──────────────
      // 現在選択中のコードが無い場合は音を出さない（ストラムプレート本体と同じ挙動）。
      if (!state.selectedRoot) return;
      const pos = midiNoteToStrumPosition(noteNumber);
      noteName = getArpeggioNotes(state.selectedRoot, state.selectedType, pos);
      if (!noteName) return;
    } else {
      // ── NORMAL MODE: 通常のMIDIキーボードと同じ半音階 ─────────────────────
      noteName = Tone.Frequency(noteNumber, 'midi').toNote();
    }

    const vel = midiVelocityToStrumVelocity(velocity);

    // ストラムプレートと完全に同じ発音経路
    if (strumSynth) strumSynth.triggerAttackRelease(noteName, vel);
    triggerSubAttackRelease(noteName, vel);
    midiHeldNotes.set(noteNumber, noteName);
  });
}

function onMidiNoteOff(noteNumber) {
  // triggerAttackRelease は自然減衰なので Note Off は不要
  midiHeldNotes.delete(noteNumber);
}

function onMidiMessage(event) {
  const [status, note, velocity] = event.data;
  const type = status & 0xF0;
  if (type === 0x90) onMidiNoteOn(note, velocity);  // Note On
  if (type === 0x80) onMidiNoteOff(note);            // Note Off
}

async function setupMidi() {
  if (!navigator.requestMIDIAccess) {
    console.log('[MIDI] Web MIDI API not supported in this browser.');
    return;
  }
  try {
    const midiAccess = await navigator.requestMIDIAccess({ sysex: false });

    function connectInputs() {
      midiAccess.inputs.forEach(input => {
        input.onmidimessage = onMidiMessage;
      });
    }

    connectInputs();

    // デバイスの抜き差しに対応
    midiAccess.onstatechange = () => connectInputs();

    const count = midiAccess.inputs.size;
    console.log(`[MIDI] Ready. ${count} input device(s) connected.`);
  } catch(e) {
    console.warn('[MIDI] Access denied or unavailable:', e.message);
  }
}

