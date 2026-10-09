// omnitro Service Worker
// index.html と同じディレクトリに配置してください（GitHub Pagesならリポジトリ直下）。
// ブラウザのセキュリティ制約上、Service Workerは単体HTMLファイルに埋め込むことができず
// 独立した .js ファイルとして http(s) 経由で配信する必要があるため、このファイルが必要です。

// v1.4-modular: index.html を css/*.css・js/*.js に分割したビルドに対応。
// CACHE_NAME を旧バージョンから変更したことで、旧バージョンをインストール済みの
// クライアントでも古いキャッシュが破棄され、新しいファイル一式が確実に取得される。
const CACHE_NAME = 'omnitro-cache-v40-1.5.40';

// 初回アクセス時にキャッシュしておく「アプリの殻」。
// index.html・css/・js/ 配下にファイルを追加/削除/リネームした場合はここも合わせて変更してください。
const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/favicon-32.png',
  './omnitro-capture-worklet.js',
  './omnitro-glitch-probe.js',

  './css/variables.css?v40',
  './css/layout.css?v40',
  './css/chord-strum.css?v40',
  './css/overlays.css?v40',
  './css/layout-modes.css?v40',

  './js/state.js?v40',
  './js/layout-mode.js?v40',
  './js/audio-performance.js?v40',
  './js/flight-recorder.js?v40',
  './js/perf-diagnostics.js?v40',
  './js/music-theory.js?v40',
  './js/audio-core.js?v40',
  './js/native-strum-synth.js?v40',
  './js/voice-defs.js?v40',
  './js/rhythm-patterns.js?v40',
  './js/drum-synth-lm1.js?v40',
  './js/drum-kits.js?v40',
  './js/rhythm-scheduler.js?v40',
  './js/chord-playback.js?v40',
  './js/strumplate-core.js?v40',
  './js/chord-ui.js?v40',
  './js/strumplate-ui.js?v40',
  './js/settings-ui.js?v40',
  './js/rhythm-ui.js?v40',
  './js/rhythm-editor.js?v40',
  './js/piano-roll.js?v40',
  './js/recording.js?v40',
  './js/mix-studio.js?v40',
  './js/kit-editor.js?v40',
  './js/midi.js?v40',
  './js/manual-content.js?v40',
  './js/manual-ui.js?v40',
  './js/arrangement.js?v40',
  './js/wake-lock.js?v40',
  './js/main.js?v40',

  'https://cdnjs.cloudflare.com/ajax/libs/tone/14.8.49/Tone.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .catch(() => { /* オフライン初回インストール等は無視 */ })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// キャッシュ優先、無ければネットワーク取得しつつキャッシュに追加（stale-while-revalidate的な簡易実装）
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      const fetchPromise = fetch(event.request)
        .then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => cached);

      return cached || fetchPromise;
    })
  );
});
