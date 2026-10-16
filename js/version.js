// ─── APP VERSION（単一の情報源）──────────────────────────────────────────────
// リリースのたびに tools/bump-version.py で以下をまとめて更新する:
//   js/version.js（このファイル）/ version.json / sw.js の CACHE_NAME / index.html・sw.js の ?v クエリ
// version.json がサーバー上の最新版を示し、js/update-check.js がこの値と比較する。
const APP_VERSION = '1.5.48';
window._omniBuild = 'v' + APP_VERSION;
