// ─── AUDIO PERFORMANCE MODE ────────────────────────────────────────────────
// iPad第7世代など非力な端末でストラムプレート演奏時にノイズ・音切れが
// 出る問題について、v1.5.14/v1.5.21でノード生成コストの最適化を行ったが、
// 実機ログ（PERFORMANCE MONITOR）では改善が不十分だった
// （424ノート中350回=82%がvoice steal、フレーム落ちは最大167ms）。
//
// これ以上「音を変えずに」軽量化する余地は使い切ったため、ユーザーの
// 提案に基づき、処理能力に応じてユーザー自身が音質/処理負荷のトレード
// オフを選べる設定を追加する。端末の自動判定は行わない
// （LAYOUT MODEと同じ設計方針）。
//
//   HIGH QUALITY（既定）… 従来通りの完全な音（変更なし）
//   LOW POWER MODE       … ストラムプレートの同時発音数の上限を大幅に
//                           下げ、サブレイヤー（トレモロ/ストリングス等の
//                           重ね音）を省略して負荷を大きく下げる。
//                           音は簡略化されるが、ノイズ・音切れを避けられる。
//
// 影響範囲はストラムプレート（NativeStrumSynth）のみ。RHYTHM ENGINEや
// 保持コード（Tone.PolySynth）、録音・エフェクトには一切影響しない
// （問題が実際に発生しているのがストラムプレート演奏時のみのため）。

const AUDIO_PERF_MODES = ['high', 'low'];
const AUDIO_PERF_STORAGE_KEY = 'omnitro_audio_perf_mode_v1';

function loadAudioPerfMode() {
  try {
    const saved = localStorage.getItem(AUDIO_PERF_STORAGE_KEY);
    if (AUDIO_PERF_MODES.includes(saved)) return saved;
  } catch (e) {}
  return 'high';
}

function saveAudioPerfMode(mode) {
  try { localStorage.setItem(AUDIO_PERF_STORAGE_KEY, mode); } catch (e) {}
}

function setAudioPerfMode(mode) {
  if (!AUDIO_PERF_MODES.includes(mode)) mode = 'high';
  state.audioPerformanceMode = mode;
  saveAudioPerfMode(mode);
  document.querySelectorAll('.audio-perf-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.audioPerf === mode);
  });
}

function setupAudioPerformance() {
  state.audioPerformanceMode = loadAudioPerfMode();
  setAudioPerfMode(state.audioPerformanceMode);
  document.querySelectorAll('.audio-perf-btn').forEach(btn => {
    btn.addEventListener('click', () => setAudioPerfMode(btn.dataset.audioPerf));
  });
}
