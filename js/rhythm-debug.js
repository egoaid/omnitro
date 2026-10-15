// ─── RHYTHM DEBUG（v1.5.45・計測専用／演奏・音の挙動は一切変えない） ─────────────
//
// 目的: デスクトップ版・最高音質(HIGH)で「リズムパターンのRANDOMを押すとフリーズ
// する／少しリズムがもたつく」不具合の原因を、ログ1つで特定できるようにする。
//
// 計測するもの（すべて時刻つき。performance.now() 基準=ページ読み込みからの秒）:
//  ① シーケンサー1ステップごとの処理時間(cb)と「先読み余裕(lead)」
//       lead = (Toneが渡す発音予定時刻 − AudioContext.currentTime)。0に近い/負だと
//       発音が間に合っておらず、これが「もたつき」の直接の指標になる。
//  ② ドラム1発ごとの処理時間（チャンネル別の件数/平均/最大。4ms以上は個別に記録）
//     ＋ HIGH経路でドラム1発ごとに生成している ConvolverNode(ROOM) の生成数と所要時間
//  ③ RANDOM/HUMANIZE → 小節境界待ち → パターン差し替え(SWAP) の各段階（STAGE）
//  ④ メインスレッド停止: ハートビート(20ms周期)の遅れ / 描画(rAF)の飛び / LongTask
//  ⑤ オーディオ時計のずれ（AudioContext.currentTime と実時間の差。音声処理の詰まり）
//  ⑥ Tone.Transport / Tone.Draw のイベント数、JSヒープ（リーク・肥大化の検出）
//  ⑦ 1秒ごとの集計表
//
// ★フリーズ対策★ フリーズするとページ内からはログを取り出せない。そこで
//   ・「パンくず」: STAGEの度に localStorage へ同期書き込み（最後に書かれた段階=
//     止まった場所）。RANDOM押下から10秒間は、全ステップの BEGIN/END も書く
//     （BEGINだけでENDが無い=そのステップの中で止まった）。
//   ・「ブラックボックス」: 1秒ごとに直近の記録を localStorage へ保存。
//   ページを再読み込みすると、REPORTの末尾に「前回セッションの最後の記録」として出る。
(function () {
  const LS_ON = 'omnitro_rdbg_on_v1';
  const LS_BB = 'omnitro_rdbg_blackbox_v1';
  const LS_CR = 'omnitro_rdbg_crumbs_v1';
  const LS_CLEAN = 'omnitro_rdbg_clean_v1';

  let on = true;
  try { if (localStorage.getItem(LS_ON) === '0') on = false; } catch (e) {}
  window._rdbgOn = on;

  // ── 前回セッションの記録を先に読む（その後このセッション用にフラグを書き換える） ──
  let prev = { clean: null, bb: null, crumbs: null };
  try {
    prev.clean = localStorage.getItem(LS_CLEAN);
    prev.bb = localStorage.getItem(LS_BB);
    prev.crumbs = localStorage.getItem(LS_CR);
    localStorage.setItem(LS_CLEAN, '0');
    localStorage.removeItem(LS_CR);
  } catch (e) {}

  // ── イベントリング ──────────────────────────────────────────────────────────
  const N = 8192, MASK = N - 1;
  const T = new Float64Array(N), K = new Uint8Array(N);
  const A = new Float64Array(N), B = new Float64Array(N), C = new Float64Array(N), D = new Float64Array(N);
  const S = new Array(N).fill(null);
  let head = 0, count = 0;
  const KIND = { STEP: 1, HB: 2, FR: 3, LT: 4, AUD: 5, STAGE: 6, SLOWHIT: 7, DRAW: 8, MARK: 9, STATE: 10 };

  function push(k, a, b, c, d, s, t) {
    const i = head; head = (head + 1) & MASK;
    if (count < N) count++;
    T[i] = (t === undefined) ? performance.now() : t;
    K[i] = k; A[i] = a || 0; B[i] = b || 0; C[i] = c || 0; D[i] = d || 0; S[i] = s || null;
  }

  // ── 1秒バケット ─────────────────────────────────────────────────────────────
  const rows = [];
  let cur = null;
  function newBucket(sec) {
    return { sec, steps: 0, stepMax: 0, leadMin: 1e9, hits: 0, hitMs: 0, hitMax: 0, conv: 0, convMs: 0,
             hb: 0, hbMax: 0, fr: 0, frMax: 0, lt: 0, ltMax: 0, drawN: 0, drawMax: 0,
             driftMin: 1e9, driftMax: -1e9, heap: 0, tl: -1, dl: -1, bpm: 0, play: 0 };
  }
  function safeLen(fn) { try { const v = fn(); return (typeof v === 'number') ? v : -1; } catch (e) { return -1; } }
  function finishBucket() {
    if (!cur) return;
    try {
      cur.heap = (performance.memory ? performance.memory.usedJSHeapSize / 1048576 : -1);
      cur.tl = safeLen(() => Tone.Transport._timeline.length);
      cur.dl = safeLen(() => Tone.getDraw()._events.length);
      cur.bpm = Math.round(Tone.Transport.bpm.value);
      cur.play = (typeof state !== 'undefined' && state.isPlaying) ? 1 : 0;
    } catch (e) {}
    rows.push(cur);
    if (rows.length > 900) rows.shift();
    pollState();
    saveBlackbox(false);
  }
  function bucketFor(nowMs) {
    const sec = Math.floor(nowMs / 1000);
    if (!cur) cur = newBucket(sec);
    else if (cur.sec !== sec) { finishBucket(); cur = newBucket(sec); }
    return cur;
  }

  // ── 設定変更の自動検出（1秒ごと） ───────────────────────────────────────────
  let lastSig = '';
  function stateSig() {
    try {
      return [
        'RHYTHM ' + (state.isPlaying ? 'ON' : 'OFF'),
        'BPM ' + Math.round(Tone.Transport.bpm.value),
        'KIT ' + (typeof currentDrumKit !== 'undefined' ? currentDrumKit : '?'),
        'PERF ' + state.audioPerformanceMode,
        'FX ' + (document.body.classList.contains('fx-light') ? 'LIGHT' : 'FULL'),
        'REC ' + ((typeof recState !== 'undefined' && recState.active) ? 'ON' : 'OFF'),
        'CHORD_AUTO ' + (state.chordAuto ? 'ON' : 'OFF'),
      ].join(' / ');
    } catch (e) { return ''; }
  }
  function pollState() {
    const sig = stateSig();
    if (sig && sig !== lastSig) { push(KIND.STATE, 0, 0, 0, 0, sig); lastSig = sig; }
  }

  // ── パンくず（フリーズ時に「最後に到達した段階」を残す） ─────────────────────
  const crumbs = [];
  let intensiveUntil = 0;
  function crumb(text, persist) {
    crumbs.push({ t: Math.round(performance.now()), text });
    if (crumbs.length > 60) crumbs.shift();
    if (persist) {
      try { localStorage.setItem(LS_CR, JSON.stringify(crumbs.slice(-30))); } catch (e) {}
    }
  }

  // ── 公開API（呼び出し側は window._rdbgOn を見て呼ぶか、そのまま呼んでよい） ──
  window.rdbgStage = function (text) {
    if (!on) return;
    push(KIND.STAGE, 0, 0, 0, 0, text);
    crumb(text, true);
  };
  window.rdbgIntensive = function (ms) { if (on) intensiveUntil = performance.now() + ms; };

  let hitsTotal = 0;
  const chStat = {};
  window.rdbgHit = function (ch, ms) {
    if (!on) return;
    hitsTotal++;
    const s = chStat[ch] || (chStat[ch] = { n: 0, sum: 0, max: 0 });
    s.n++; s.sum += ms; if (ms > s.max) s.max = ms;
    const b = bucketFor(performance.now());
    b.hits++; b.hitMs += ms; if (ms > b.hitMax) b.hitMax = ms;
    if (ms >= 4) push(KIND.SLOWHIT, ms, 0, 0, 0, ch);
  };
  const counters = {};
  window.rdbgCount = function (name, v) {
    if (!on) return;
    const c = counters[name] || (counters[name] = { n: 0, sum: 0, max: 0 });
    c.n++; c.sum += (v || 0); if ((v || 0) > c.max) c.max = v || 0;
    if (name === 'conv') { const b = bucketFor(performance.now()); b.conv++; b.convMs += (v || 0); }
  };
  window.rdbgDraw = function (ms) {
    if (!on) return;
    const b = bucketFor(performance.now());
    b.drawN++; if (ms > b.drawMax) b.drawMax = ms;
    if (ms >= 8) push(KIND.DRAW, ms);
  };

  let ctxCache = null;
  function getCtx() {
    if (ctxCache) return ctxCache;
    try { ctxCache = Tone.getContext().rawContext; } catch (e) {}
    return ctxCache;
  }

  window._rdbgInTick = false;
  window.rdbgWrapSeq = function (fn, tag) {
    return function (time, step) {
      if (!on) return fn(time, step);
      const t0 = performance.now();
      const ctx = getCtx();
      const lead = ctx ? (time - ctx.currentTime) * 1000 : 0;
      const h0 = hitsTotal;
      const intensive = t0 < intensiveUntil;
      if (intensive) crumb('STEP-BEGIN[' + tag + '] s' + step + ' lead=' + lead.toFixed(0) + 'ms', true);
      const wasIn = window._rdbgInTick;
      window._rdbgInTick = true;
      try {
        return fn(time, step);
      } catch (e) {
        push(KIND.STAGE, 0, 0, 0, 0, 'STEP-ERROR s' + step + ': ' + (e && e.message));
        throw e;
      } finally {
        window._rdbgInTick = wasIn;
        const dt = performance.now() - t0;
        if (intensive) crumb('STEP-END s' + step + ' ' + dt.toFixed(1) + 'ms', true);
        push(KIND.STEP, step, dt, lead, hitsTotal - h0, tag, t0);
        const b = bucketFor(t0);
        b.steps++; if (dt > b.stepMax) b.stepMax = dt;
        if (lead < b.leadMin) b.leadMin = lead;
      }
    };
  };

  // ── メインスレッド監視 ──────────────────────────────────────────────────────
  let visChanged = false;
  document.addEventListener('visibilitychange', () => { visChanged = true; });

  let hbLast = performance.now(), hbTick = 0;
  let a0 = null, w0 = 0, lastDrift = 0;
  setInterval(() => {
    const now = performance.now();
    const gap = now - hbLast; hbLast = now; hbTick++;
    if (!on) return;
    const b = bucketFor(now);
    if (visChanged || document.hidden) { visChanged = false; a0 = null; return; }
    if (gap >= 60) { b.hb++; if (gap > b.hbMax) b.hbMax = gap; push(KIND.HB, gap); }
    if (hbTick % 5 === 0) {
      const ctx = getCtx();
      if (ctx && ctx.state === 'running') {
        if (a0 === null) { a0 = ctx.currentTime; w0 = now; lastDrift = 0; }
        else {
          const drift = (ctx.currentTime - a0) * 1000 - (now - w0);
          if (drift < b.driftMin) b.driftMin = drift;
          if (drift > b.driftMax) b.driftMax = drift;
          if (Math.abs(drift - lastDrift) >= 8) { push(KIND.AUD, drift, drift - lastDrift); lastDrift = drift; }
        }
      } else { a0 = null; }
    }
  }, 20);

  let frLast = 0;
  (function raf() {
    requestAnimationFrame(raf);
    if (!on) { frLast = 0; return; }
    const now = performance.now();
    if (frLast && !document.hidden && !visChanged) {
      const gap = now - frLast;
      if (gap >= 50) { const b = bucketFor(now); b.fr++; if (gap > b.frMax) b.frMax = gap; push(KIND.FR, gap); }
    }
    frLast = now;
  })();

  try {
    new PerformanceObserver(list => {
      if (!on) return;
      for (const e of list.getEntries()) {
        const b = bucketFor(e.startTime);
        b.lt++; if (e.duration > b.ltMax) b.ltMax = e.duration;
        push(KIND.LT, e.duration, 0, 0, 0, null, e.startTime);
      }
    }).observe({ entryTypes: ['longtask'] });
  } catch (e) {}

  // ── ブラックボックス保存 ────────────────────────────────────────────────────
  function saveBlackbox(clean) {
    if (!on) return;
    try {
      const txt = buildReport({ compact: true });
      localStorage.setItem(LS_BB, JSON.stringify({ savedAt: new Date().toISOString(), tSec: performance.now() / 1000, text: txt }));
      if (clean) localStorage.setItem(LS_CLEAN, '1');
    } catch (e) {}
  }
  window.addEventListener('pagehide', () => { try { localStorage.setItem(LS_CLEAN, '1'); } catch (e) {} saveBlackbox(true); });

  // ── レポート生成 ────────────────────────────────────────────────────────────
  const f1 = n => Number(n).toFixed(1);
  const sec = t => (t / 1000).toFixed(3);

  function eventLines(compact) {
    const idx = [];
    const lim = compact ? Math.min(count, 800) : count;   // 毎秒の保存時は直近のみ（負荷を抑える）
    const start = (head - lim) & MASK;
    for (let j = 0; j < lim; j++) idx.push((start + j) & MASK);
    idx.sort((x, y) => T[x] - T[y]);
    // RANDOM/HUMANIZE押下から6秒間はステップも全て出す
    const wins = [];
    for (const i of idx) if (K[i] === KIND.STAGE && /^(RANDOM|HUMANIZE) click/.test(S[i] || '')) wins.push([T[i], T[i] + 6000]);
    const inWin = t => wins.some(w => t >= w[0] && t <= w[1]);
    const out = [];
    for (const i of idx) {
      const t = T[i]; let line = null;
      switch (K[i]) {
        case KIND.STEP:
          if (B[i] >= 6 || C[i] < 25 || inWin(t))
            line = 'STEP[' + S[i] + '] s' + A[i] + ' cb=' + f1(B[i]) + 'ms lead=' + f1(C[i]) + 'ms hits=' + D[i] + ((B[i] >= 6) ? '  ◀遅い' : '') + ((C[i] < 25) ? '  ◀先読み不足' : '');
          break;
        case KIND.HB: line = 'HEARTBEAT-DROP ' + f1(A[i]) + 'ms（メインスレッド停止）'; break;
        case KIND.FR: line = 'FRAME-DROP ' + f1(A[i]) + 'ms'; break;
        case KIND.LT: line = 'LONGTASK ' + f1(A[i]) + 'ms（開始 ' + sec(t) + '）'; break;
        case KIND.AUD: line = 'AUDIO-CLOCK drift=' + f1(A[i]) + 'ms (変化 ' + f1(B[i]) + 'ms)'; break;
        case KIND.STAGE: line = '■ ' + S[i]; break;
        case KIND.SLOWHIT: line = 'SLOW-HIT ' + S[i] + ' ' + f1(A[i]) + 'ms'; break;
        case KIND.DRAW: line = 'GRID-DRAW ' + f1(A[i]) + 'ms'; break;
        case KIND.MARK: line = '★★★ MARK（ユーザーが「今ヘンだ」と押した）'; break;
        case KIND.STATE: line = '⚙ ' + S[i]; break;
      }
      if (line) out.push(sec(t) + ' ' + line);
    }
    const cap = compact ? 60 : 700;
    return out.length > cap ? ['…（古い' + (out.length - cap) + '件省略）…'].concat(out.slice(-cap)) : out;
  }

  function summary() {
    const L = [];
    let steps = 0, stepMax = 0, leadMin = 1e9, hb = 0, hbMax = 0, fr = 0, frMax = 0, lt = 0, ltMax = 0, dMin = 1e9, dMax = -1e9;
    const all = rows.concat(cur ? [cur] : []);
    for (const r of all) {
      steps += r.steps; if (r.stepMax > stepMax) stepMax = r.stepMax; if (r.leadMin < leadMin) leadMin = r.leadMin;
      hb += r.hb; if (r.hbMax > hbMax) hbMax = r.hbMax; fr += r.fr; if (r.frMax > frMax) frMax = r.frMax;
      lt += r.lt; if (r.ltMax > ltMax) ltMax = r.ltMax; if (r.driftMin < dMin) dMin = r.driftMin; if (r.driftMax > dMax) dMax = r.driftMax;
    }
    L.push('ステップ総数=' + steps + '  1ステップ最大処理=' + f1(stepMax) + 'ms  先読み余裕の最小=' + (leadMin > 1e8 ? 'n/a' : f1(leadMin) + 'ms'));
    L.push('HEARTBEAT-DROP(≥60ms)=' + hb + '件(最大' + f1(hbMax) + 'ms)  FRAME-DROP(≥50ms)=' + fr + '件(最大' + f1(frMax) + 'ms)  LONGTASK=' + lt + '件(最大' + f1(ltMax) + 'ms)');
    L.push('オーディオ時計ずれ: 最小=' + (dMin > 1e8 ? 'n/a' : f1(dMin) + 'ms') + ' 最大=' + (dMax < -1e8 ? 'n/a' : f1(dMax) + 'ms') + '（急に負へ動く=音声処理の遅れ）');
    const cv = counters.conv;
    L.push('ROOM用ConvolverNode生成(HIGH経路): ' + (cv ? cv.n + '個 / 合計' + f1(cv.sum) + 'ms / 最大' + f1(cv.max) + 'ms' : '0個'));
    const first = all.find(r => r.heap > 0), last = all.length ? all[all.length - 1] : null;
    if (first && last) L.push('JSヒープ: ' + f1(first.heap) + 'MB → ' + f1(last.heap) + 'MB   Transportイベント数: ' + first.tl + ' → ' + last.tl + '   Drawイベント数: ' + first.dl + ' → ' + last.dl);
    L.push('--- ドラムのチャンネル別（1発の処理時間） ---');
    for (const ch of Object.keys(chStat)) { const s = chStat[ch]; L.push('  ' + ch.padEnd(6) + ' n=' + s.n + ' avg=' + f1(s.sum / s.n) + 'ms max=' + f1(s.max) + 'ms 合計=' + f1(s.sum) + 'ms'); }
    return L;
  }

  function table(n) {
    const L = ['秒 | bpm play | steps stepMax leadMin | hits hitMs hitMax | conv convMs | HB(回/最大) FR(回/最大) LT(回/最大) | gridMax | 時計ずれ min..max | heapMB TLen DLen'];
    const all = rows.concat(cur ? [cur] : []).slice(-n);
    for (const r of all) {
      L.push(r.sec + ' | ' + r.bpm + ' ' + r.play + ' | ' + r.steps + ' ' + f1(r.stepMax) + ' ' + (r.leadMin > 1e8 ? '-' : f1(r.leadMin)) +
        ' | ' + r.hits + ' ' + f1(r.hitMs) + ' ' + f1(r.hitMax) + ' | ' + r.conv + ' ' + f1(r.convMs) +
        ' | ' + r.hb + '/' + f1(r.hbMax) + ' ' + r.fr + '/' + f1(r.frMax) + ' ' + r.lt + '/' + f1(r.ltMax) +
        ' | ' + f1(r.drawMax) + ' | ' + (r.driftMin > 1e8 ? '-' : f1(r.driftMin) + '..' + f1(r.driftMax)) +
        ' | ' + (r.heap > 0 ? f1(r.heap) : '-') + ' ' + r.tl + ' ' + r.dl);
    }
    return L;
  }

  function envLines() {
    const L = [];
    try {
      const ctx = getCtx();
      L.push('UA: ' + navigator.userAgent);
      L.push('CPUコア=' + navigator.hardwareConcurrency + '  画面=' + innerWidth + 'x' + innerHeight + '  DPR=' + devicePixelRatio);
      L.push('sampleRate=' + (ctx ? ctx.sampleRate : '?') + ' baseLatency=' + (ctx && ctx.baseLatency != null ? (ctx.baseLatency * 1000).toFixed(1) + 'ms' : 'n/a') +
        ' outputLatency=' + (ctx && ctx.outputLatency != null ? (ctx.outputLatency * 1000).toFixed(1) + 'ms' : 'n/a') + ' state=' + (ctx ? ctx.state : '?'));
      L.push('Tone.context.lookAhead=' + (Tone.getContext().lookAhead) + 's  updateInterval=' + (Tone.getContext().updateInterval) + 's');
      L.push('現在の設定: ' + stateSig());
      L.push('キット=' + (typeof currentDrumKit !== 'undefined' ? currentDrumKit : '?') + '  プリセット選択=' + ((document.getElementById('reditor-preset-sel') || {}).value || '-') + '  body.class=' + document.body.className);
    } catch (e) { L.push('(環境取得エラー: ' + e.message + ')'); }
    return L;
  }

  function prevSession() {
    const L = ['', '=== 前回セッションの最後の記録（ブラックボックス） ==='];
    if (prev.bb === null && prev.crumbs === null) { L.push('前回の記録なし（初回、またはデバッグOFFだった）'); return L; }
    L.push('前回の終了状態: ' + (prev.clean === '1' ? '正常終了（タブを閉じた/リロード）' : '★異常終了（フリーズ／強制終了の可能性）'));
    try {
      if (prev.crumbs) {
        const c = JSON.parse(prev.crumbs);
        L.push('--- パンくず（最後に到達した段階。一番下が最後） ---');
        for (const x of c) L.push((x.t / 1000).toFixed(3) + ' ' + x.text);
      } else L.push('パンくずなし');
    } catch (e) { L.push('(パンくず解析エラー)'); }
    try {
      if (prev.bb) { const b = JSON.parse(prev.bb); L.push('--- 最終ブラックボックス（保存 ' + b.savedAt + ' / ページ読込後 ' + b.tSec.toFixed(1) + 's） ---'); L.push(b.text); }
    } catch (e) { L.push('(ブラックボックス解析エラー)'); }
    return L;
  }

  function buildReport(opt) {
    const compact = opt && opt.compact;
    const L = [];
    L.push('=== OMNITRO RHYTHM DEBUG REPORT ===');
    L.push('BUILD ' + (window._omniBuild || '?') + '  記録時間(ページ読込から)=' + (performance.now() / 1000).toFixed(1) + 's  記録=' + (on ? 'ON' : 'OFF') + '  生成=' + new Date().toISOString());
    if (!compact) { L.push.apply(L, envLines()); }
    L.push('');
    L.push('--- 集計 ---'); L.push.apply(L, summary());
    L.push('');
    L.push('--- 1秒ごとの推移 ---'); L.push.apply(L, table(compact ? 15 : 180));
    L.push('');
    L.push('--- イベント時系列（■=RANDOM等の段階 / ★MARK / ⚙設定変更。RANDOM/HUMANIZE押下後6秒は全ステップ表示） ---');
    L.push.apply(L, eventLines(compact));
    if (!compact) L.push.apply(L, prevSession());
    return L.join('\n');
  }
  window.rdbgReport = function () { return buildReport({}); };

  // ── MARKボタン／オーバーレイUI ──────────────────────────────────────────────
  let markBtn = null, overlay = null, ta = null, statusEl = null;
  function doMark() {
    if (!on) return;
    push(KIND.MARK); crumb('MARK', true);
    if (markBtn) { markBtn.style.background = '#fb923c'; markBtn.style.color = '#000'; setTimeout(() => { markBtn.style.background = 'rgba(26,14,4,.85)'; markBtn.style.color = '#fb923c'; }, 250); }
  }
  function ensureMark() {
    if (markBtn) return;
    markBtn = document.createElement('div');
    markBtn.id = 'rdbg-mark';
    markBtn.textContent = '● MARK';
    markBtn.style.cssText = 'position:fixed;left:8px;bottom:8px;z-index:900;font-family:Orbitron,sans-serif;font-size:10px;letter-spacing:1px;padding:7px 10px;border:1px solid #fb923c;border-radius:6px;background:rgba(26,14,4,.85);color:#fb923c;cursor:pointer;opacity:.6;user-select:none;-webkit-user-select:none;touch-action:manipulation;';
    markBtn.title = '耳でヘンだと感じた瞬間に押す（ログに★MARKとして残る）';
    markBtn.addEventListener('pointerdown', e => { e.preventDefault(); doMark(); });
    document.body.appendChild(markBtn);
  }
  function refreshStatus() {
    if (statusEl) statusEl.textContent = '記録: ' + (on ? 'ON' : 'OFF') + '  /  イベント ' + count + '件  /  ' + (performance.now() / 1000).toFixed(0) + 's';
    const t = document.getElementById('rdbg-toggle'); if (t) t.textContent = on ? '■ 記録ON（押すとOFF）' : '▶ 記録OFF（押すとON）';
  }
  function refreshReport() { if (ta) ta.value = buildReport({}); refreshStatus(); }
  function copyReport(btn) {
    refreshReport();
    const done = () => { btn.textContent = '✓ COPIED'; setTimeout(() => { btn.textContent = '📋 COPY REPORT'; }, 1500); };
    const fallback = () => { ta.focus(); ta.select(); try { document.execCommand('copy'); done(); } catch (e) { btn.textContent = '手動で全選択→コピー'; } };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(ta.value).then(done, fallback); else fallback();
  }
  function buildOverlay() {
    overlay = document.createElement('div');
    overlay.id = 'rdbg-overlay';
    overlay.style.cssText = 'display:none;position:fixed;inset:0;z-index:5000;background:#060c14;flex-direction:column;padding:10px;gap:8px;';
    const btnCss = 'font-family:Orbitron,sans-serif;font-size:10px;letter-spacing:1px;border-radius:4px;cursor:pointer;padding:8px 12px;border:1px solid #2a4a6a;background:#0e1c2c;color:#8899aa;';
    overlay.innerHTML =
      '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">' +
        '<div style="font-family:Orbitron,sans-serif;font-size:12px;color:#fb923c;letter-spacing:2px;flex:1;min-width:140px;">🛠 RHYTHM DEBUG</div>' +
        '<button id="rdbg-copy" style="' + btnCss + 'border-color:#27ae60;color:#27ae60;">📋 COPY REPORT</button>' +
        '<button id="rdbg-refresh" style="' + btnCss + '">↻ REFRESH</button>' +
        '<button id="rdbg-toggle" style="' + btnCss + '"></button>' +
        '<button id="rdbg-clear" style="' + btnCss + 'border-color:#c0392b;color:#c0392b;">CLEAR</button>' +
        '<button id="rdbg-close" style="' + btnCss + '">✕</button>' +
      '</div>' +
      '<div id="rdbg-status" style="font-family:\'Share Tech Mono\',monospace;font-size:10px;color:#8899aa;"></div>' +
      '<div style="font-family:\'Share Tech Mono\',monospace;font-size:10px;color:#8899aa;line-height:1.5;">使い方: ①この画面を閉じる ②RHYTHMを再生（テンポ100以上）→ RHYTHM EDITORでRANDOMを何回か押す。もたついたと感じたら左下の ●MARK を押す。③フリーズした場合はタブを閉じて開き直し、この画面を開く（前回の記録がREPORT末尾に出る）④COPY REPORT → 貼り付けて渡す。</div>' +
      '<textarea id="rdbg-ta" readonly spellcheck="false" style="flex:1;width:100%;background:#0a1220;color:#cfd8e3;border:1px solid #1a3a5a;border-radius:4px;font-family:\'Share Tech Mono\',monospace;font-size:10px;line-height:1.35;white-space:pre;overflow:auto;padding:8px;resize:none;"></textarea>';
    document.body.appendChild(overlay);
    ta = overlay.querySelector('#rdbg-ta'); statusEl = overlay.querySelector('#rdbg-status');
    overlay.querySelector('#rdbg-copy').addEventListener('click', e => copyReport(e.currentTarget));
    overlay.querySelector('#rdbg-refresh').addEventListener('click', refreshReport);
    overlay.querySelector('#rdbg-close').addEventListener('click', () => { overlay.style.display = 'none'; });
    overlay.querySelector('#rdbg-toggle').addEventListener('click', () => {
      on = !on; window._rdbgOn = on;
      try { localStorage.setItem(LS_ON, on ? '1' : '0'); } catch (e) {}
      a0 = null; if (on) ensureMark(); if (markBtn) markBtn.style.display = on ? 'block' : 'none';
      refreshStatus();
    });
    overlay.querySelector('#rdbg-clear').addEventListener('click', () => {
      head = 0; count = 0; rows.length = 0; cur = null; crumbs.length = 0; hitsTotal = 0;
      for (const k of Object.keys(chStat)) delete chStat[k];
      for (const k of Object.keys(counters)) delete counters[k];
      lastSig = ''; try { localStorage.removeItem(LS_BB); localStorage.removeItem(LS_CR); } catch (e) {}
      refreshReport();
    });
  }
  function openOverlay() {
    if (!overlay) buildOverlay();
    const so = document.getElementById('settings-overlay'); if (so) so.classList.remove('open');
    overlay.style.display = 'flex';
    refreshReport();
  }

  window.setupRhythmDebug = function () {
    if (on) ensureMark();
    const b = document.getElementById('open-rdbg-btn');
    if (b) b.addEventListener('click', openOverlay);
    pollState();
  };
})();
