// ─── UPDATE CHECK ───────────────────────────────────────────────────────────
// サーバー上の version.json と、このページが読み込んだ APP_VERSION（js/version.js）を
// 比較し、サーバー側が新しければ画面上部に更新を促す帯を表示する。帯をタップすると
// 「Service Worker登録解除 + Cache Storage全削除 + 再読み込み」で最新版へ更新する。
//
//   ・確認のタイミング: 起動4秒後 / タブが再表示された時（前回確認から60秒以上空いていれば）/
//     30分ごと / SETTINGS > HELP > CHECK FOR UPDATES の手動実行
//   ・version.json は ?ts=現在時刻 + cache:'no-store' で取得し、sw.js側でも素通しにする
//     （Service WorkerのキャッシュやHTTPキャッシュで古い値を見ないため）
//   ・オフライン/取得失敗時は何も表示しない（演奏には一切影響しない）
//   ・ユーザーパターン/キット/各種設定は localStorage に保存されており、Cache Storage
//     の削除では消えない
//   ・録音中、または録音データが残っているMIX STUDIO表示中は更新しない
//     （再読み込みで録音データが失われるため）
//   ・音声ルーティング・演奏系のコードには一切触れない独立モジュール

const UPDATE_CHECK_INTERVAL_MS = 30 * 60 * 1000;
const UPDATE_CHECK_MIN_GAP_MS  = 60 * 1000;
const UPDATE_DISMISS_KEY       = 'omnitro_update_dismissed_v1';

let _updateBannerEl = null;
let _updateBannerMainBtn = null;
let _updateServerVersion = null;
let _updateBusy = false;
let _updateLastCheckAt = 0;

// "1.5.48" / "v1.5.48" → [1,5,48]
function parseVersion(v) {
  return String(v == null ? '' : v).trim().replace(/^v/i, '').split('.').map(n => parseInt(n, 10) || 0);
}
// a が b より新しければ正、同じなら0、古ければ負
function compareVersions(a, b) {
  const pa = parseVersion(a), pb = parseVersion(b);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const d = (pa[i] || 0) - (pb[i] || 0);
    if (d !== 0) return d;
  }
  return 0;
}

async function fetchServerVersion() {
  const res = await fetch('./version.json?ts=' + Date.now(), { cache: 'no-store' });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  const data = await res.json();
  if (!data || typeof data.version !== 'string') throw new Error('invalid version.json');
  return data.version;
}

function _updateBlockedReason() {
  if (typeof recState !== 'undefined' && recState.active) return 'STOP RECORDING BEFORE UPDATING';
  if (typeof studioState !== 'undefined' && studioState.open) return 'EXPORT OR DISCARD YOUR RECORDING FIRST';
  return null;
}

function _setBannerText(text) {
  if (_updateBannerMainBtn) _updateBannerMainBtn.textContent = text;
}
function _bannerDefaultText() {
  return '▲ NEW VERSION v' + _updateServerVersion + ' AVAILABLE — TAP TO UPDATE';
}

function showUpdateBanner(serverVersion) {
  _updateServerVersion = serverVersion;
  if (!_updateBannerEl) {
    _updateBannerEl = document.createElement('div');
    _updateBannerEl.id = 'update-banner';

    _updateBannerMainBtn = document.createElement('button');
    _updateBannerMainBtn.id = 'update-banner-main';
    _updateBannerMainBtn.type = 'button';
    _updateBannerMainBtn.addEventListener('click', performUpdate);

    const close = document.createElement('button');
    close.id = 'update-banner-close';
    close.type = 'button';
    close.setAttribute('aria-label', 'Dismiss');
    close.textContent = '✕';
    close.addEventListener('click', () => {
      try { sessionStorage.setItem(UPDATE_DISMISS_KEY, _updateServerVersion || ''); } catch (e) {}
      hideUpdateBanner();
    });

    _updateBannerEl.appendChild(_updateBannerMainBtn);
    _updateBannerEl.appendChild(close);
    document.body.appendChild(_updateBannerEl);
  }
  _setBannerText(_bannerDefaultText());
  _updateBannerEl.style.display = 'flex';
}

function hideUpdateBanner() {
  if (_updateBannerEl) _updateBannerEl.style.display = 'none';
}

// 戻り値: 'update' | 'latest' | 'error' | 'busy'
async function checkForUpdate(opts) {
  const manual = !!(opts && opts.manual);
  if (_updateBusy) return 'busy';
  _updateBusy = true;
  _updateLastCheckAt = Date.now();
  try {
    const serverVersion = await fetchServerVersion();
    if (compareVersions(serverVersion, APP_VERSION) > 0) {
      let dismissed = null;
      try { dismissed = sessionStorage.getItem(UPDATE_DISMISS_KEY); } catch (e) {}
      if (manual || dismissed !== serverVersion) showUpdateBanner(serverVersion);
      return 'update';
    }
    return 'latest';
  } catch (e) {
    return 'error';
  } finally {
    _updateBusy = false;
  }
}

// キャッシュを削除して再読み込み
async function performUpdate() {
  const blocked = _updateBlockedReason();
  if (blocked) {
    _setBannerText(blocked);
    setTimeout(() => { if (_updateServerVersion) _setBannerText(_bannerDefaultText()); }, 3000);
    return;
  }
  _setBannerText('UPDATING…');
  try {
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map(r => r.unregister()));
    }
  } catch (e) {}
  try {
    if (window.caches) {
      const keys = await caches.keys();
      await Promise.all(keys.map(k => caches.delete(k)));
    }
  } catch (e) {}
  try {
    // HTML本体のHTTPキャッシュも更新しておく（古いindex.htmlが再利用されないように）
    await fetch(location.href.split('#')[0], { cache: 'reload' });
  } catch (e) {}
  location.reload();
}

function setupUpdateCheck() {
  const verEl = document.getElementById('settings-version');
  if (verEl) verEl.textContent = 'omnitro v' + APP_VERSION;
  const verHdr = document.getElementById('settings-header-version');
  if (verHdr) verHdr.textContent = 'v' + APP_VERSION;

  const btn = document.getElementById('check-update-btn');
  if (btn) {
    const idleLabel = btn.textContent;
    btn.addEventListener('click', async () => {
      if (btn.disabled) return;
      btn.disabled = true;
      btn.textContent = 'CHECKING…';
      const result = await checkForUpdate({ manual: true });
      btn.textContent =
        result === 'update' ? 'NEW VERSION AVAILABLE (SEE TOP OF SCREEN)' :
        result === 'latest' ? 'UP TO DATE (v' + APP_VERSION + ')' :
                              'CHECK FAILED (OFFLINE?)';
      setTimeout(() => { btn.textContent = idleLabel; btn.disabled = false; }, 3000);
    });
  }

  // 自動確認
  setTimeout(() => { checkForUpdate(); }, 4000);
  setInterval(() => { if (!document.hidden) checkForUpdate(); }, UPDATE_CHECK_INTERVAL_MS);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && Date.now() - _updateLastCheckAt > UPDATE_CHECK_MIN_GAP_MS) {
      checkForUpdate();
    }
  });
}
