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
               GATE: 8, FDROP: 9, HBDROP: 10, ASTEP: 11, MARK: 12, STATE: 15, LAG: 17, STEALDIAG: 18, MARKER: 100 };
  window.FREC = EV;

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
    if (code === EV.EVAL) pathCnt[a | 0]++;
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
    window.frec(EV.FDROP, ms);
  };
  window.frecHbDrop = function (ms) {
    if (!window._frecOn) return;
    ctr.hb++; if (ms > ctr.hbMax) ctr.hbMax = ms;
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
      incidents.push({ kind: 'AUTO ' + label, t: now, rows: snapshot(now - 1000, now + 400) });
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
    incidents.push({ kind: 'MARK #' + markCount + '（耳でノイズを確認）', t: now, rows: snapshot(now - 3000, now) });
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
              window.frec(EV.ASTEP, j);
              autoIncident('AUDIO-CLOCK ' + (j > 0 ? '+' : '') + j.toFixed(0) + 'ms', aj > 30);
              medHist = [];
            } else { medHist.shift(); }
          }
          medHist.push(m);
        }
      } else { oN = 0; medHist = []; }
    } catch (e) {}

    const sec = Math.floor((now - t0) / 1000);
    if (sec !== curSec) {
      if (curSec >= 0) closeBucket(curSec);
      curSec = sec;
      pollState();
    }
  }

  // 設定状態の変化を記録（リズムON/OFF、CHORD AUTO、HOLD、モード）
  function pollState() {
    if (typeof state === 'undefined') return;
    const s = [state.isPlaying ? 1 : 0, state.chordAuto ? 1 : 0, state.chordHold ? 1 : 0, state.audioPerformanceMode === 'low' ? 1 : 0];
    if (stateSnap) {
      if (s[0] !== stateSnap[0]) window.frec(EV.STATE, 0, 0, 0, 0, 0, s[0] ? 'RHYTHM ON' : 'RHYTHM OFF');
      if (s[1] !== stateSnap[1]) window.frec(EV.STATE, 0, 0, 0, 0, 0, s[1] ? 'CHORD AUTO ON' : 'CHORD AUTO OFF');
      if (s[2] !== stateSnap[2]) window.frec(EV.STATE, 0, 0, 0, 0, 0, s[2] ? 'CHORD HOLD ON' : 'CHORD HOLD OFF');
      if (s[3] !== stateSnap[3]) window.frec(EV.STATE, 0, 0, 0, 0, 0, s[3] ? 'MODE LOW POWER' : 'MODE HIGH QUALITY');
    } else {
      window.frec(EV.STATE, 0, 0, 0, 0, 0, s[0] ? 'RHYTHM ON' : 'RHYTHM OFF');
      window.frec(EV.STATE, 0, 0, 0, 0, 0, s[1] ? 'CHORD AUTO ON' : 'CHORD AUTO OFF');
      window.frec(EV.STATE, 0, 0, 0, 0, 0, s[2] ? 'CHORD HOLD ON' : 'CHORD HOLD OFF');
      window.frec(EV.STATE, 0, 0, 0, 0, 0, s[3] ? 'MODE LOW POWER' : 'MODE HIGH QUALITY');
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
  }

  let tickId = null;
  window.frecStart = function () {
    if (window._frecOn) return;
    t0 = performance.now(); head = 0; count = 0; curSec = -1; buckets.length = 0;
    prevPerf = null; prevProf = {}; ctr = bk(); incidents.length = 0; markCount = 0;
    cnt.fill(0); pathCnt.fill(0); offHist.fill(0); oN = 0; medHist = []; stateSnap = null;
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
      case EV.STRUM:   return `${ts} STRUM ${s1 || ''} 区間${a}/13 vel=${b}${c ? ' STEAL' : ''} ${f2(d)}ms`;
      case EV.GATE:    return `${ts} STRUM-GATE 22ms未満の発音を間引き`;
      case EV.FDROP:   return `${ts} FRAME-DROP ${f1(a)}ms`;
      case EV.HBDROP:  return `${ts} HEARTBEAT-DROP ${f1(a)}ms`;
      case EV.ASTEP:   return `${ts} ★AUDIO-CLOCK-STEP ${a > 0 ? '+' : ''}${f1(a)}ms（オーディオ処理の遅れ/飛び）`;
      case EV.STEALDIAG: return `${ts}   └奪取時の診断: g.value読取=${a.toFixed(4)} 理論値=${b.toFixed(4)} (ピーク比${d > 0 ? Math.round(b / d * 100) : '?'}%) 経過${f1(c)}ms ${Math.abs(a - b) > Math.max(0.002, b * 0.3) ? '★読取値が理論値とズレ' : ''}`;
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
    L.push('--- 1秒ごとの推移（直近最大120秒）---');
    L.push('秒 | 発音 steal | ドラム | コード判定 | evalMax pcMax efpMax rdMax bdMax stMax dtMax | 描画落ち(回/最大) HB(回/最大) 音飛び(回/最大) 入力遅れmax MARK');
    for (const b of buckets) {
      const m = b.mx, c = b.ctr;
      L.push(`${b.s} | ${b.notes} ${b.steals} | ${b.n['drum-hit']} | ${b.n['eval']} | ${f1(m['eval'])} ${f1(m['playChord'])} ${f1(m['elemFromPoint'])} ${f1(m['redrawPressed'])} ${f1(m['badge'])} ${f1(m['strum-trigger'])} ${f1(m['drum-hit'])} | ${c.fd}/${c.fdMax.toFixed(0)} ${c.hb}/${c.hbMax.toFixed(0)} ${c.as}/${c.asMax.toFixed(0)} ${c.lag.toFixed(0)} ${c.mk ? '●' : ''}`);
    }
    L.push('');
    L.push(`--- 時系列（インシデント${incidents.length}件の前後を統合・重複排除。MARK=耳でノイズを確認した直前3秒／AUTO=音飛び・メインスレッド停止の前1秒後0.4秒）---`);
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
