// ─── RHYTHM CONTROLS ─────────────────────────────────────────────────────────
function setupRhythm() {
  const playBtn = document.getElementById('play-btn');
  const tempoSlider = document.getElementById('ctrl-tempo');
  const tempoValue = document.getElementById('val-tempo');

  const applyTempo = (value) => {
    state.tempo = value;
    if (tempoSlider) tempoSlider.value = String(value);
    if (tempoValue) tempoValue.textContent = String(value);
    Tone.Transport.bpm.value = value;
  };

  applyTempo(state.tempo);
  if (tempoSlider) {
    tempoSlider.addEventListener('input', () => {
      applyTempo(parseInt(tempoSlider.value));
    });
  }

  playBtn.addEventListener('click', async () => {
    await ensureAudio();
    if (!kickSynth) initDrums();
    const rhythmSlider = document.getElementById('vol-rhythm');
    if (rhythmSlider && drumGain) {
      drumGain.gain.value = parseInt(rhythmSlider.value) / 100 * 0.7;
    }
    // INTRO/FILL/ENDINGのオーケストレーションを含めた開始/停止に統一
    // （state.isPlaying の切り替え・ボタン表示の同期も toggleRhythmArrangement 側で行う）
    toggleRhythmArrangement();
  });

  // 設定画面のパターン選択: rhythm-select-settingsの変更はloadPatternByNameで統一処理
  const settingsSel = document.getElementById('rhythm-select-settings');
  const hiddenSel   = document.getElementById('rhythm-select');
  if (settingsSel && hiddenSel) {
    settingsSel.addEventListener('change', () => {
      loadPatternByName(settingsSel.value);
    });
  }

  // Settings KIT dropdown
  const kitSelSettings = document.getElementById('kit-select-settings');
  if (kitSelSettings) {
    kitSelSettings.addEventListener('change', () => onKitSelectChange(kitSelSettings.value));
  }

  // Rhythm Editor KIT dropdown
  const kitSelReditor = document.getElementById('kit-select-reditor');
  if (kitSelReditor) {
    kitSelReditor.addEventListener('change', () => onKitSelectChange(kitSelReditor.value));
  }

  // Kit Editor KIT dropdown
  const kitSelEditor = document.getElementById('kit-select-editor');
  if (kitSelEditor) {
    kitSelEditor.addEventListener('change', () => onKitSelectChange(kitSelEditor.value));
  }

  // Rhythm Editor テンポスライダー
  const reditorTempo = document.getElementById('reditor-tempo');
  const reditorTempoVal = document.getElementById('reditor-tempo-val');
  if (reditorTempo) {
    reditorTempo.value = String(state.tempo);
    if (reditorTempoVal) reditorTempoVal.textContent = String(state.tempo);
    reditorTempo.addEventListener('input', () => {
      const v = parseInt(reditorTempo.value);
      state.tempo = v;
      if (reditorTempoVal) reditorTempoVal.textContent = String(v);
      // settings の tempo スライダーも同期
      const ctrlTempo = document.getElementById('ctrl-tempo');
      const valTempo  = document.getElementById('val-tempo');
      if (ctrlTempo) ctrlTempo.value = String(v);
      if (valTempo)  valTempo.textContent = String(v);
      Tone.Transport.bpm.value = v;
    });
  }

  // エディターを開くボタン
  const openBtn = document.getElementById('open-reditor-btn');
  if (openBtn) openBtn.addEventListener('click', () => openRhythmEditor());
}


