// ─── SCREEN WAKE LOCK ───────────────────────────────────────────────────────
// スマートフォンで演奏中に画面が自動スリープしてしまわないよう、
// Screen Wake Lock API で画面スリープを抑制する。
//
// 設計方針：
//   ・既存のライブ音声経路（audio-core.js 等）には一切触れない。
//     この機能は「ユーザーが最初にページへ触れた瞬間」をトリガーにする
//     完全に独立したフックとして実装し、ensureAudio() 等の既存関数を
//     一切変更しない。
//   ・Wake Lock API は仕様上、タブが非表示（バックグラウンド）になると
//     ブラウザ側で自動的に解除される。そのため、演奏を開始済み
//     （wakeLockDesired = true）であれば、タブが再び表示された時に
//     自動で再取得する。
//   ・非対応ブラウザ・非HTTPS環境では静かに何もしない（エラーにしない）。

let _wakeLockSentinel = null;
let _wakeLockDesired = false;

// 戻り値: 現在ロックを保持していれば true
async function requestWakeLock() {
  if (!('wakeLock' in navigator)) return false; // 非対応ブラウザ
  if (_wakeLockSentinel) return true; // 既に取得済み

  try {
    _wakeLockSentinel = await navigator.wakeLock.request('screen');
    console.log('[WAKE LOCK] 画面の自動スリープを抑制しました');
    _wakeLockSentinel.addEventListener('release', () => {
      // タブが非表示になった場合など、ブラウザ側で自動解除された時に発火。
      // 再表示時に visibilitychange ハンドラが再取得を試みる。
      _wakeLockSentinel = null;
    });
    return true;
  } catch (e) {
    // 非HTTPS環境・タブが非表示中の要求など。演奏自体には影響しないので
    // エラーダイアログ等は出さず、コンソールログのみに留める。
    console.log('[WAKE LOCK] 取得できませんでした（' + e.name + ': ' + e.message + '）');
    return false;
  }
}

function releaseWakeLock() {
  if (_wakeLockSentinel) {
    _wakeLockSentinel.release().catch(() => {});
    _wakeLockSentinel = null;
  }
}

// ── 初期化 ────────────────────────────────────────────────────────────────
// ページ読み込み直後ではなく、ユーザーが実際にアプリへ触れた最初の瞬間
// （タップ／クリック／キー入力）にWake Lockを取得する。これにより、
// ただページを開いただけでは画面スリープ抑制が働かず、実際に演奏を
// 始めた時から効果を発揮する。
function setupWakeLock() {
  if (!('wakeLock' in navigator)) {
    console.log('[WAKE LOCK] このブラウザはScreen Wake Lock APIに対応していません');
    return;
  }

  // 取得に成功するまでは、次のタップ/キー入力でも再試行する（初回の要求が
  // 低電力状態などで拒否されても、次の操作で取得できるように）。
  let armed = false;
  const arm = async () => {
    if (armed) return;
    armed = true;
    _wakeLockDesired = true;
    const ok = await requestWakeLock();
    if (ok) {
      document.removeEventListener('pointerdown', arm);
      document.removeEventListener('touchstart', arm);
      document.removeEventListener('keydown', arm);
    } else {
      armed = false;
    }
  };
  document.addEventListener('pointerdown', arm, { passive: true });
  document.addEventListener('touchstart', arm, { passive: true });
  document.addEventListener('keydown', arm);

  // タブが再び表示状態に戻った時、演奏を開始済みなら再取得する
  // （Wake LockはタブがhiddenになるとブラウザによりAPI仕様上自動解除されるため）
  document.addEventListener('visibilitychange', () => {
    if (_wakeLockDesired && document.visibilityState === 'visible') {
      requestWakeLock();
    }
  });
}
