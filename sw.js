// omnitro Service Worker
// index.html と同じディレクトリに配置してください（GitHub Pagesならリポジトリ直下）。
// ブラウザのセキュリティ制約上、Service Workerは単体HTMLファイルに埋め込むことができず
// 独立した .js ファイルとして http(s) 経由で配信する必要があるため、このファイルが必要です。

// v1.4-modular: index.html を css/*.css・js/*.js に分割したビルドに対応。
// CACHE_NAME を旧バージョンから変更したことで、旧バージョンをインストール済みの
// クライアントでも古いキャッシュが破棄され、新しいファイル一式が確実に取得される。
const CACHE_NAME = 'omnitro-cache-v13-1.5';

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

  './css/variables.css?v13',
  './css/layout.css?v13',
  './css/chord-strum.css?v13',
  './css/overlays.css?v13',

  './js/state.js?v13',
  './js/music-theory.js?v13',
  './js/audio-core.js?v13',
  './js/native-strum-synth.js?v13',
  './js/voice-defs.js?v13',
  './js/rhythm-patterns.js?v13',
  './js/drum-synth-lm1.js?v13',
  './js/drum-kits.js?v13',
  './js/rhythm-scheduler.js?v13',
  './js/chord-playback.js?v13',
  './js/strumplate-core.js?v13',
  './js/chord-ui.js?v13',
  './js/strumplate-ui.js?v13',
  './js/settings-ui.js?v13',
  './js/rhythm-ui.js?v13',
  './js/rhythm-editor.js?v13',
  './js/piano-roll.js?v13',
  './js/recording.js?v13',
  './js/mix-studio.js?v13',
  './js/kit-editor.js?v13',
  './js/midi.js?v13',
  './js/manual-content.js?v13',
  './js/manual-ui.js?v13',
  './js/arrangement.js?v13',
  './js/wake-lock.js?v13',
  './js/main.js?v13',

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
