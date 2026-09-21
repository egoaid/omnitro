// ─── PERFORMANCE MONITOR（一時的な診断オーバーレイ） ────────────────────────
//
// 目的: iPad等の非力な端末でストラムプレート演奏時に発生するノイズ/フリーズの
// 原因調査のための、コピー可能なテキストログを持つ軽量な計測パネル。
//
// 設計方針:
//   - console.logを大量に出すのではなく、数値カウンタとイベントログに集約する
//   - オーバーレイを開いている間だけ計測ループ（rAF）が走る。閉じている間は
//     window._omniPerf のカウンタ加算（native-strum-synth.js側、ほぼ無コスト）
//     以外、一切の追加負荷が発生しない
//   - 表示する指標:
//       ・FPS（直近1秒の平均）、直近の最大フレーム時間（コマ落ち検出）
//       ・現在の同時発音ボイス数 / このセッションでの最大同時発音数
//       ・ノート発音回数、voice steal（間引き）回数
//       ・AudioNode生成数・破棄数（累計、および直近区間のレート）
//       ・WaveShaperカーブのキャッシュヒット/ミス
//       ・AudioContextの状態（running/suspended/interrupted等）とsampleRate
//   - フレーム落ち（>50ms）やAudioContextの状態変化は自動でログに1行追記
//     （スロットリングして大量出力を防ぐ）
//   - SNAPSHOTボタンで現在値をタイムスタンプ付きでログに追記、COPYボタンで
//     ログ全文をクリップボードにコピー（テキストで共有・貼り付け可能）

(function () {
  let overlay = null;
  let logEl = null;
  let statsEl = null;
  let rafId = null;
  let intervalId = null;
  let acStateHandlerAttached = false;

  let lastFrameTime = 0;
  let frameCount = 0;
  let fpsAccumTime = 0;
  let fps = 0;
  let maxFrameMs = 0;
  let lastJankLogTime = 0;

  let lastStolenCount = 0;
  let lastStolenLogTime = 0;

  let baselineCounters = null; // レート計算用の直近スナップショット
  let baselineTime = 0;

  const logLines = [];

  function nowStr() {
    const d = new Date();
    return d.toTimeString().slice(0, 8) + '.' + String(d.getMilliseconds()).padStart(3, '0');
  }

  function appendLog(line) {
    logLines.push(`[${nowStr()}] ${line}`);
    if (logLines.length > 400) logLines.splice(0, logLines.length - 400);
    if (logEl) {
      logEl.value = logLines.join('\n');
      logEl.scrollTop = logEl.scrollHeight;
    }
  }

  function getCtxInfo() {
    try {
      const ctx = Tone.getContext().rawContext;
      return { state: ctx.state, sampleRate: ctx.sampleRate, baseLatency: ctx.baseLatency };
    } catch (e) {
      return { state: 'n/a', sampleRate: 0, baseLatency: 0 };
    }
  }

  function buildOverlay() {
    if (overlay) return;
    overlay = document.createElement('div');
    overlay.id = 'perf-monitor-overlay';
    Object.assign(overlay.style, {
      display: 'none', position: 'fixed', inset: '0', zIndex: '500',
      background: 'linear-gradient(180deg,#0a0f18 0%,#060c14 100%)',
      flexDirection: 'column', maxWidth: '430px', margin: '0 auto', overflow: 'hidden',
      fontFamily: "'Share Tech Mono', monospace",
    });

    const header = document.createElement('div');
    Object.assign(header.style, {
      display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 10px',
      background: 'linear-gradient(90deg,#0a0f1a,#111827,#0a0f1a)',
      borderBottom: '1px solid #1a3a5a', flexShrink: '0', flexWrap: 'wrap',
    });
    header.innerHTML = `
      <div style="font-family:'Orbitron',sans-serif;font-size:11px;color:var(--accent1,#e8c95a);letter-spacing:2px;flex:1;">PERFORMANCE MONITOR</div>
      <button id="perf-snapshot-btn" style="font-size:9px;letter-spacing:1px;border-radius:4px;cursor:pointer;padding:5px 8px;border:1px solid #4fc3f7;background:#0e1c2c;color:#4fc3f7;">SNAPSHOT</button>
      <button id="perf-copy-btn" style="font-size:9px;letter-spacing:1px;border-radius:4px;cursor:pointer;padding:5px 8px;border:1px solid #27ae60;background:#0e1c2c;color:#27ae60;">COPY</button>
      <button id="perf-clear-btn" style="font-size:9px;letter-spacing:1px;border-radius:4px;cursor:pointer;padding:5px 8px;border:1px solid #c0392b;background:#0e1c2c;color:#c0392b;">CLEAR</button>
      <button id="perf-close-btn" style="width:26px;height:26px;border-radius:4px;cursor:pointer;border:1px solid #2a4a6a;background:#1a2a3a;color:#8899aa;">✕</button>
    `;
    overlay.appendChild(header);

    statsEl = document.createElement('div');
    Object.assign(statsEl.style, {
      padding: '8px 10px', fontSize: '9px', lineHeight: '1.6', color: '#8899aa',
      borderBottom: '1px solid #1a2a3a', flexShrink: '0', whiteSpace: 'pre-wrap',
    });
    overlay.appendChild(statsEl);

    const logLabel = document.createElement('div');
    logLabel.textContent = 'EVENT LOG (auto: frame drops >50ms / voice steals / AudioContext state changes)';
    Object.assign(logLabel.style, { fontSize: '7px', color: '#5a6a7a', letterSpacing: '1px', padding: '6px 10px 2px' });
    overlay.appendChild(logLabel);

    logEl = document.createElement('textarea');
    logEl.readOnly = true;
    Object.assign(logEl.style, {
      flex: '1', margin: '0 10px 10px', background: '#050b12', color: '#a8c8d8',
      border: '1px solid #1a3a5a', borderRadius: '4px', padding: '6px 8px',
      fontFamily: "'Share Tech Mono', monospace", fontSize: '9px', resize: 'none',
    });
    overlay.appendChild(logEl);

    document.body.appendChild(overlay);

    header.querySelector('#perf-close-btn').addEventListener('click', closePerfMonitor);
    header.querySelector('#perf-clear-btn').addEventListener('click', () => {
      logLines.length = 0;
      if (logEl) logEl.value = '';
    });
    header.querySelector('#perf-snapshot-btn').addEventListener('click', () => appendLog('SNAPSHOT\n' + buildStatsText()));
    header.querySelector('#perf-copy-btn').addEventListener('click', copyLogToClipboard);
  }

  function copyLogToClipboard() {
    const text = (statsEl ? statsEl.textContent + '\n\n' : '') + logLines.join('\n');
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).catch(() => fallbackCopy(text));
    } else {
      fallbackCopy(text);
    }
  }

  function fallbackCopy(text) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); } catch (e) {}
    document.body.removeChild(ta);
  }

  function buildStatsText() {
    const p = window._omniPerf || {};
    const ctxInfo = getCtxInfo();
    return [
      `FPS: ${fps}   MAX FRAME: ${maxFrameMs.toFixed(1)}ms`,
      `AudioContext: ${ctxInfo.state}   sampleRate=${ctxInfo.sampleRate}   baseLatency=${(ctxInfo.baseLatency*1000).toFixed(1)}ms`,
      `Voices: current=${p.currentVoices||0}   max this session=${p.maxConcurrentVoices||0}   stolen(total)=${p.voicesStolen||0}`,
      `Notes triggered (total): ${p.notesTriggered||0}`,
      `AudioNodes created (total): ${p.nodesCreated||0}   destroyed (total): ${p.nodesDestroyed||0}   alive(approx)=${(p.nodesCreated||0)-(p.nodesDestroyed||0)}`,
      `Saturation curve cache: hits=${p.curveCacheHits||0}  misses=${p.curveCacheMisses||0}`,
    ].join('\n');
  }

  function updateStatsPanel() {
    if (statsEl) statsEl.textContent = buildStatsText();

    // ── 直近区間のレート計算＆急増検知（任意の目安表示） ─────────────────────
    const p = window._omniPerf || {};
    const t = performance.now();
    if (baselineCounters) {
      const dt = (t - baselineTime) / 1000;
      if (dt > 0) {
        const dNodes = (p.nodesCreated || 0) - baselineCounters.nodesCreated;
        const dNotes = (p.notesTriggered || 0) - baselineCounters.notesTriggered;
        const rateLine = document.getElementById('perf-rate-line');
        const text = `rate: ${(dNotes/dt).toFixed(1)} notes/s, ${(dNodes/dt).toFixed(0)} nodes/s created`;
        if (statsEl) statsEl.textContent += '\n' + text;
      }
    }
    baselineCounters = { nodesCreated: p.nodesCreated || 0, notesTriggered: p.notesTriggered || 0 };
    baselineTime = t;

    // voice steal の急増をログに（1回以上ある区間のみ、スロットリング）
    const stolen = p.voicesStolen || 0;
    if (stolen > lastStolenCount && t - lastStolenLogTime > 900) {
      appendLog(`voice-steal: +${stolen - lastStolenCount} in last interval (total ${stolen}) — concurrent voice cap reached`);
      lastStolenLogTime = t;
    }
    lastStolenCount = stolen;
  }

  function rafLoop(ts) {
    if (lastFrameTime) {
      const delta = ts - lastFrameTime;
      frameCount++;
      fpsAccumTime += delta;
      if (delta > maxFrameMs) maxFrameMs = delta;
      if (delta > 50 && ts - lastJankLogTime > 250) {
        appendLog(`frame drop: ${delta.toFixed(1)}ms (UIスレッドが${delta.toFixed(0)}ms間ブロックされた)`);
        lastJankLogTime = ts;
      }
      if (fpsAccumTime >= 1000) {
        fps = Math.round((frameCount * 1000) / fpsAccumTime);
        frameCount = 0;
        fpsAccumTime = 0;
        maxFrameMs = 0;
      }
    }
    lastFrameTime = ts;
    rafId = requestAnimationFrame(rafLoop);
  }

  function attachAudioContextWatcher() {
    if (acStateHandlerAttached) return;
    try {
      const ctx = Tone.getContext().rawContext;
      ctx.addEventListener('statechange', () => {
        appendLog(`AudioContext state changed: ${ctx.state}`);
      });
      acStateHandlerAttached = true;
    } catch (e) {}
  }

  function openPerfMonitor() {
    buildOverlay();
    overlay.style.display = 'flex';
    attachAudioContextWatcher();
    appendLog('--- monitor opened ---');
    lastFrameTime = 0;
    frameCount = 0; fpsAccumTime = 0; maxFrameMs = 0;
    baselineCounters = null;
    rafId = requestAnimationFrame(rafLoop);
    intervalId = setInterval(updateStatsPanel, 500);
    updateStatsPanel();
  }

  function closePerfMonitor() {
    if (overlay) overlay.style.display = 'none';
    if (rafId) cancelAnimationFrame(rafId);
    if (intervalId) clearInterval(intervalId);
    rafId = null; intervalId = null;
  }

  function setupPerfMonitor() {
    const btn = document.getElementById('open-perf-monitor-btn');
    if (btn) btn.addEventListener('click', openPerfMonitor);
  }

  window.setupPerfMonitor = setupPerfMonitor;
})();
