// ─── FLIGHT RECORDER（v1.5.37・計測専用／演奏の挙動は一切変えない） ───────────────
//
// 目的: 「ノイズが出る操作（コード押下→ストラム→コードを組み合わせ/スライドで変更→
// ストラム）」を、時系列のまま丸ごと記録し、あとから完全に分析できるようにする。
//
// これまでの診断の弱点を2つ潰す:
//  ① フレーム落ち（画面描画）を「ノイズの代理」にしていたが、実際に聞こえる
//     ノイズと連動するか確認していなかった
//     → オーディオクロック(ctx.currentTime)の飛びを直接監視する（AUDIO-CLOCK-STEP）。
//       オーディオ処理が詰まると、壁時計に対してオーディオ時計が遅れる/飛ぶ。
//  ② 耳で聞いたノイズの瞬間をログと結びつける手段が無かった
//     → 画面上部の「● MARK」ボタン。ノイズが聞こえた直後に押すと、直前3秒の
//       全イベントを「インシデント」として保存する。
//
// 記録は固定長リングバッファ（事前確保、演奏中の新規アロケーションなし）。
// モニターを一度開くと開始し、モニターを閉じても記録は続く
// （閉じて演奏→開き直してREPORTをコピー、が可能）。
(function () {
  const N = 4096;                 // 2の累乗（& で巻き戻す）
  const MASK = N - 1;
  const T = new Float64Array(N);
  const CODE = new Uint8Array(N);
  const A = new Float64Array(N), B = new Float64Array(N), C = new Float64Array(N),
        D = new Float64Array(N), E = new Float64Array(N);
  const S1 = new Array(N).fill(null), S2 = new Array(N).fill(null);
  let head = 0, count = 0, t0 = 0;

  window._frecOn = false;

  // イベントコード
  const EV = { CT_ADD: 1, CT_REM: 2, CT_GAP: 3, EVAL: 4, PLAY: 5, REL: 6, STRUM: 7,
               GATE: 8, FDROP: 9, HBDROP: 10, ASTEP: 11, MARK: 12, STATE: 15, LAG: 17, STEALDIAG: 18, GLITCH: 19, TCANCEL: 20, MARKER: 100 };
  window.FREC = EV;

  // 設定変更（リズム/AUTO/HOLD/MODE/GLOW）で区切った「区間別集計」用の累積値
  const tot = { fd: 0, fdSum: 0, hb: 0, hbSum: 0, as: 0, asSum: 0, ev: 0, st: 0 };
  let segs = [];
  function pushSeg(label) { segs.push({ t: performance.now(), label: label, snap: Object.assign({}, tot) }); }
  window.frecStateChange = function (text) {   // 設定変更を記録して区間を区切る
    if (!window._frecOn) return;
    window.frec(EV.STATE, 0, 0, 0, 0, 0, text);
    pushSeg(text);
  };
  const cnt = new Float64Array(32);       // イベントコード別の総数
  const pathCnt = new Float64Array(8);    // evaluateSimpleChordの経路別の総数

  // ── 書き込み（ホットパス。アロケーションなし） ────────────────────────────
  window.frec = function (code, a, b, c, d, e, s1, s2) {
    if (!window._frecOn) return;
    const i = head; head = (head + 1) & MASK;
    if (count < N) count++;
    T[i] = performance.now(); CODE[i] = code;
    A[i] = a || 0; B[i] = b || 0; C[i] = c || 0; D[i] = d || 0; E[i] = e || 0;
    S1[i] = s1 || null; S2[i] = s2 || null;
    cnt[code]++;
    if (code === EV.EVAL) { pathCnt[a | 0]++; tot.ev++; }
    else if (code === EV.STRUM) tot.st++;
  };

  // ── 1秒バケット（全体像用） ──────────────────────────────────────────────
  const PK = ['strum-trigger', 'drum-hit', 'eval', 'playChord', 'releaseChord',
              'elemFromPoint', 'redrawPressed', 'badge', 'touchmove'];
  const buckets = [];
  let cur = null, curSec = -1;
  let prevPerf = null, prevProf = {};
  const bk = () => ({ fd: 0, fdMax: 0, hb: 0, hbMax: 0, as: 0, asMax: 0, lag: 0, mk: 0 });
  let ctr = bk();

  window.frecFrameDrop = function (ms) {
    if (!window._frecOn) return;
    ctr.fd++; if (ms > ctr.fdMax) ctr.fdMax = ms;
    tot.fd++; tot.fdSum += ms;
    window.frec(EV.FDROP, ms);
  };
  window.frecHbDrop = function (ms) {
    if (!window._frecOn) return;
    ctr.hb++; if (ms > ctr.hbMax) ctr.hbMax = ms;
    tot.hb++; tot.hbSum += ms;
    window.frec(EV.HBDROP, ms);
    autoIncident('HEARTBEAT ' + ms.toFixed(0) + 'ms', ms > 80);
  };
  // 入力イベントが実際に処理されるまでの遅れ（メインスレッド詰まり or イベントキュー遅延）
  window.frecLag = function (ms, src) {
    if (!window._frecOn) return;
    if (ms > ctr.lag) ctr.lag = ms;
    if (ms > 40) window.frec(EV.LAG, ms, src, window._lastRafT ? performance.now() - window._lastRafT : -1);
  };

  function closeBucket(sec) {
    const p = window._omniPerf || {};
    const prof = window._omniProf || {};
    const b = { s: sec, ctr: ctr,
      notes: (p.notesTriggered || 0) - (prevPerf ? prevPerf.notes : 0),
      steals: (p.voicesStolen || 0) - (prevPerf ? prevPerf.steals : 0),
      n: {}, mx: {} };
    for (const k of PK) {
      const s = prof[k];
      if (!s) { b.n[k] = 0; b.mx[k] = 0; continue; }
      b.n[k] = s.n - (prevProf[k] || 0); prevProf[k] = s.n;
      b.mx[k] = s.bmax || 0; s.bmax = 0;
    }
    prevPerf = { notes: p.notesTriggered || 0, steals: p.voicesStolen || 0 };
    buckets.push(b);
    if (buckets.length > 120) buckets.shift();
    ctr = bk();
  }

  // ── インシデント（異常の前後を保存） ─────────────────────────────────────
  const incidents = [];
  let lastAutoT = -1e9;
  function snapshot(fromT, toT) {
    const rows = [];
    const start = (head - count) & MASK;
    for (let k = 0; k < count; k++) {
      const i = (start + k) & MASK;
      if (T[i] < fromT || T[i] > toT) continue;
      rows.push([T[i], CODE[i], A[i], B[i], C[i], D[i], E[i], S1[i], S2[i], i]);  // 末尾=リング通し位置（重複排除用）
    }
    return rows;
  }
  function autoIncident(label, cond) {
    if (!cond) return;
    const now = performance.now();
    if (now - lastAutoT < 1500) return;
    lastAutoT = now;
    setTimeout(() => {           // 異常の「後」0.4秒も含めて保存する
      const _ai = { kind: 'AUTO ' + label, t: now, rows: snapshot(now - 1000, now + 400) };
      incidents.push(_ai);
      requestDump(_ai, 1.0);
      let autos = incidents.filter(x => x.kind.startsWith('AUTO'));
      while (autos.length > 6) { incidents.splice(incidents.indexOf(autos[0]), 1); autos.shift(); }
    }, 400);
  }
  let markCount = 0;
  window.frecMark = function () {
    if (!window._frecOn) return 0;
    const now = performance.now();
    markCount++; ctr.mk++;
    window.frec(EV.MARK, markCount);
    const _inc = { kind: 'MARK #' + markCount + '（耳でノイズを確認）', t: now, rows: snapshot(now - 5000, now) };
    incidents.push(_inc);
    requestDump(_inc, 5.3);
    const marks = incidents.filter(x => x.kind.startsWith('MARK'));
    while (marks.length > 8) { incidents.splice(incidents.indexOf(marks[0]), 1); marks.shift(); }
    return markCount;
  };

  // ── オーディオクロック監視（実際の音の途切れの直接指標） ────────────────────
  // 壁時計(performance.now)とオーディオ時計(ctx.currentTime)の差(offset)は本来ほぼ一定。
  // オーディオ処理が詰まると、オーディオ時計が壁時計に対して遅れる/飛ぶので offset が
  // 階段状に変化する。3点の中央値で量子化ジッターを抑え、約200msの間に30ms超
  // 変化したら記録する。
  const offHist = [0, 0, 0, 0, 0, 0];   // |変化| <5,<10,<20,<30,<50,>=50 ms
  let o1 = 0, o2 = 0, o3 = 0, oN = 0, medHist = [], lastTick = 0, stateSnap = null;
  function tick() {
    const now = performance.now();
    if (lastTick) {
      const g = now - lastTick;
      if (g > 50) window.frecHbDrop(g);
    }
    lastTick = now;

    try {
      const ctx = Tone.getContext().rawContext;
      if (ctx.state === 'running') {
        // 3点中央値（量子化ジッター対策）。配列を作らず変数で回す（20msごとの処理のため）
        o1 = o2; o2 = o3; o3 = now - ctx.currentTime * 1000;
        if (++oN > 3) oN = 3;
        if (oN === 3) {
          const m = Math.max(Math.min(o1, o2), Math.min(Math.max(o1, o2), o3));
          // 連続した停止は20msごとの小さな増加として現れるため、約200ms(10ティック)前
          // との差で判定する。検出後は履歴を捨て、新しい水準を基準にし直す
          // （停止後もオーディオ時計の遅れは残るので、同じ飛びを重複報告しない）。
          if (medHist.length >= 10) {
            const j = m - medHist[0], aj = Math.abs(j);
            offHist[aj < 5 ? 0 : aj < 10 ? 1 : aj < 20 ? 2 : aj < 30 ? 3 : aj < 50 ? 4 : 5]++;
            if (aj > 20) {
              ctr.as++; if (aj > ctr.asMax) ctr.asMax = aj;
              tot.as++; tot.asSum += aj;
              window.frec(EV.ASTEP, j);
              autoIncident('AUDIO-CLOCK ' + (j > 0 ? '+' : '') + j.toFixed(0) + 'ms', aj > 30);
              medHist = [];
            } else { medHist.shift(); }
          }
          medHist.push(m);
        }
      } else { oN = 0; medHist = []; }
    } catch (e) {}

    if (!probe.node && !probe.initing && probe.on) probeInit();
    const sec = Math.floor((now - t0) / 1000);
    if (sec !== curSec) {
      if (curSec >= 0) closeBucket(curSec);
      curSec = sec;
      pollState();
    }
  }

  // 設定状態の変化を記録（リズムON/OFF、CHORD AUTO、HOLD、モード）
  function pollState() {
    try {
      const c = Tone.getContext().rawContext;
      if (typeof c.getOutputTimestamp === 'function') {
        const ts = c.getOutputTimestamp();
        if (ts && ts.contextTime > 0) {
          const lead = (c.currentTime - ts.contextTime) * 1000;
          probe.outTs = 'supported'; probe.leadN++;
          if (lead < probe.leadMin) probe.leadMin = lead; if (lead > probe.leadMax) probe.leadMax = lead;
        }
      } else probe.outTs = 'unsupported';
    } catch (e) {}
    if (typeof state === 'undefined') return;
    const s = [state.isPlaying ? 1 : 0, state.chordAuto ? 1 : 0, state.chordHold ? 1 : 0, state.audioPerformanceMode === 'low' ? 1 : 0];
    const names = [['RHYTHM OFF', 'RHYTHM ON'], ['CHORD AUTO OFF', 'CHORD AUTO ON'], ['CHORD HOLD OFF', 'CHORD HOLD ON'], ['MODE HIGH QUALITY', 'MODE LOW POWER']];
    if (stateSnap) {
      for (let i = 0; i < 4; i++) if (s[i] !== stateSnap[i]) window.frecStateChange(names[i][s[i]]);
    } else {
      for (let i = 0; i < 4; i++) window.frec(EV.STATE, 0, 0, 0, 0, 0, names[i][s[i]]);
      segs[0].label = '開始時: ' + names.map((n, i) => n[s[i]]).join(' / ');
    }
    stateSnap = s;
  }

  // ── MARKボタン（記録中のみ表示） ─────────────────────────────────────────
  function buildMarkButton() {
    if (document.getElementById('frec-mark-btn')) return;
    const b = document.createElement('div');
    b.id = 'frec-mark-btn';
    b.textContent = '● MARK';
    Object.assign(b.style, {
      position: 'fixed', top: '4px', left: '50%', transform: 'translateX(-50%)',
      zIndex: '450', padding: '6px 14px', borderRadius: '14px', fontSize: '11px',
      letterSpacing: '2px', fontFamily: "'Orbitron',sans-serif", color: '#fff',
      background: 'rgba(192,57,43,0.85)', border: '1px solid #ff8a80',
      userSelect: 'none', webkitUserSelect: 'none', touchAction: 'manipulation',
    });
    b.addEventListener('pointerdown', e => {
      e.preventDefault(); e.stopPropagation();
      const n = window.frecMark();
      b.textContent = '✓ MARK ' + n;
      setTimeout(() => { b.textContent = '● MARK'; }, 700);
    });
    document.body.appendChild(b);

    // GLOW切替（実験用）: 影・光彩・遷移・アニメーションを一括で無効にして、描画負荷が原因かを
    // 同じ演奏の途中で切り替えて比較できるようにする。既定はON(通常)で、見た目は変わらない。
    const g = document.createElement('div');
    g.id = 'frec-glow-btn';
    g.textContent = 'GLOW:ON';
    Object.assign(g.style, {
      position: 'fixed', top: '4px', left: 'calc(50% + 58px)',
      zIndex: '450', padding: '6px 10px', borderRadius: '14px', fontSize: '11px',
      letterSpacing: '1px', fontFamily: "'Orbitron',sans-serif", color: '#fff',
      background: 'rgba(39,174,96,0.85)', border: '1px solid #a5d6a7',
      userSelect: 'none', webkitUserSelect: 'none', touchAction: 'manipulation',
    });
    g.addEventListener('pointerdown', e => {
      e.preventDefault(); e.stopPropagation();
      if (!document.getElementById('frec-noglow-style')) {
        const st = document.createElement('style');
        st.id = 'frec-noglow-style';
        st.textContent = 'body.diag-noglow *,body.diag-noglow *::before,body.diag-noglow *::after{box-shadow:none!important;text-shadow:none!important;transition:none!important;animation:none!important;filter:none!important}body.diag-noglow .simple-key.pressed{transform:none!important}body.diag-noglow .chord-resolved-badge{display:none!important}';
        document.head.appendChild(st);
      }
      const off = !document.body.classList.contains('diag-noglow');
      document.body.classList.toggle('diag-noglow', off);
      g.textContent = off ? 'GLOW:OFF' : 'GLOW:ON';
      g.style.background = off ? 'rgba(127,127,127,0.85)' : 'rgba(39,174,96,0.85)';
      window.frecStateChange(off ? 'GLOW OFF（影・光彩・遷移・アニメ無効）' : 'GLOW ON（通常）');
    });
    document.body.appendChild(g);

    // PROBE切替: 出力波形プローブのON/OFF（診断あり/なしの比較用）
    const pb = document.createElement('div');
    pb.id = 'frec-probe-btn';
    pb.textContent = 'PROBE:ON';
    Object.assign(pb.style, {
      position: 'fixed', top: '4px', left: 'calc(50% + 140px)',
      zIndex: '450', padding: '6px 10px', borderRadius: '14px', fontSize: '11px',
      letterSpacing: '1px', fontFamily: "'Orbitron',sans-serif", color: '#fff',
      background: 'rgba(41,128,185,0.85)', border: '1px solid #90caf9',
      userSelect: 'none', webkitUserSelect: 'none', touchAction: 'manipulation',
    });
    pb.addEventListener('pointerdown', e => {
      e.preventDefault(); e.stopPropagation();
      const on = window.frecProbeToggle();
      pb.textContent = on ? 'PROBE:ON' : 'PROBE:OFF';
      pb.style.background = on ? 'rgba(41,128,185,0.85)' : 'rgba(127,127,127,0.85)';
    });
    document.body.appendChild(pb);
  }


  // ── 出力波形プローブ（v1.5.40・計測専用） ───────────────────────────────────
  // omnitro-glitch-probe.js（AudioWorklet・出力なし）を instBus / masterOut に「受動的に」
  // 追加接続し、出力波形の段差（クリック）を直接調べる。音声経路は変更しない。
  // ・PROBEボタンでON/OFFでき、OFF時は両方のバスから切断する（診断の有無での比較用）。
  // ・グラフ内の信号しか見えない。ブラウザ/OS/デバイス段の出力欠損はここには現れない。
  const probe = { node: null, initing: false, on: true, status: '未初期化', flags: 0, dumps: 0,
                  gran: null, leadMin: Infinity, leadMax: -Infinity, leadN: 0, outTs: 'unknown' };
  const pendingDump = new Map();
  let dumpSeq = 0;
  function probeConnect(on) {
    if (!probe.node) return;
    try {
      if (on) { window._instBus.connect(probe.node, 0, 0); window._recMasterOut.connect(probe.node, 0, 1); }
      else { try { window._instBus.disconnect(probe.node); } catch (e) {} try { window._recMasterOut.disconnect(probe.node); } catch (e) {} }
    } catch (e) { probe.status = '接続エラー: ' + (e && e.message ? e.message : e); }
  }
  async function probeInit() {
    if (probe.node || probe.initing) return;
    if (!window._instBus || !window._recMasterOut) return;           // まだ音声グラフ未作成
    probe.initing = true;
    try {
      const toneCtx = Tone.getContext(), ctx = toneCtx.rawContext;
      if (!ctx.audioWorklet) { probe.status = 'AudioWorklet非対応'; return; }
      await toneCtx.addAudioWorkletModule('omnitro-glitch-probe.js');
      const node = toneCtx.createAudioWorkletNode('omnitro-glitch-probe', {
        numberOfInputs: 2, numberOfOutputs: 0, channelCount: 2,
        channelCountMode: 'explicit', channelInterpretation: 'discrete' });
      node.port.onmessage = (e) => {
        const m = e.data;
        if (!window._frecOn) return;
        if (m.type === 'flag') {
          probe.flags++;
          window.frec(EV.GLITCH, m.input, m.peak, m.d1, m.d2, m.frame / m.sampleRate, m.ema.toFixed(5));
        } else if (m.type === 'dump') {
          const inc = pendingDump.get(m.id); pendingDump.delete(m.id);
          if (inc) { inc.probe = m; probe.dumps++; }
        }
      };
      probe.node = node;
      if (probe.on) probeConnect(true);
      probe.status = probe.on ? '稼働中（instBus + masterOut を受動監視）' : 'OFF';
      // currentTimeの更新刻み（非ブロッキング：MessageChannelで多数回読む）
      try {
        const mc = new MessageChannel(); let last = ctx.currentTime; const steps = []; const tEnd = performance.now() + 300;
        mc.port1.onmessage = () => {
          const c = ctx.currentTime;
          if (c !== last) { steps.push((c - last) * 1000); last = c; }
          if (performance.now() < tEnd) mc.port2.postMessage(0);
          else {
            steps.sort((a, b) => a - b);
            probe.gran = steps.length ? { n: steps.length, min: steps[0], med: steps[steps.length >> 1], max: steps[steps.length - 1] } : { n: 0 };
          }
        };
        mc.port2.postMessage(0);
      } catch (e) {}
    } catch (e) {
      probe.status = '初期化失敗: ' + (e && e.name ? e.name + ': ' : '') + (e && e.message ? e.message : e);
    } finally { probe.initing = false; }
  }
  function requestDump(inc, seconds) {
    if (!probe.node || !probe.on) return;
    try {
      const sr = Tone.getContext().rawContext.sampleRate;
      const id = ++dumpSeq; pendingDump.set(id, inc);
      probe.node.port.postMessage({ cmd: 'dump', id: id, count: Math.ceil(seconds * sr / 128) });
    } catch (e) {}
  }
  window.frecProbeToggle = function () {
    probe.on = !probe.on;
    if (probe.node) { probeConnect(probe.on); probe.status = probe.on ? '稼働中（instBus + masterOut を受動監視）' : 'OFF'; }
    window.frecStateChange(probe.on ? 'PROBE ON（出力波形を監視）' : 'PROBE OFF（監視なし）');
    return probe.on;
  };

  let tickId = null;
  window.frecStart = function () {
    if (window._frecOn) return;
    t0 = performance.now(); head = 0; count = 0; curSec = -1; buckets.length = 0;
    prevPerf = null; prevProf = {}; ctr = bk(); incidents.length = 0; markCount = 0;
    probe.flags = 0; probe.dumps = 0; pendingDump.clear();
    cnt.fill(0); pathCnt.fill(0); offHist.fill(0); oN = 0; medHist = []; stateSnap = null;
    for (const k in tot) tot[k] = 0;
    segs = [{ t: t0, label: '開始', snap: Object.assign({}, tot) }];
    window._frecOn = true;
    tickId = setInterval(tick, 20);
    buildMarkButton();
  };
  window.frecIsOn = () => window._frecOn;

  // ── レポート生成（COPYして貼り付ける用） ──────────────────────────────────
  const PATHS = ['release-all(HOLD維持)', 'release-all(解除)', 'partial-release(維持)', 'special(sus4/add9)', 'normal(1〜複数ボタン)', 'invalid(組合せ無効→解除)'];
  const TYPE_COL = ['MAJ', 'MIN', '7'];
  const rootName = r => (typeof OMNI_ROOT_DISPLAY !== 'undefined' && OMNI_ROOT_DISPLAY[r]) || ('r' + r);
  const f1 = x => x.toFixed(1), f2 = x => x.toFixed(2);

  function decode(r) {
    const ts = ((r[0] - t0) / 1000).toFixed(3);
    const [, code, a, b, c, d, e, s1, s2] = r;
    switch (code) {
      case EV.CT_ADD:  return `${ts} 指${a} ボタン押下 ${rootName(b)}-${TYPE_COL[c]} (押下中=${d})`;
      case EV.CT_REM:  return `${ts} 指${a} ボタン離れ ${rootName(b)}-${TYPE_COL[c]} (押下中=${d})`;
      case EV.CT_GAP:  return `${ts} 指${a} ボタン間の隙間/範囲外 → 離れ扱い`;
      case EV.EVAL:    return `${ts} EVAL ${PATHS[a] || a} → ${s1 ? s1 + ' ' + (s2 || '') : '(コード無し)'} 押下=${b} 保持=${c} ${d ? 'コード発音' : ''} ${f2(e)}ms`;
      case EV.PLAY:    return `${ts} PLAYCHORD 音数=${a} ${f2(b)}ms(うちtriggerAttack ${f2(e)}ms)${c ? ' ★voice再構築' : ''} Tone発音中voice=${d}`;
      case EV.REL:     return `${ts} RELEASECHORD 音数=${a} ${f2(b)}ms`;
      case EV.STRUM:   return `${ts} STRUM ${s1 || ''} 区間${a}/13 vel=${b}${c ? ' STEAL' : ''} ${f2(d)}ms${e ? ' 音声時刻=' + e.toFixed(3) + 's' : ''}`;
      case EV.GATE:    return `${ts} STRUM-GATE 22ms未満の発音を間引き`;
      case EV.FDROP:   return `${ts} FRAME-DROP ${f1(a)}ms`;
      case EV.HBDROP:  return `${ts} HEARTBEAT-DROP ${f1(a)}ms`;
      case EV.ASTEP:   return `${ts} ★AUDIO-CLOCK-STEP ${a > 0 ? '+' : ''}${f1(a)}ms（オーディオ処理の遅れ/飛び）`;
      case EV.STEALDIAG: return `${ts}   └奪取時の診断: g.value読取=${a.toFixed(4)} 理論値=${b.toFixed(4)} (ピーク比${d > 0 ? Math.round(b / d * 100) : '?'}%) 経過${f1(c)}ms${e >= 0 && e < 99 ? ' プール#' + e : ''} ${Math.abs(a - b) > Math.max(0.002, b * 0.3) ? '★読取値が理論値とズレ' : ''}`;
      case EV.GLITCH:  return `${ts} ◆WAVE-GLITCH候補 ${a ? '出力後(masterOut)' : 'コンプ前(instBus)'} 音声時刻=${e.toFixed(3)}s peak=${b.toFixed(3)} 1次差=${c.toFixed(3)} 2次差=${d.toFixed(3)} (移動平均${s1})`;
      case EV.TCANCEL: return `${ts} ★TOUCHCANCEL ${a ? 'コード' : 'ストラム'} 取消=${b}本 画面上の残り=${c}本`;
      case EV.MARKER:  return `${ts} ▶▶▶ ${s1}`;
      case EV.MARK:    return `${ts} ●MARK #${a}`;
      case EV.STATE:   return `${ts} 設定: ${s1}`;
      case EV.LAG:     return `${ts} INPUT-LAG ${f1(a)}ms (${b ? 'コード' : 'ストラム'}の入力が処理されるまでの遅れ／直近rAFから${c < 0 ? '?' : f1(c)}ms)`;
      default:         return `${ts} code${code}`;
    }
  }

  window.frecReport = function () {
    if (!window._frecOn) return '(記録は開始されていません。モニターを開くと開始します)';
    const now = performance.now();
    const L = [];
    const low = typeof state !== 'undefined' && state.audioPerformanceMode === 'low';
    L.push(`=== OMNITRO FLIGHT REPORT ===`);
    L.push(`BUILD ${window._omniBuild || '?'}  MODE ${low ? 'LOW POWER' : 'HIGH QUALITY'}  記録時間 ${((now - t0) / 1000).toFixed(1)}s`);
    if (typeof state !== 'undefined')
      L.push(`現在の設定: RHYTHM=${state.isPlaying ? 'ON' : 'OFF'} CHORD_AUTO=${state.chordAuto ? 'ON' : 'OFF'} CHORD_HOLD=${state.chordHold ? 'ON' : 'OFF'}`);
    L.push(`MARK回数=${markCount}  AUDIO-CLOCK-STEP総数=${cnt[EV.ASTEP]}  FRAME-DROP総数=${cnt[EV.FDROP]}  HEARTBEAT-DROP総数=${cnt[EV.HBDROP]}  INPUT-LAG(>40ms)総数=${cnt[EV.LAG]}`);
    L.push('');
    L.push('--- 処理時間 (n=回数 avg/max ms) ---');
    const prof = window._omniProf || {};
    L.push(Object.keys(prof).map(k => `${k}: n=${prof[k].n} avg=${f2(prof[k].sum / prof[k].n)} max=${f1(prof[k].max)}`).join('\n'));
    L.push('');
    L.push('--- コード判定(evaluateSimpleChord)の経路別回数 ---');
    L.push(PATHS.map((n, i) => `${n}: ${pathCnt[i]}`).join('\n'));
    L.push(`ボタン押下=${cnt[EV.CT_ADD]} ボタン離れ=${cnt[EV.CT_REM]} 隙間/範囲外通過=${cnt[EV.CT_GAP]}  PLAYCHORD=${cnt[EV.PLAY]} RELEASECHORD=${cnt[EV.REL]}  STRUM発音=${cnt[EV.STRUM]} 間引き=${cnt[EV.GATE]}`);
    L.push('');
    L.push(`--- オーディオクロック変化の分布（3点中央値の1回あたり変化量 ms）。20ms超が記録され、30ms超でインシデント化される ---`);
    L.push('※連続した飛びは複数件(+40,+40…)に分かれて記録されることがあります。合計が停止時間の目安です。');
    L.push(`<5:${offHist[0]}  <10:${offHist[1]}  <20:${offHist[2]}  <30:${offHist[3]}  <50:${offHist[4]}  >=50:${offHist[5]}`);
    L.push('');
    L.push('--- 音声コンテキスト情報 / 出力波形プローブ（v1.5.40） ---');
    try {
      const c = Tone.getContext().rawContext;
      L.push(`sampleRate=${c.sampleRate} baseLatency=${c.baseLatency != null ? (c.baseLatency * 1000).toFixed(1) + 'ms' : 'n/a'} outputLatency=${c.outputLatency != null ? (c.outputLatency * 1000).toFixed(1) + 'ms' : 'n/a'} state=${c.state}`);
    } catch (e) {}
    L.push(`ctx.currentTime更新刻み(起動時300ms計測): ${probe.gran ? (probe.gran.n ? `n=${probe.gran.n} 最小=${probe.gran.min.toFixed(2)}ms 中央=${probe.gran.med.toFixed(2)}ms 最大=${probe.gran.max.toFixed(2)}ms` : '変化を観測できず') : '未計測'}`);
    L.push(`getOutputTimestamp: ${probe.outTs}${probe.leadN ? ` / currentTime−出力位置 の先行量 最小=${probe.leadMin.toFixed(1)}ms 最大=${probe.leadMax.toFixed(1)}ms (n=${probe.leadN})` : ''}`);
    L.push(`プローブ状態: ${probe.status} / 即時フラグ総数=${probe.flags} / ダンプ取得=${probe.dumps}件`);
    L.push('※プローブが見るのはWeb Audioグラフ内の信号のみ。ブラウザの出力バッファ・OS・デバイス段の欠損は検出できない。');
    L.push('');
    L.push('--- 区間別集計（設定変更で区切る。同じ演奏の途中でGLOW等を切り替えた比較用）---');
    for (let i = 0; i < segs.length; i++) {
      const a0 = segs[i], b0 = segs[i + 1];
      const endT = b0 ? b0.t : now, endS = b0 ? b0.snap : tot, d = (endT - a0.t) / 1000;
      if (d < 0.5) continue;
      const g = k => endS[k] - a0.snap[k];
      const perMin = x => (x / d * 60).toFixed(1);
      L.push(`[${((a0.t - t0) / 1000).toFixed(1)}〜${((endT - t0) / 1000).toFixed(1)}s ${d.toFixed(1)}秒] ${a0.label}`);
      L.push(`   コード判定${g('ev')} ストラム${g('st')} | 描画落ち${g('fd')}回(合計${g('fdSum').toFixed(0)}ms, ${perMin(g('fd'))}回/分) | 音飛び${g('as')}回(合計${g('asSum').toFixed(0)}ms, ${perMin(g('as'))}回/分) | HB遅延${g('hb')}回`);
    }
    // 相関サマリ: 音飛びの前後に何があったかを数える（目視ではなく数字で）
    const ev = { fd100: [], hb: [], ct: [], st: [], pl: [], as: [] };
    { const start = (head - count) & MASK;
      for (let k = 0; k < count; k++) {
        const i = (start + k) & MASK, c = CODE[i];
        if (c === EV.FDROP && A[i] >= 100) ev.fd100.push(T[i]);
        else if (c === EV.HBDROP) ev.hb.push(T[i]);
        else if (c === EV.CT_ADD) ev.ct.push(T[i]);
        else if (c === EV.STRUM) ev.st.push(T[i]);
        else if (c === EV.PLAY) ev.pl.push(T[i]);
        else if (c === EV.ASTEP) ev.as.push(T[i]);
      } }
    const near = (arr, t, lo, hi) => arr.some(x => x - t >= lo && x - t <= hi);
    if (ev.as.length) {
      let nFd = 0, nHb = 0, nCt = 0, nSt = 0, nPl = 0, nNone = 0;
      for (const ta of ev.as) {
        const a1 = near(ev.fd100, ta, -400, 200), a2 = near(ev.hb, ta, -400, 200),
              a3 = near(ev.ct, ta, -600, 0), a4 = near(ev.st, ta, -300, 100), a5 = near(ev.pl, ta, -600, 0);
        if (a1) nFd++; if (a2) nHb++; if (a3) nCt++; if (a4) nSt++; if (a5) nPl++;
        if (!a1 && !a2 && !a3 && !a4 && !a5) nNone++;
      }
      const act = buckets.filter(b => b.notes > 0 || b.n['eval'] > 0 || b.n['drum-hit'] > 0);
      const pc = f => act.length ? Math.round(act.filter(f).length / act.length * 100) : 0;
      L.push('');
      L.push('--- 音飛び(AUDIO-CLOCK-STEP)の相関サマリ ---');
      L.push(`音飛び${ev.as.length}件のうち: 描画落ち≥100msが併発(前400ms〜後200ms)=${nFd}件 / HEARTBEAT遅延が併発=${nHb}件 / 直前600msにコードボタン押下=${nCt}件 / 直前300msにストラム発音=${nSt}件 / 直前600msにPLAYCHORD=${nPl}件 / どれにも該当しない=${nNone}件`);
      L.push(`（比較用の基準）演奏のあった${act.length}秒のうち、コード判定があった秒=${pc(b => b.n['eval'] > 0)}% ストラム発音があった秒=${pc(b => b.notes > 0)}%。音飛びの前にこの割合より明らかに多く出ている操作が、関連が強い候補`);
    }
    L.push('');
    L.push('--- 1秒ごとの推移（直近最大120秒）---');
    L.push('秒 | 発音 steal | ドラム | コード判定 | evalMax pcMax efpMax rdMax bdMax stMax dtMax | 描画落ち(回/最大) HB(回/最大) 音飛び(回/最大) 入力遅れmax MARK');
    for (const b of buckets) {
      const m = b.mx, c = b.ctr;
      L.push(`${b.s} | ${b.notes} ${b.steals} | ${b.n['drum-hit']} | ${b.n['eval']} | ${f1(m['eval'])} ${f1(m['playChord'])} ${f1(m['elemFromPoint'])} ${f1(m['redrawPressed'])} ${f1(m['badge'])} ${f1(m['strum-trigger'])} ${f1(m['drum-hit'])} | ${c.fd}/${c.fdMax.toFixed(0)} ${c.hb}/${c.hbMax.toFixed(0)} ${c.as}/${c.asMax.toFixed(0)} ${c.lag.toFixed(0)} ${c.mk ? '●' : ''}`);
    }
    // ── 出力波形プローブの解析（インシデントごと） ────────────────────────────
    function median(arr) { if (!arr.length) return 0; const c = Float32Array.from(arr).sort(); return c[c.length >> 1]; }
    L.push('');
    L.push('--- 出力波形プローブ：インシデント窓内の2次差分(d2)上位候補 ---');
    L.push('d2=2次差分の最大値（クリック/段差の指標）。倍率=d2÷窓内の中央値(peak>0.001の量子のみ)。音声時刻差は直近のSTRUM発音(音声時刻)との差で、+はSTRUMより後、STEAL印はそのSTRUMがボイス奪取。');
    for (const inc of incidents) {
      const pr = inc.probe;
      if (!pr) { L.push(`[${inc.kind}] プローブのダンプ無し（PROBE OFF / 未初期化 / 取得前）`); continue; }
      const k = pr.frames.length, sr = pr.sampleRate;
      const endF = pr.frames[k - 1] + 128;
      const stl = [];                                    // STRUM発音の音声時刻 [t, steal]
      for (const r of inc.rows) if (r[1] === EV.STRUM && r[6] > 0) stl.push([r[6], r[4] ? 1 : 0]);
      L.push(`[${inc.kind}] 窓=${(k * 128 / sr).toFixed(2)}s 量子数=${k}`);
      for (let inp = 0; inp < 2; inp++) {
        const d2s = [], idxs = [];
        for (let j = 0; j < k; j++) { if (pr.stats[j * 6 + inp * 3] > 0.001) { d2s.push(pr.stats[j * 6 + inp * 3 + 2]); idxs.push(j); } }
        const med = Math.max(median(d2s), 1e-5);
        const order = idxs.slice().sort((x, y) => pr.stats[y * 6 + inp * 3 + 2] - pr.stats[x * 6 + inp * 3 + 2]).slice(0, 4);
        const over = idxs.filter(j => pr.stats[j * 6 + inp * 3 + 2] > Math.max(0.004, med * 12)).length;
        L.push(`  ${inp ? '出力後(masterOut)' : 'コンプ前(instBus)'}: 中央値d2=${med.toFixed(4)} 倍率>12かつd2>0.004の量子=${over}個`);
        for (const j of order) {
          const d2 = pr.stats[j * 6 + inp * 3 + 2], d1 = pr.stats[j * 6 + inp * 3 + 1], pk = pr.stats[j * 6 + inp * 3];
          const tAudio = pr.frames[j] / sr;
          let best = null;
          for (const [ts, st] of stl) { const dt = (tAudio - ts) * 1000; if (best === null || Math.abs(dt) < Math.abs(best[0])) best = [dt, st]; }
          L.push(`    窓末尾から${((endF - pr.frames[j]) / sr).toFixed(3)}s前 (音声時刻${tAudio.toFixed(3)}s) peak=${pk.toFixed(3)} d1=${d1.toFixed(4)} d2=${d2.toFixed(4)} 倍率=${(d2 / med).toFixed(1)}${best ? ` / 直近STRUMとの差=${best[0] >= 0 ? '+' : ''}${best[0].toFixed(0)}ms${best[1] ? '(STEAL)' : ''}` : ''}`);
        }
      }
    }
    // 即時フラグとSTEALの時間関係（リング内の全イベント）
    { const gl = [], sl = [];
      const start0 = (head - count) & MASK;
      for (let k = 0; k < count; k++) {
        const i = (start0 + k) & MASK;
        if (CODE[i] === EV.GLITCH) gl.push([E[i], A[i]]);
        else if (CODE[i] === EV.STRUM && E[i] > 0) sl.push([E[i], C[i] ? 1 : 0]);
      }
      if (gl.length || probe.node) {
        let nearSteal = 0, nearPlain = 0, none = 0;
        for (const [tg] of gl) {
          let hit = 0;
          for (const [ts, st] of sl) { const dt = (tg - ts) * 1000; if (dt >= -5 && dt <= 40) { hit = st ? 2 : 1; if (st) break; } }
          if (hit === 2) nearSteal++; else if (hit === 1) nearPlain++; else none++;
        }
        const nSt = sl.filter(x => x[1]).length;
        L.push('');
        L.push(`--- 即時フラグ(${gl.length}件)とSTRUM発音の時間関係（音声時刻で比較：STRUMの5ms前〜40ms後） ---`);
        L.push(`STEALの直後=${nearSteal}件 / 通常発音の直後=${nearPlain}件 / どちらでもない=${none}件  （参考：リング内STRUM=${sl.length}件のうちSTEAL=${nSt}件）`);
        L.push('※STEAL直後に集中すれば「再利用時の急な切断」の候補。集中しなければ別の原因（またはグラフ外）の可能性。');
      }
    }
    L.push('');
    L.push(`--- 時系列（インシデント${incidents.length}件の前後を統合・重複排除。MARK=耳でノイズを確認した直前5秒／AUTO=音飛び・メインスレッド停止の前1秒後0.4秒）---`);
    const map = new Map();
    for (const inc of incidents) {
      for (const r of inc.rows) { const key = r[0] + '|' + r[9]; if (!map.has(key)) map.set(key, r); }  // 時刻+リング位置で一意（同時刻の別イベントを消さない）
    }
    const rows = Array.from(map.values());
    for (const inc of incidents) if (inc.kind.startsWith('AUTO')) rows.push([inc.t, EV.MARKER, 0, 0, 0, 0, 0, inc.kind, null]);
    rows.sort((x, y) => (x[0] - y[0]) || (x[1] - y[1]));
    L.push(`（イベント${rows.length}件）`);
    let prevT = null;
    for (const r of rows) {
      if (prevT !== null && r[0] - prevT > 1200) L.push(`   …（${((r[0] - prevT) / 1000).toFixed(1)}秒省略）…`);
      L.push(decode(r));
      prevT = r[0];
    }
    return L.join('\n');
  };
})();
