// ─── SETTINGS CONTROLS ────────────────────────────────────────────────────────
function setupSettings() {
  const byId = id => document.getElementById(id);

  // パネル開閉
  byId('settings-btn').addEventListener('click', () =>
    byId('settings-overlay').classList.add('open'));
  byId('close-settings').addEventListener('click', () =>
    byId('settings-overlay').classList.remove('open'));

  // ── Strum Polyphony ──
  const polySlider = byId('ctrl-strum-poly');
  const polyVal    = byId('val-strum-poly');
  if (polySlider && polyVal) {
    polySlider.addEventListener('input', () => {
      state.strumPolyphony = parseInt(polySlider.value);
      polyVal.textContent  = polySlider.value;
    });
  }

  // ── ボリュームスライダー ──
  const volMap = [
    ['master',  'vol-master',  'val-master',  80, v => { if (window._recNativeOut) window._recNativeOut.gain.value = v; }],
    ['chord',   'vol-chord',   'val-chord',   70, v => {
      if (chordGain) chordGain.gain.value = v * 0.46;
    }],
    ['main',    'vol-main',    'val-main',    80, v => { state.volumes.main = v; syncStrumplateVolumes(); }],
    ['sub',     'vol-sub',     'val-sub',     40, v => { state.volumes.sub = v; syncStrumplateVolumes(); }],
    ['sustain', 'vol-sustain', 'val-sustain', 60, v => {
      state.volumes.sustain = v;
      if (audioReady) updateVoice(state.voice);
    }],
    ['rhythm',  'vol-rhythm',  'val-rhythm',  80, v => { if (drumGain) drumGain.gain.value = v * 0.7; }],
  ];
  volMap.forEach(([key, inputId, valId, def, apply]) => {
    const input = byId(inputId);
    const valEl = byId(valId);
    if (!input || !valEl) return;
    input.value = def;
    valEl.textContent = def;
    // 初期値を即時適用（gainノードとスライダーを整合させる）
    apply(def / 100);
    input.addEventListener('input', () => {
      const v = parseInt(input.value) / 100;
      valEl.textContent = input.value;
      state.volumes[key] = v;
      apply(v);
    });
  });

  // ── トグル ──
  document.querySelectorAll('.toggle').forEach(tog => {
    tog.addEventListener('click', () => tog.classList.toggle('on'));
  });
  const chordAutoTog = byId('tog-chord-auto');
  const chordHoldTog = byId('tog-chord-hold');
  if (chordAutoTog) {
    state.chordAuto = chordAutoTog.classList.contains('on');
  }
  if (chordHoldTog) {
    state.chordHold = chordHoldTog.classList.contains('on');
    chordHoldTog.addEventListener('click', () => {
      state.chordHold = chordHoldTog.classList.contains('on');
      if (!state.chordHold && pressedKeys.size === 0) {
        releaseChord();
        state.selectedRoot = null;
        state.selectedType = 'major';
        state.selectedOmniRoot = null;
        updateChordDisplay();
      }
    });
  }
  if (chordAutoTog) {
    chordAutoTog.addEventListener('click', () => {
      state.chordAuto = chordAutoTog.classList.contains('on');
    });
  }

  // MIDI STRUM MODE: ON=MIDIキーボードをストラムプレートの音配列に強制マッピング
  //                   OFF=通常の半音階（既定）
  const midiStrumTog = byId('tog-midi-strum');
  if (midiStrumTog) {
    state.midiStrumMode = midiStrumTog.classList.contains('on');
    midiStrumTog.addEventListener('click', () => {
      state.midiStrumMode = midiStrumTog.classList.contains('on');
    });
  }
}

function setupInstantOff() {
  const btn = document.getElementById('instant-off');
  if (!btn) return;

  function doInstantOff() {
    // ── 1. NativeStrumSynth: 全アクティブボイスを二段階停止 ─────────────────
    if (strumSynth && strumSynth._activeVoices) {
      strumSynth.panic();
    }

    // ── 2. chordSynth: releaseAll() で自然な余韻を残しながら停止 ─────────────
    if (chordSynth) { try { chordSynth.releaseAll(); } catch(e){} }
    chordNeedsRebuild = true;
    activeChordNotes  = [];
    activeSubNotes    = [];
    // MIDIキーボードで押下中のノートもクリア
    midiHeldNotes.clear();

    // ── 3. subNodes (Tone.js PolySynth群): 同様に余韻を残してリリース ─────────
    subNodes.forEach(n => { try { if (n.releaseAll) n.releaseAll(); } catch(e){} });

    // ── 4. chord hold / 入力状態をリセット ──────────────────────────────────
    pressedKeys.clear();
    mouseHeldKeys.clear();
    kbHeldKeys.clear();
    lastChordKeys.clear();
    activeSession = false;

    // ── 5. UI リセット ──────────────────────────────────────────────────────
    document.querySelectorAll('.simple-key.pressed').forEach(b => b.classList.remove('pressed', 'mouse-held'));
    clearSimpleBadges();
    state.selectedRoot     = null;
    state.selectedType     = 'major';
    state.selectedOmniRoot = null;
    updateChordDisplay();

    // ── 6. ビジュアルフィードバック ──────────────────────────────────────────
    btn.style.borderColor = 'var(--accent2)';
    btn.style.boxShadow   = '0 0 16px rgba(192,57,43,0.7)';
    setTimeout(() => {
      btn.style.borderColor = '';
      btn.style.boxShadow   = '';
    }, 220);
  }

  btn.addEventListener('pointerdown', e => {
    e.preventDefault();
    doInstantOff();
  });
}

