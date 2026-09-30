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

  // v1.5.34: ログ出力の間引き（250ms）とは別に、実際の発生回数・合計時間を
  // 常にカウントする（ログの間引きが原因で「heartbeat dropの方が少なく見える」
  // という見かけ上の誤解が起きていたため。frame drop/heartbeat dropの真の
  // 頻度を公平に比較するにはこの集計が必須）。
  let frameDropCount = 0, frameDropTotalMs = 0;
  let heartbeatDropCount = 0, heartbeatDropTotalMs = 0;

  // v1.5.33: rAFとは独立した「心拍」タイマー。rAFはvsync/描画パイプラインに
  // 紐づくため、rAFの遅延だけでは「描画固有の問題」か「メインスレッド全体の
  // ブロック（GC等）」かを区別できない。setIntervalは描画から独立して
  // スケジュールされるため、両方で同程度の遅延が出れば「メインスレッド全体
  // がブロックされている」ことの強い証拠になる。
  let lastHeartbeatTime = 0;
  let lastHeartbeatLogTime = 0;
  let heartbeatId = null;

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
    // v1.5.24: 全文再構築(join)+強制リフロー(scrollHeight読み取り)を廃止。
    // 従来は毎回ログ全体を文字列化してtextareaのvalueを丸ごと差し替え、
    // 直後にscrollHeightを読み取ってscrollTopに代入していた——scrollHeightの
    // 読み取りはブラウザに保留中のレイアウトを同期的に確定させる（強制リフロー）
    // ため、頻繁な呼び出し（ストラム演奏中は250〜900ms間隔で連続発生）が
    // 演奏そのものと競合してフレーム落ちを悪化させていた。
    // 通常時は追記のみ行い、スクロールは巨大な値を代入するだけにする
    // （ブラウザが自動的に最大値へクランプするためscrollHeightを読む必要がない）。
    const text = `[${nowStr()}] ${line}`;
    logLines.push(text);
    if (logLines.length > 400) {
      logLines.splice(0, logLines.length - 400);
      if (logEl) logEl.value = logLines.join('\n') + '\n'; // 400行超過時のみ稀に再構築
    } else if (logEl) {
      logEl.value += text + '\n';
    }
    if (logEl) logEl.scrollTop = 1e9;
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
    const low = (typeof state !== 'undefined' && state.audioPerformanceMode === 'low');
    return [
      `BUILD: ${window._omniBuild || '?'}   MODE: ${low ? 'LOW POWER' : 'HIGH QUALITY'}   STRUM PATH: ${low ? 'voice-pool (pool voices=' + (p.poolVoices||0) + ')' : 'per-note nodes'}`,
      `RHYTHM: ${(typeof state !== 'undefined' && state.isPlaying) ? 'ON' : 'OFF'}   ` + Object.entries(window._omniProf || {}).map(([k, v]) => `${k}: n=${v.n} avg=${(v.sum / v.n).toFixed(2)}ms max=${v.max.toFixed(1)}ms`).join('   '),
      `BLOCK TOTALS(>50ms): frame drop n=${frameDropCount} sum=${frameDropTotalMs.toFixed(0)}ms   heartbeat drop n=${heartbeatDropCount} sum=${heartbeatDropTotalMs.toFixed(0)}ms  （両者が近ければメインスレッド全体のブロック＝GC等の可能性大）`,
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
      if (delta > 50) {
        frameDropCount++; frameDropTotalMs += delta;
        if (ts - lastJankLogTime > 250) {
          appendLog(`frame drop: ${delta.toFixed(1)}ms (UIスレッドが${delta.toFixed(0)}ms間ブロックされた)`);
          lastJankLogTime = ts;
        }
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

  // v1.5.33: 20ms間隔のsetInterval「心拍」。理想的には毎回ほぼ20msの間隔になる。
  // これが50ms以上開いた場合、rAFの遅延と同時に起きているかどうかで原因を
  // 切り分けられる（両方遅れる＝メインスレッド全体の問題／rAFだけ遅れる＝
  // 描画パイプライン固有の問題）。
  function heartbeatLoop() {
    const t = performance.now();
    if (lastHeartbeatTime) {
      const delta = t - lastHeartbeatTime;
      if (delta > 50) {
        heartbeatDropCount++; heartbeatDropTotalMs += delta;
        if (t - lastHeartbeatLogTime > 250) {
          appendLog(`heartbeat drop: ${delta.toFixed(1)}ms（setIntervalも同程度遅延＝メインスレッド全体がブロックされている可能性が高い）`);
          lastHeartbeatLogTime = t;
        }
      }
    }
    lastHeartbeatTime = t;
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
    lastHeartbeatTime = 0;
    frameDropCount = 0; frameDropTotalMs = 0;
    heartbeatDropCount = 0; heartbeatDropTotalMs = 0;
    baselineCounters = null;
    rafId = requestAnimationFrame(rafLoop);
    heartbeatId = setInterval(heartbeatLoop, 20);
    intervalId = setInterval(updateStatsPanel, 500);
    updateStatsPanel();
  }

  function closePerfMonitor() {
    if (overlay) overlay.style.display = 'none';
    if (rafId) cancelAnimationFrame(rafId);
    if (intervalId) clearInterval(intervalId);
    if (heartbeatId) clearInterval(heartbeatId);
    rafId = null; intervalId = null; heartbeatId = null;
  }

  function setupPerfMonitor() {
    const btn = document.getElementById('open-perf-monitor-btn');
    if (btn) btn.addEventListener('click', openPerfMonitor);
  }

  window.setupPerfMonitor = setupPerfMonitor;
})();
