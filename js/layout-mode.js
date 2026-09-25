// ─── LAYOUT MODE ──────────────────────────────────────────────────────────────
// 端末の種類（UA判定・画面サイズ判定・向き判定）による自動切り替えは行わない。
// ユーザーがSETTINGSから手動で選択したモードのみを常に優先する。
//
//   STANDARD          … 既存のモバイル縦画面レイアウト（変更なし）
//   TABLET_LANDSCAPE  … iPad/Androidタブレットを横向きに持って弾くための
//                        横長レイアウト（共通レイアウト。iPad専用/Android専用の
//                        分岐は作らない）
//   DESKTOP_FULLSCREEN … PCデスクトップ向け。ブラウザのFullscreen APIを
//                        呼び出しつつ、画面全体を演奏・編集スペースとして使う
//
// 実装方式: <body>にクラス（layout-standard / layout-tablet-landscape /
// layout-desktop-fullscreen）を付与し、css/layout-modes.css内のスコープ付き
// ルールで各セクション（STRUM PLATE / SETTINGS / RHYTHM EDITOR / KIT EDITOR /
// MIX STUDIO）を再レイアウトする。JS側のロジック・音声ルーティング・既存の
// portrait/standardレイアウト用DOM構造・既存イベントハンドラーには一切
// 変更を加えていない（純粋にCSSスコープの追加のみ）。

const LAYOUT_MODES = ['standard', 'tablet-landscape', 'desktop-fullscreen'];
const LAYOUT_MODE_STORAGE_KEY = 'omnitro_layout_mode_v1';

function loadLayoutMode() {
  try {
    const saved = localStorage.getItem(LAYOUT_MODE_STORAGE_KEY);
    if (LAYOUT_MODES.includes(saved)) return saved;
  } catch (e) {}
  return 'standard';
}

function saveLayoutMode(mode) {
  try { localStorage.setItem(LAYOUT_MODE_STORAGE_KEY, mode); } catch (e) {}
}

// 現在のレイアウトモードに応じて、再計算が必要な既存UIコンポーネントに
// 通知する（ピアノロールのキャンバス幅、MIX STUDIOの波形キャンバス幅など。
// いずれも「幅が変わったら自分の描画サイズを再計算する」既存の関数を
// そのまま呼び出すだけで、内部ロジックには一切手を入れていない）。
function _notifyLayoutResize() {
  // ピアノロール（RHYTHM EDITOR）: 開いている/初期化済みならキャンバスを再計算
  if (typeof prCanvas !== 'undefined' && prCanvas && typeof prResize === 'function') {
    // レイアウト切り替えのCSSトランジション/リフローが確定した後に実行
    requestAnimationFrame(() => requestAnimationFrame(prResize));
  }
  // MIX STUDIO: 波形キャンバスの再描画（開いている場合のみ意味を持つ）
  if (typeof studioState !== 'undefined' && studioState && studioState.open &&
      typeof studioDrawWaveform === 'function') {
    requestAnimationFrame(() => requestAnimationFrame(studioDrawWaveform));
  }
}

// ── DESKTOP FULLSCREEN専用: ダッシュボードの各タイルを事前初期化 ────────────
// RHYTHM EDITOR / KIT EDITORは通常「開くボタン」を押した瞬間に初めて
// ピアノロールのcanvas初期化・チャンネルストリップ構築が走る設計になって
// いる。DESKTOP FULLSCREENではこれらのタイルがボタン操作なしで最初から
// 常時表示されるため、既存のopenRhythmEditor()/openKitEditor()自体を
// そのまま呼び出して同じ初期化を行わせる（内部ロジックの複製はしない）。
// どちらの関数も内部でaudioContextの起動（ensureAudio）は行わないため、
// ユーザー操作前に呼んでも安全（音を鳴らすボタンは押されたときに個別で
// ensureAudio()する設計になっている）。両関数とも複数回呼んでも安全
// （innerHTML再構築・null チェック済みのcanvas初期化ガードを持つ）。
// MIX STUDIOは録音データが無い状態で開くとalert()が出る設計のため、
// ここでは呼び出さず、録音後に既存のrecStop()→openMixStudio()の流れに
// 任せる（パネル自体は常時表示済みなので、録音後は自動的に中身が入る）。
function _initDashboardPanels() {
  try { if (typeof openRhythmEditor === 'function') openRhythmEditor(); } catch (e) {}
  try { if (typeof openKitEditor === 'function') openKitEditor(); } catch (e) {}
}

async function _applyFullscreenForMode(mode) {
  const el = document.documentElement;
  try {
    if (mode === 'desktop-fullscreen') {
      if (!document.fullscreenElement && el.requestFullscreen) {
        await el.requestFullscreen();
      }
    } else if (document.fullscreenElement) {
      await document.exitFullscreen();
    }
  } catch (e) {
    // Fullscreen APIが使えない/拒否された場合でも、レイアウト自体は
    // 通常のブラウザウィンドウ内で適用され続けるため無視してよい
    // （iOS Safari等、Fullscreen API非対応環境への配慮）。
  }
}

function setLayoutMode(mode, opts) {
  opts = opts || {};
  if (!LAYOUT_MODES.includes(mode)) mode = 'standard';

  document.body.classList.remove(
    'layout-standard', 'layout-tablet-landscape', 'layout-desktop-fullscreen'
  );
  document.body.classList.add('layout-' + mode);

  state.layoutMode = mode;
  saveLayoutMode(mode);

  document.querySelectorAll('.layout-mode-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.layoutMode === mode);
  });

  if (!opts.skipFullscreen) _applyFullscreenForMode(mode);
  if (mode === 'desktop-fullscreen') _initDashboardPanels();
  _notifyLayoutResize();
}

function setupLayoutMode() {
  state.layoutMode = loadLayoutMode();
  // 初回適用時はユーザー操作（クリック）を経ていないため、Fullscreen APIの
  // 呼び出しはブラウザに拒否される（ユーザージェスチャー必須の仕様）。
  // そのため起動時はレイアウトのみ適用し、Fullscreen要求は行わない。
  setLayoutMode(state.layoutMode, { skipFullscreen: true });

  document.querySelectorAll('.layout-mode-btn').forEach(btn => {
    btn.addEventListener('click', () => setLayoutMode(btn.dataset.layoutMode));
  });

  // ユーザーがブラウザ標準のFullscreen終了操作（Escキー等）を行った場合、
  // レイアウト自体（広い画面を使うCSS）は維持しつつ、状態表示だけ追従させる。
  // レイアウトモードを勝手にSTANDARDへ戻すことはしない
  // （ユーザーが選択したモードを常に優先する、という設計方針のため）。
  document.addEventListener('fullscreenchange', _notifyLayoutResize);
}
