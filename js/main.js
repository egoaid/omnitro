// ─── INIT ─────────────────────────────────────────────────────────────────────

// バージョンは js/version.js（APP_VERSION）が唯一の情報源。
console.log('%c[omnitro] build: ' + window._omniBuild, 'color:#2ecc71;font-weight:bold;');

buildChordGrid();
buildSimpleChordGrid();
buildVoiceGrid();
document.getElementById('header-voice').textContent = VOICE_DEFS[state.voice].label;
setupStrumplate();
setupSettings();
setupRhythm();
setupRhythmEditor();
setupKeyboard();
setupRecording();
setupMicSettings();
setupMixStudio();
setupInstantOff();
setupKitEditor();
setChordMode(true);
setupMidi();
setupManual();
setupArrangementUI();
setupWakeLock();
setupUpdateCheck();
setupLayoutMode();
setupAudioPerformance();

// 起動時に最初のプリセットをロード（editorStateとselectを初期化）
loadPatternByName('lofi01');

// ─── PWA: Service Worker登録 ─────────────────────────────────────────────────
// index.html と同じディレクトリに manifest.json / sw.js / icon-*.png が
// 揃っている場合のみオフライン対応・ホーム画面追加が有効になる。
// ファイルが見つからない場合は静かに失敗し、通常のブラウザ動作を継続する。
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {
      // sw.js が同階層に無い環境（単体HTMLとして開いた場合など）は無視
    });
  });
}
