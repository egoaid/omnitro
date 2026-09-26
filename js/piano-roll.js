// ─── PIANO ROLL ENGINE ───────────────────────────────────────────────────────
//
// キャンバス1枚で全7チャンネルを描画するピアノロール。
//
// 座標系:
//   LABEL_W=36px: チャンネルラベル列
//   ROW_H=34px  : 1チャンネルの高さ
//   STEP_W=24px : 1ステップ(16分音符)の幅
//   NOTE_W=14px : ノート矩形の幅(固定)
//   総幅: LABEL_W + STEP_W*16 + PAD(60msオフセット分の余白)
//
// オフセット変換: offset(ms) → px = offset * STEP_W / STEP_MS
//   STEP_MS = 60000 / BPM / 4 (16分音符のms長)  ただし描画はBPMに依存しない
//   表示上は 1ms = 0.4px とする(±60ms = ±24px = ちょうど1ステップ分)
//
// 操作:
//   タップ(空き) → ノート追加
//   タップ(ノート上) → 選択
//   ダブルタップ(ノート上) → 削除
//   ドラッグ(ノート横方向) → offset変更
//   ドラッグ(ノート縦方向) → velocity変更

const PR = {
  LABEL_W: 36,
  ROW_H:   34,
  // STEP_W は prResize() で動的に計算される（wrap幅 / 16）
  // 最小16px、最大28px
  STEP_W:  20,          // 初期値（prResize後に上書き）
  NOTE_W:  12,
  ROWS: ['kick','snare','hat','hiop','rim','cowbl','clap','tamb','shkr'],
  ROW_LABELS: ['KICK','SNARE','HI-CL','HI-OP','RIM','COWBL','CLAP','TAMB','SHKR'],
  ROW_COLORS: [
    '#27ae60','#e8c95a','#4fc3f7','#80d8ff','#d4e040','#ce93d8','#ef9a9a','#ffb347','#7ec8a0',
  ],
  GHOST_ALPHA: 0.35,
  // PX_PER_MS は STEP_W が変わると再計算される
  // 60ms = 1ステップ = STEP_W px → 1ms = STEP_W/60 px
  get PX_PER_MS() { return this.STEP_W / 60; },
};

let prCanvas = null, prCtx = null;
let prDpr = 1;
// prActiveStep は前方宣言済み

// ── ノートX座標計算（描画・ヒットテスト共通） ─────────────────────────────────
// step + offset(ms) → canvas X座標（ノート左端）
function prEventToX(e) {
  // rollX = ラベル列の右端からの位置。step=0の左端が rollX=0
  // ノートをステップの中央に配置: step*STEP_W + (STEP_W-NOTE_W)/2 + offset
  const rollX = e.step * PR.STEP_W + (PR.STEP_W - PR.NOTE_W) / 2
              + (e.offset || 0) * PR.PX_PER_MS;
  return PR.LABEL_W + rollX;
}

// ヒットテスト用: canvas X座標がどのステップ列(0-15)に属するか
function prCanvasXToStep(canvasX) {
  const rollX = canvasX - PR.LABEL_W;
  return Math.max(0, Math.min(15, Math.floor(rollX / PR.STEP_W)));
}

// クオンタイズ設定: 'off' | '100' | '50' | '25'
// 100 = グリッドジャスト(offset=0)
// 50  = 半ステップ(=30ms)単位スナップ（ヒューマナイズ中）
// 25  = 1/4ステップ(=15ms)単位スナップ（最もゆるい）
// off = 自由配置（クリック位置そのままのoffset）
let prQuantize = '100';

// canvas X座標 → { step, offset_ms }
// 座標系: rollX = 0 が step0 の左端
function prXToStepOffset(canvasX) {
  const rollX    = canvasX - PR.LABEL_W;          // ラベル列を除いたロール内X
  const rawSteps = rollX / PR.STEP_W;             // 小数ステップ位置

  let step, offset;
  if (prQuantize === '100') {
    // ── 100%: グリッドジャスト ────────────────────────────────────────────
    step   = Math.max(0, Math.min(15, Math.floor(rawSteps)));
    offset = 0;
  } else if (prQuantize === '50') {
    // ── 50%: 半ステップ(30ms)単位スナップ ────────────────────────────────
    const snapped = Math.round(rawSteps * 2) / 2;
    step   = Math.max(0, Math.min(15, Math.floor(snapped)));
    const frac = snapped - step;
    offset = Math.round(frac * PR.STEP_W / PR.PX_PER_MS);
    offset = Math.max(-60, Math.min(60, offset));
  } else if (prQuantize === '25') {
    // ── 25%: 1/4ステップ(15ms)単位スナップ ──────────────────────────────
    const snapped = Math.round(rawSteps * 4) / 4;
    step   = Math.max(0, Math.min(15, Math.floor(snapped)));
    const frac = snapped - step;
    offset = Math.round(frac * PR.STEP_W / PR.PX_PER_MS);
    offset = Math.max(-60, Math.min(60, offset));
  } else {
    // ── off: 自由配置（クリック位置のoffsetをそのまま記録） ────────────────
    step   = Math.max(0, Math.min(15, Math.floor(rawSteps)));
    const offsetPx = rollX - step * PR.STEP_W;
    offset = Math.round(offsetPx / PR.PX_PER_MS);
    offset = Math.max(-60, Math.min(60, offset));
  }
  return { step, offset };
}

// 既存の全ノートにクオンタイズを適用（APPLY Qボタン用）
// ── HUMANIZE: タイミングを人間らしくランダムにズラす ──────────────────────────
// Lo-Fi的なグルーヴ感のためにオフセットを自然な範囲でランダム調整
// 各チャンネルの特性に合わせたズレ量を適用:
//   kick/snare: ±8ms (グルーヴの核心、あまり大きくズラさない)
//   hat/hiop:   ±14ms (ハットは人間的なゆらぎが大きめ)
//   rim/cowbl:  ±12ms
//   clap:       ±10ms (少し遅れ気味が自然)
//   tamb/shkr:  ±18ms (タンバリン・シェイカーは揺れが大きい)
function applyHumanize() {
  const CH_HUMANIZE_MS = {
    kick: 8, snare: 8, hat: 14, hiop: 14,
    rim: 12, cowbl: 12, clap: 10, tamb: 18, shkr: 18,
  };
  for (const ch of GROOVE_CHANNELS) {
    const maxMs = CH_HUMANIZE_MS[ch] || 10;
    for (const e of editorState[ch]) {
      // 現在のオフセットにランダムな揺れを加える（完全リセットでなく追加）
      const delta = (Math.random() * 2 - 1) * maxMs;
      e.offset = Math.max(-30, Math.min(60, Math.round((e.offset || 0) + delta)));
      // ベロシティも少し揺らす（±8%）
      e.vel = Math.max(0.1, Math.min(1.0, (e.vel || 0.7) + (Math.random() * 0.16 - 0.08)));
    }
  }
  prDrawImpl();
  applyEditorPatternRTDeferred();
}

function applyQuantizeToAll() {
  for (const ch of GROOVE_CHANNELS) {
    for (const e of editorState[ch]) {
      if (prQuantize === '100') {
        e.offset = 0;
      } else if (prQuantize === '50') {
        // 現在のstep+offsetを実数ステップに変換してスナップ
        const realSteps = e.step + (e.offset || 0) * PR.PX_PER_MS / PR.STEP_W;
        const snapped   = Math.round(realSteps * 2) / 2;
        e.step   = Math.max(0, Math.min(15, Math.floor(snapped)));
        e.offset = Math.round((snapped - e.step) * PR.STEP_W / PR.PX_PER_MS);
        e.offset = Math.max(-60, Math.min(60, e.offset));
      } else if (prQuantize === '25') {
        const realSteps = e.step + (e.offset || 0) * PR.PX_PER_MS / PR.STEP_W;
        const snapped   = Math.round(realSteps * 4) / 4;
        e.step   = Math.max(0, Math.min(15, Math.floor(snapped)));
        e.offset = Math.round((snapped - e.step) * PR.STEP_W / PR.PX_PER_MS);
        e.offset = Math.max(-60, Math.min(60, e.offset));
      }
      // off の場合は何もしない
    }
    editorState[ch].sort((a,b) =>
      (a.step*PR.STEP_W + (a.offset||0)*PR.PX_PER_MS)
    - (b.step*PR.STEP_W + (b.offset||0)*PR.PX_PER_MS));
  }
  prDrawImpl();
  applyEditorPatternRT();
}

// ── イベント管理（IDベース・同ステップ複数可） ───────────────────────────────
let _noteIdSeq = 0;

// ID付与の確認・追加
function prEnsureId(e) {
  if (!e._id) e._id = ++_noteIdSeq;
}

function prAddEvent(ch, props) {
  const e = { _id: ++_noteIdSeq, vel: CH_DEFAULT_VEL[ch]||0.7, offset:0, prob:1.0, ghost:false, ...props };
  editorState[ch].push(e);
  editorState[ch].sort((a,b) => (a.step*PR.STEP_W + (a.offset||0)*PR.PX_PER_MS)
                              - (b.step*PR.STEP_W + (b.offset||0)*PR.PX_PER_MS));
  return e;
}

function prRemoveEvent(ch, id) {
  editorState[ch] = editorState[ch].filter(e => e._id !== id);
}

// ── キャンバス初期化 ──────────────────────────────────────────────────────────
function prInit() {
  prCanvas = document.getElementById('piano-roll-canvas');
  prCtx    = prCanvas.getContext('2d');
  prDpr    = window.devicePixelRatio || 1;
  prDraw   = prDrawImpl;
  prResize();
  prSetupEvents();
}

// ── ブラウザウィンドウのリサイズに追従 ────────────────────────────────────────
// 従来はレイアウトモード切替時（js/layout-mode.js）にしかprResize()が
// 呼ばれておらず、DESKTOP FULLSCREENのままブラウザウィンドウ自体を
// 拡大縮小してもピアノロールのステップ幅・行の高さ・キャンバスサイズが
// 追従しなかった（=ノートがフィットしない）。ウィンドウのresizeイベントに
// 直接フックし、初期化済み（prCanvasが存在する）場合のみ再計算する。
// rAFで間引き、連続的なリサイズ中に過剰に再計算しないようにしている。
let _prResizePending = false;
window.addEventListener('resize', () => {
  if (!prCanvas || _prResizePending) return;
  _prResizePending = true;
  requestAnimationFrame(() => {
    _prResizePending = false;
    prResize();
  });
});

function prResize() {
  if (!prCanvas) return;
  const wrap = document.getElementById('piano-roll-wrap');
  const wideLayout = document.body.classList.contains('layout-tablet-landscape') ||
                      document.body.classList.contains('layout-desktop-fullscreen');

  // wrap幅からSTEP_Wを逆算: スクロールバーなし、100%フィット
  const wrapW = (wrap ? wrap.clientWidth : 360) || 360;
  const availW = wrapW - PR.LABEL_W - 2;  // 左端ラベル列と右端余白を引く
  // STANDARDレイアウトでは最大28px（既存の見た目を一切変えない）。
  // TABLET LANDSCAPE / DESKTOP FULLSCREENでは#piano-roll-wrapが
  // 画面いっぱいの横幅を持つため、この上限を大きく引き上げて実際の
  // 余白幅をそのままステップ幅に反映する（=ピアノロールが横方向にも
  // 画面全体にフィットするようになる）。
  const stepWMax = wideLayout ? 140 : 28;
  PR.STEP_W  = Math.max(14, Math.min(stepWMax, Math.floor(availW / 16)));
  PR.NOTE_W  = Math.max(10, Math.round(PR.STEP_W * 0.58));

  // ── 行の高さ（ROW_H） ────────────────────────────────────────────────────
  // TABLET LANDSCAPE / DESKTOP FULLSCREENでは #piano-roll-wrap が
  // flex:1 で縦幅いっぱいに引き伸ばされるため、その実際の高さに合わせて
  // 行の高さ自体も拡大し、タップ/ドラッグしやすくする。
  // STANDARDレイアウトではwrapの高さは常にcanvas自身のサイズで決まる
  // （flexで引き伸ばされない）ため、常に34px固定のまま — 既存の見た目・
  // 挙動を一切変えない。
  if (wideLayout && wrap && wrap.clientHeight > 0) {
    PR.ROW_H = Math.max(34, Math.min(90, Math.floor(wrap.clientHeight / PR.ROWS.length)));
  } else {
    PR.ROW_H = 34;
  }

  const W = PR.LABEL_W + PR.STEP_W * 16 + 2;
  const H = PR.ROW_H * PR.ROWS.length;
  prCanvas.style.width  = W + 'px';
  prCanvas.style.height = H + 'px';
  prCanvas.width  = Math.round(W * prDpr);
  prCanvas.height = Math.round(H * prDpr);
  if (wrap) { wrap.style.overflowX = 'hidden'; wrap.style.overflowY = 'hidden'; }
  if (prCtx) prDrawImpl();
}

// ── 描画 ──────────────────────────────────────────────────────────────────────
function prDrawImpl() {
  if (!prCtx) return;
  const ctx = prCtx;
  const W = prCanvas.width  / prDpr;
  const H = prCanvas.height / prDpr;
  ctx.setTransform(prDpr, 0, 0, prDpr, 0, 0);
  ctx.clearRect(0, 0, W, H);
  const rollW = W - PR.LABEL_W;

  // 背景
  PR.ROWS.forEach((ch, ri) => {
    const y = ri * PR.ROW_H;
    ctx.fillStyle = ri % 2 === 0 ? '#060e18' : '#08121e';
    ctx.fillRect(PR.LABEL_W, y, rollW, PR.ROW_H);
  });

  // ステップグリッド線
  for (let s = 0; s <= 16; s++) {
    const x = PR.LABEL_W + s * PR.STEP_W;
    ctx.strokeStyle = s % 4 === 0 ? 'rgba(79,195,247,0.25)' : 'rgba(79,195,247,0.08)';
    ctx.lineWidth   = s % 4 === 0 ? 1 : 0.5;
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
  }

  // 拍番号
  ctx.font = '8px Share Tech Mono';
  for (let b = 0; b < 4; b++) {
    ctx.fillStyle = 'rgba(232,201,90,0.6)';
    ctx.fillText(b + 1, PR.LABEL_W + b * PR.STEP_W * 4 + 3, 9);
  }

  // 現在ステップハイライト
  if (prActiveStep >= 0) {
    const ax = PR.LABEL_W + prActiveStep * PR.STEP_W;
    ctx.fillStyle = 'rgba(232,201,90,0.08)';
    ctx.fillRect(ax, 0, PR.STEP_W, H);
    ctx.strokeStyle = 'rgba(232,201,90,0.7)';
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(ax, 0); ctx.lineTo(ax, H); ctx.stroke();
  }

  // チャンネルラベル
  PR.ROWS.forEach((ch, ri) => {
    const y = ri * PR.ROW_H;
    ctx.fillStyle = '#0a1628';
    ctx.fillRect(0, y, PR.LABEL_W - 1, PR.ROW_H);
    ctx.fillStyle = PR.ROW_COLORS[ri];
    ctx.font = 'bold 8px Orbitron,sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(PR.ROW_LABELS[ri], PR.LABEL_W - 4, y + PR.ROW_H / 2 + 3);
    ctx.textAlign = 'left';
    ctx.strokeStyle = 'rgba(26,58,90,0.8)';
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(0, y + PR.ROW_H - 0.5); ctx.lineTo(W, y + PR.ROW_H - 0.5);
    ctx.stroke();
  });

  // ── ノート矩形（重なり検出・視覚化付き） ─────────────────────────────────
  PR.ROWS.forEach((ch, ri) => {
    const y0   = ri * PR.ROW_H + 2;
    const maxH = PR.ROW_H - 4;
    const notes = editorState[ch];

    // ── Step 1: 各ノートのX範囲を計算 ──────────────────────────────────────
    const rects = notes.map(e => {
      const nx = prEventToX(e);
      const nh = Math.max(4, Math.round((e.vel || 0.7) * maxH));
      return { e, nx, ny: y0 + (maxH - nh), nw: PR.NOTE_W, nh };
    });

    // ── Step 2: 重なり数をカウント（各ノートが何個と重なるか） ─────────────
    const overlapCount = new Array(notes.length).fill(0);
    for (let i = 0; i < rects.length; i++) {
      for (let j = i + 1; j < rects.length; j++) {
        const a = rects[i], b = rects[j];
        // X軸で重なりがあるか
        if (a.nx < b.nx + b.nw && a.nx + a.nw > b.nx) {
          overlapCount[i]++;
          overlapCount[j]++;
        }
      }
    }

    // ── Step 3: ノート本体を描画（セロハン重なり表現） ────────────────────────
    // 各ノートを半透明で描画することで、重なり部分のみ自然に色が濃くなる。
    // ゴーストはさらに透明度を下げて薄く表示。
    rects.forEach(({ e, nx, ny, nw, nh }, i) => {
      const baseAlpha = e.ghost ? PR.GHOST_ALPHA : 0.72;
      const col       = PR.ROW_COLORS[ri];

      ctx.globalAlpha = baseAlpha;

      // ノート本体
      ctx.fillStyle = col;
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(nx, ny, nw, nh, 2);
      else ctx.rect(nx, ny, nw, nh);
      ctx.fill();

      // 上端ハイライト（セロハンの光沢感）
      ctx.globalAlpha = baseAlpha * 0.5;
      ctx.fillStyle   = 'rgba(255,255,255,0.4)';
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(nx, ny, nw, Math.min(4, nh * 0.35), 2);
      else ctx.rect(nx, ny, nw, Math.min(4, nh * 0.35));
      ctx.fill();

      // 確率インジケーター（右上オレンジ点）
      if (e.prob != null && e.prob < 1.0) {
        ctx.globalAlpha = 0.95;
        ctx.fillStyle   = '#fb923c';
        ctx.beginPath();
        ctx.arc(nx + nw - 2, ny + 3, 2, 0, Math.PI * 2);
        ctx.fill();
      }

      // オフセット量テキスト（±8ms以上）
      if (e.offset && Math.abs(e.offset) >= 8) {
        ctx.globalAlpha = 0.92;
        ctx.fillStyle   = '#fff';
        ctx.font        = '6px Share Tech Mono';
        ctx.fillText((e.offset > 0 ? '+' : '') + Math.round(e.offset), nx + 1, ny + nh - 2);
      }

      ctx.globalAlpha = 1.0;
    });
  });
}

// ── ノートヒットテスト ───────────────────────────────────────────────────────
function prHitTest(ch, x, y) {
  const ri   = PR.ROWS.indexOf(ch);
  const y0   = ri * PR.ROW_H + 2;
  const maxH = PR.ROW_H - 4;
  // 後ろのノートから判定（重なり時は手前を優先）
  for (let i = editorState[ch].length - 1; i >= 0; i--) {
    const e  = editorState[ch][i];
    const nx = prEventToX(e);
    if (x >= nx - 1 && x <= nx + PR.NOTE_W + 1 &&
        y >= y0 - 1 && y <= y0 + maxH + 1) return e;
  }
  return null;
}

// ── ポインタイベント ─────────────────────────────────────────────────────────
function prSetupEvents() {
  const canvas = prCanvas;
  // ドラッグ状態
  let ptrId = null, dragEvt = null, dragCh = null;
  let dragStartX = 0, dragStartY = 0;
  let dragStartNoteX = 0;   // ドラッグ開始時のノートX座標（prEventToX値）
  let dragStartVel  = 0.7;
  let isDragging = false;
  // ダブルタップ判定
  let lastTap = { id: null, time: 0 };

  function getXY(ev) {
    const rect = canvas.getBoundingClientRect();
    return { x: ev.clientX - rect.left, y: ev.clientY - rect.top };
  }

  // ── ステップパラメーターポップアップ（vel / offset / prob / ghost） ─────
  let sppTarget = null; // { evt, ch }

  function openSpp(evt, ch, canvasRect) {
    sppTarget = { evt, ch };
    const popup = document.getElementById('step-param-popup');
    document.getElementById('spp-title').textContent =
      'STEP ' + (evt.step+1) + ' — ' + ch.toUpperCase();
    document.getElementById('spp-vel').value       = Math.round((evt.vel || 0.7) * 100);
    document.getElementById('spp-vel-val').textContent = Math.round((evt.vel || 0.7) * 100);
    document.getElementById('spp-offset').value    = Math.max(-30, Math.min(60, evt.offset || 0));
    document.getElementById('spp-offset-val').textContent = (evt.offset || 0) + 'ms';
    document.getElementById('spp-prob').value      = Math.round((evt.prob ?? 1.0) * 100);
    document.getElementById('spp-prob-val').textContent = Math.round((evt.prob ?? 1.0) * 100) + '%';
    const ghostOn = !!evt.ghost;
    const ghostTog = document.getElementById('spp-ghost-tog');
    ghostTog.classList.toggle('on', ghostOn);
    document.getElementById('spp-ghost-val').textContent = ghostOn ? 'ON' : 'OFF';
    // ── ポップアップ位置: 画面内に確実に収める ──────────────────────────────
    // canvasRect(実際に描画されているCSSピクセルサイズ)と、PR.STEP_W/
    // PR.ROW_Hから計算される論理サイズにズレがあっても正しい位置に出す
    // ため、スケール係数を実測して補正する（ウィンドウリサイズ直後など、
    // 万一canvasの実サイズとPRの論理値がまだ食い違うタイミングがあっても
    // ポップアップが正しいノートの位置からズレないようにする防御的な計算）。
    const logicalW = PR.LABEL_W + PR.STEP_W * 16 + 2;
    const logicalH = PR.ROW_H * PR.ROWS.length;
    const scaleX = logicalW > 0 ? canvasRect.width  / logicalW : 1;
    const scaleY = logicalH > 0 ? canvasRect.height / logicalH : 1;
    const popup_w = 190, popup_h = 168;
    const canvasX  = (prEventToX(evt) + PR.NOTE_W/2) * scaleX;
    const screenX  = canvasRect.left + canvasX;
    const rowIdx   = PR.ROWS.indexOf(ch);
    const rowH     = PR.ROW_H * scaleY;
    const screenY  = canvasRect.top + rowIdx * rowH;
    // 右に出す。はみ出すなら左
    let px = screenX + 8;
    if (px + popup_w > window.innerWidth - 4) px = screenX - popup_w - 8;
    // 下に出す。はみ出すなら上
    let py = screenY + rowH + 4;
    if (py + popup_h > window.innerHeight - 4) py = screenY - popup_h - 4;
    popup.style.left = Math.max(4, px) + 'px';
    popup.style.top  = Math.max(4, py) + 'px';
    popup.classList.add('visible');
  }

  function closeSpp() {
    document.getElementById('step-param-popup').classList.remove('visible');
    sppTarget = null;
  }

  // SPP スライダー配線（ポップアップが開かれるたびに反映される）
  document.getElementById('spp-vel').addEventListener('input', e => {
    if (!sppTarget) return;
    const v = parseInt(e.target.value) / 100;
    sppTarget.evt.vel = v;
    document.getElementById('spp-vel-val').textContent = parseInt(e.target.value);
    prDrawImpl(); applyEditorPatternRT();
  });
  document.getElementById('spp-offset').addEventListener('input', e => {
    if (!sppTarget) return;
    const v = parseInt(e.target.value);
    sppTarget.evt.offset = v;
    document.getElementById('spp-offset-val').textContent = v + 'ms';
    prDrawImpl(); applyEditorPatternRT();
  });
  document.getElementById('spp-prob').addEventListener('input', e => {
    if (!sppTarget) return;
    const v = parseInt(e.target.value) / 100;
    sppTarget.evt.prob = v;
    document.getElementById('spp-prob-val').textContent = parseInt(e.target.value) + '%';
    prDrawImpl(); applyEditorPatternRT();
  });
  document.getElementById('spp-ghost-tog').addEventListener('pointerdown', (e) => {
    e.preventDefault();
    if (!sppTarget) return;
    const tog = document.getElementById('spp-ghost-tog');
    // 現在の状態を明示的に読んでから反転
    const wasOn = sppTarget.evt.ghost === true;
    const nowOn = !wasOn;
    sppTarget.evt.ghost = nowOn;
    tog.classList.toggle('on', nowOn);
    document.getElementById('spp-ghost-val').textContent = nowOn ? 'ON' : 'OFF';
    prDrawImpl(); applyEditorPatternRT();
  });
  document.getElementById('spp-close-btn').addEventListener('click', closeSpp);
  // ポップアップ外クリックで閉じる
  document.addEventListener('pointerdown', e => {
    const popup = document.getElementById('step-param-popup');
    if (popup.classList.contains('visible') && !popup.contains(e.target) && e.target !== canvas) {
      closeSpp();
    }
  }, true);

  canvas.addEventListener('pointerdown', ev => {
    ev.preventDefault();
    if (ptrId !== null) return;
    const {x, y} = getXY(ev);
    if (x < PR.LABEL_W) return;
    const ch = PR.ROWS[Math.floor(y / PR.ROW_H)];
    if (!ch) return;

    const hit = prHitTest(ch, x, y);
    if (hit) {
      prEnsureId(hit);
      // ダブルタップ → 削除
      const now = Date.now();
      if (lastTap.id === hit._id && now - lastTap.time < 380) {
        closeSpp();
        prRemoveEvent(ch, hit._id);
        prDrawImpl(); applyEditorPatternRT();
        lastTap = { id: null, time: 0 }; return;
      }
      lastTap = { id: hit._id, time: now };
      // 長押し(500ms) → SPP（パラメーター編集ポップアップ）
      const longPressTimer = setTimeout(() => {
        if (ptrId === ev.pointerId) {  // まだ押し続けている
          const canvasRect = canvas.getBoundingClientRect();
          openSpp(hit, ch, canvasRect);
        }
      }, 500);
      // ポインターが離れたら長押しタイマーキャンセル（後の pointerup で処理）
      hit._longPressTimer = longPressTimer;
      // ドラッグ準備
      ptrId = ev.pointerId;
      canvas.setPointerCapture(ev.pointerId);
      dragEvt = hit; dragCh = ch;
      dragStartX = x; dragStartY = y;
      dragStartNoteX = prEventToX(hit);   // ★ ドラッグ開始時のノートX
      dragStartVel   = hit.vel || CH_DEFAULT_VEL[ch] || 0.7;
      isDragging = false;
    } else {
      // 空き領域タップ: ノート追加
      const {step, offset} = prXToStepOffset(x);
      const e = prAddEvent(ch, { step, offset, vel: CH_DEFAULT_VEL[ch]||0.7 });
      prEnsureId(e);
      lastTap = { id: e._id, time: Date.now() };
      prDrawImpl(); applyEditorPatternRT();
    }
  }, {passive:false});

  canvas.addEventListener('pointermove', ev => {
    if (ev.pointerId !== ptrId || !dragEvt) return;
    ev.preventDefault();
    const {x, y} = getXY(ev);
    const dx = x - dragStartX;
    const dy = y - dragStartY;

    if (!isDragging && (Math.abs(dx) > 3 || Math.abs(dy) > 3)) isDragging = true;
    if (!isDragging) return;

    if (Math.abs(dx) >= Math.abs(dy) * 1.2) {
      // ── 横ドラッグ: ノートを1:1でマウスに追従 ──────────────────────────────
      // dragStartNoteX は prEventToX(hit) の値（ノート左端X）
      // ノート中央位置からの逆算: rollX = (newNoteX - LABEL_W) - (STEP_W-NOTE_W)/2
      const newNoteX   = dragStartNoteX + dx;
      const rollX      = (newNoteX - PR.LABEL_W) - (PR.STEP_W - PR.NOTE_W) / 2;
      // クランプしてからstep/offsetに分解
      const totalSteps = Math.max(0, Math.min(15.999, rollX / PR.STEP_W));
      const newStep    = Math.floor(totalSteps);
      const fracSteps  = totalSteps - newStep;
      const rawOffset  = Math.round(fracSteps * PR.STEP_W / PR.PX_PER_MS);
      const clampedOffset = Math.max(-60, Math.min(60, rawOffset));

      // step変更時: 旧ノート削除して新ノート追加（IDは維持）
      if (newStep !== dragEvt.step) {
        const saved = { ...dragEvt, step: newStep, offset: clampedOffset };
        prRemoveEvent(dragCh, dragEvt._id);
        editorState[dragCh].push(saved);
        editorState[dragCh].sort((a,b) =>
          (a.step*PR.STEP_W + (a.offset||0)*PR.PX_PER_MS)
        - (b.step*PR.STEP_W + (b.offset||0)*PR.PX_PER_MS));
        dragEvt = saved;
      } else {
        dragEvt.offset = clampedOffset;
      }
    } else {
      // ── 縦ドラッグ: velocity ───────────────────────────────────────────────
      const newVel = Math.max(0.05, Math.min(1.0, dragStartVel - dy / (PR.ROW_H * 0.8)));
      dragEvt.vel = newVel;
    }
    prDrawImpl();
    applyEditorPatternRT();
  }, {passive:false});

  canvas.addEventListener('pointerup', ev => {
    if (ev.pointerId !== ptrId) return;
    // 長押しタイマーをキャンセル
    if (dragEvt && dragEvt._longPressTimer) { clearTimeout(dragEvt._longPressTimer); dragEvt._longPressTimer = null; }
    ptrId=null; isDragging=false; dragEvt=null;
    prDrawImpl();
  }, {passive:false});

  canvas.addEventListener('pointercancel', ev => {
    if (dragEvt && dragEvt._longPressTimer) { clearTimeout(dragEvt._longPressTimer); dragEvt._longPressTimer = null; }
    ptrId=null; isDragging=false; dragEvt=null;
  });
}

// ── リアルタイム反映: 再生中でも即座に適用 ───────────────────────────────────
function applyEditorPatternRT() {
  const pat = editorToPattern();
  RHYTHM_PATTERNS['user__editor'] = pat;
  if (state.isPlaying && !recState.active) {
    // 通常時: Transportごと再起動して確実に反映
    if (typeof arrangementState !== 'undefined') arrangementState.mode = 'main';
    stopRhythm(); startRhythm(pat);
  } else if (state.isPlaying && recState.active) {
    // 録音中: Transportは止めずにパターンだけ即座に差し替える
    // （録音バッファのタイミング基準を維持しつつ、音にも即反映させる）
    swapRhythmPatternLive(pat);
  }
}

// ── リアルタイム反映（小節境界まで遅延版） ───────────────────────────────────
// RANDOM / HUMANIZE 専用。ライブ演奏中にこれらを使って曲を変化させたい
// というユースケースのため、押した瞬間にシーケンスの先頭へジャンプする
// のではなく、今鳴っている小節を最後まで演奏し続け、次の小節の頭に来た
// タイミングで新しいパターンへ自然に切り替わるようにする。
// 個々のノート編集・QUANTIZE・プリセットLOAD等は従来どおり即座反映のまま
// （applyEditorPatternRT）とし、この遅延版はRANDOM/HUMANIZEにのみ使う。
// Tone.Transportには一切触れない（録音中・非録音中どちらでも安全）。
let _randomizePendingCount = 0;
function applyEditorPatternRTDeferred() {
  const pat = editorToPattern();
  RHYTHM_PATTERNS['user__editor'] = pat;
  if (!state.isPlaying) return; // 再生していなければ何もしない（次回再生時に反映される）

  if (typeof arrangementState !== 'undefined') arrangementState.mode = 'main';

  // 次の小節境界への切り替え待ちであることをPLAYボタン群に表示する
  // （RANDOM/HUMANIZEを連続でクリックした場合に備えてカウンタで管理し、
  // 全ての予約が解消されるまで表示を維持する）
  _randomizePendingCount++;
  if (typeof setRandomizePendingUI === 'function') setRandomizePendingUI(true);

  // 今鳴っている小節が終わるのを待ってから切り替える
  waitBars(1, () => {
    // 待っている間にさらに別の編集が行われている可能性があるため、
    // 切り替え直前に user__editor の最新内容を取り直す
    swapRhythmPatternLive(RHYTHM_PATTERNS['user__editor']);
    _randomizePendingCount = Math.max(0, _randomizePendingCount - 1);
    if (_randomizePendingCount === 0 && typeof setRandomizePendingUI === 'function') {
      setRandomizePendingUI(false);
    }
  });
}

// ── 再生時グリッド点灯（ピアノロールに縦線） ──────────────────────────────────
function gridHighlightStep(si) {
  prActiveStep = si;
  if (prCtx) prDrawImpl();
}

// ── legacy compatibility: reditorRender → prDraw ──────────────────────────────
function reditorRender() {
  if (!prCanvas) prInit();
  const sw=document.getElementById('reditor-swing');
  const sv=document.getElementById('reditor-swing-val');
  if(sw) sw.value=editorState.swing;
  if(sv) sv.textContent=editorState.swing+'%';
  if (prCtx) prDrawImpl();
}

// ── パターンリスト描画 ────────────────────────────────────────────────────────
function reditorRenderPatList() {
  const list=document.getElementById('reditor-pat-list');
  if(!list) return;
  list.innerHTML='';
  const patterns=loadUserPatterns();
  if(patterns.length===0){
    list.innerHTML='<div style="font-size:8px;color:var(--text-dim);padding:6px;letter-spacing:1px;">No saved patterns</div>';
    return;
  }
  patterns.forEach((pat,idx)=>{
    const item=document.createElement('div');
    item.className='reditor-pat-item';
    const sw=pat.swing>0?' sw'+pat.swing:'';
    item.innerHTML=`<div class="reditor-pat-name">${pat.name}</div>
      <div style="font-size:8px;color:var(--text-dim);letter-spacing:1px;flex-shrink:0;">${sw}</div>
      <div class="reditor-pat-del" data-idx="${idx}">✕</div>`;
    item.addEventListener('click',e=>{
      if(e.target.classList.contains('reditor-pat-del')) return;
      const p=patterns[idx];
      const key = 'user__' + p.name;
      // RHYTHM_PATTERNSに登録済みのはずだがnullチェック
      if (RHYTHM_PATTERNS[key]) {
        loadPatternByName(key);
      } else {
        // フォールバック: 直接ロード
        if(p.groove_kick!==undefined){
          grooveToEditorState({
            kick:p.groove_kick||[], snare:p.groove_snare||[],
            hat:p.groove_hat||[], hiop:p.groove_hiop||[],
            rim:p.groove_rim||[], cowbl:p.groove_cowbl||[],
            clap:p.groove_clap||[], tamb:p.groove_tamb||[],
            shkr:p.groove_shkr||[], swing:(p.swing||0)/100,
          });
        }
        reditorRender(); applyEditorPatternRT();
      }
      document.querySelectorAll('.reditor-pat-item').forEach(el=>el.classList.remove('active-pat'));
      item.classList.add('active-pat');
    });
    item.querySelector('.reditor-pat-del').addEventListener('click',e=>{
      e.stopPropagation();
      const ps=loadUserPatterns(); ps.splice(idx,1);
      saveUserPatterns(ps); syncUserPatternsToSelect(); reditorRenderPatList();
    });
    list.appendChild(item);
  });
}

// ── ユーザーパターンを両selectに同期 ──────────────────────────────────────────
// ユーザー保存パターンを RHYTHM_PATTERNS に登録し、selectオプションにも追加する
function syncUserPatternsToSelect() {
  const patterns = loadUserPatterns();
  const selIds = ['rhythm-select', 'rhythm-select-settings', 'reditor-preset-sel'];

  selIds.forEach(selId => {
    const sel = document.getElementById(selId);
    if (!sel) return;
    // 既存のuser__オプションを削除（逆順で削除してインデックスずれを防ぐ）
    const toRemove = Array.from(sel.options).filter(o => o.value.startsWith('user__'));
    toRemove.forEach(o => o.remove());
    patterns.forEach(p => {
      const key = 'user__' + p.name;
      // RHYTHM_PATTERNSに登録
      RHYTHM_PATTERNS[key] = {
        beats: 4,
        swing: (p.swing || 0) / 100,
        groove_kick:  p.groove_kick  || [],
        groove_snare: p.groove_snare || [],
        groove_hat:   p.groove_hat   || [],
        groove_hiop:  p.groove_hiop  || [],
        groove_rim:   p.groove_rim   || [],
        groove_cowbl: p.groove_cowbl || [],
        groove_clap:  p.groove_clap  || [],
        groove_tamb:  p.groove_tamb  || [],
        groove_shkr:  p.groove_shkr  || [],
        pattern: Array.from({length:16},(_,i)=>{
          const k=(p.groove_kick||[]).find(e=>e.step===i);
          if(k) return 1;
          const s=(p.groove_snare||[]).find(e=>e.step===i);
          if(s) return s.ghost?3:2;
          return 0;
        }),
        hats:  Array.from({length:16},(_,i)=>(p.groove_hat||[]).some(e=>e.step===i)?1:0),
        hiop:  Array.from({length:16},(_,i)=>(p.groove_hiop||[]).some(e=>e.step===i)?1:0),
        rim:   Array.from({length:16},(_,i)=>(p.groove_rim||[]).some(e=>e.step===i)?1:0),
        cowbl: Array.from({length:16},(_,i)=>(p.groove_cowbl||[]).some(e=>e.step===i)?1:0),
        clap:  Array.from({length:16},(_,i)=>(p.groove_clap||[]).some(e=>e.step===i)?1:0),
        tamb:  Array.from({length:16},(_,i)=>(p.groove_tamb||[]).some(e=>e.step===i)?1:0),
        shkr:  Array.from({length:16},(_,i)=>(p.groove_shkr||[]).some(e=>e.step===i)?1:0),
      };
      const opt = document.createElement('option');
      opt.value = key;
      opt.textContent = '★ ' + p.name;
      sel.appendChild(opt);
    });
  });
}

// ── ランダムパターン生成 ──────────────────────────────────────────────────────
// スタイル: 'chill' / 'hiphop' / 'minimal' をランダム選択して
// 確率・ベロシティ・マイクロオフセットにバラつきを加えた
// 人間的なパターンを生成する。
function randomizeEditorPattern() {
  for (const ch of GROOVE_CHANNELS) editorState[ch] = [];

  const style = ['chill','hiphop','minimal'][Math.floor(Math.random() * 3)];
  const swing = style === 'chill' ? 0.35 + Math.random() * 0.18
              : style === 'hiphop' ? 0.20 + Math.random() * 0.25
              : 0.0;
  editorState.swing = Math.round(swing * 100);

  // ── キック ─────────────────────────────────────────────────────────────────
  const kickGrid = style === 'minimal'
    ? [0, 8]
    : style === 'hiphop'
    ? [0, 2, 8, 10].filter(() => Math.random() > 0.25)
    : [0, 8, 12].filter(() => Math.random() > 0.2);
  // シンコペーション: ランダムに追加
  if (style !== 'minimal' && Math.random() > 0.5) {
    const extras = [3, 6, 11, 14];
    extras.forEach(s => { if (Math.random() > 0.65 && !kickGrid.includes(s)) kickGrid.push(s); });
  }
  kickGrid.forEach(s => {
    const offset = style === 'chill' ? (Math.random() * 20 - 4) : (Math.random() * 12 - 4);
    prAddEvent('kick', { step: s, vel: 0.75 + Math.random() * 0.18, offset: Math.round(offset), prob: 1.0 });
  });

  // ── スネア ──────────────────────────────────────────────────────────────────
  const snareBase = style === 'minimal' ? [4, 12] : [4, 12];
  snareBase.forEach(s => {
    const offset = style === 'chill' ? (Math.random() * 28 + 4) : (Math.random() * 16);
    prAddEvent('snare', { step: s, vel: 0.72 + Math.random() * 0.16, offset: Math.round(offset), prob: 1.0 });
  });
  // ゴーストスネア
  if (style !== 'minimal') {
    const ghosts = [2, 3, 6, 7, 10, 11, 14, 15];
    ghosts.forEach(s => {
      if (Math.random() > 0.62) {
        prAddEvent('snare', { step: s, vel: 0.10 + Math.random() * 0.14,
          offset: Math.round(Math.random() * 16 - 6), prob: 0.45 + Math.random() * 0.4,
          ghost: true });
      }
    });
  }

  // ── ハット ──────────────────────────────────────────────────────────────────
  if (style === 'minimal') {
    // 8分ハット
    [0,2,4,6,8,10,12,14].forEach(s => {
      prAddEvent('hat', { step: s, vel: 0.45 + Math.random() * 0.2,
        offset: Math.round(Math.random() * 8 - 2), prob: 0.90 + Math.random() * 0.1 });
    });
  } else {
    // 16分ハット（各ステップを確率で）
    for (let s = 0; s < 16; s++) {
      const prob = (s % 2 === 0) ? 0.88 : 0.55;
      if (Math.random() < prob) {
        const vel = (s % 2 === 0) ? 0.45 + Math.random() * 0.18 : 0.22 + Math.random() * 0.18;
        const offset = style === 'chill'
          ? Math.round(s * 1.8 + Math.random() * 12)  // だんだん遅れる
          : Math.round(Math.random() * 10 - 2);
        prAddEvent('hat', { step: s, vel, offset: Math.max(-30, Math.min(50, offset)),
          prob: 0.70 + Math.random() * 0.30 });
      }
    }
  }

  // ── オープンハット ──────────────────────────────────────────────────────────
  if (Math.random() > 0.4) {
    const hiops = style === 'minimal' ? [6] : [7, 15].filter(() => Math.random() > 0.4);
    hiops.forEach(s => {
      prAddEvent('hiop', { step: s, vel: 0.48 + Math.random() * 0.18,
        offset: Math.round(Math.random() * 20 + 8), prob: 0.55 + Math.random() * 0.35 });
    });
  }

  // ── リム ────────────────────────────────────────────────────────────────────
  if (Math.random() > 0.35) {
    [1, 5, 9, 13].forEach(s => {
      if (Math.random() > 0.45) {
        prAddEvent('rim', { step: s, vel: 0.35 + Math.random() * 0.25,
          offset: Math.round(Math.random() * 14 - 4), prob: 0.50 + Math.random() * 0.40 });
      }
    });
  }

  // ── カウベル（50%以上の確率で追加） ─────────────────────────────────────────
  if (Math.random() > 0.45) {
    const cowblPool = style === 'minimal' ? [4, 12]
      : style === 'hiphop' ? [2, 6, 10, 14] : [1, 5, 9, 13];
    cowblPool.filter(() => Math.random() > 0.40).forEach(s => {
      prAddEvent('cowbl', { step: s, vel: 0.28 + Math.random() * 0.30,
        offset: Math.round(Math.random() * 10 - 3), prob: 0.55 + Math.random() * 0.40 });
    });
  }

  // ── クラップ（55%以上の確率で追加） ─────────────────────────────────────────
  if (Math.random() > 0.40) {
    const clapBase = style === 'minimal' ? [4] : [4, 12];
    clapBase.filter(() => Math.random() > 0.20).forEach(s => {
      prAddEvent('clap', { step: s, vel: 0.55 + Math.random() * 0.28,
        offset: Math.round(Math.random() * 22 + 6), prob: 0.65 + Math.random() * 0.35 });
    });
    // ゴーストクラップ追加
    if (Math.random() > 0.55) {
      const bonus = [2, 6, 10, 14][Math.floor(Math.random() * 4)];
      prAddEvent('clap', { step: bonus, vel: 0.20 + Math.random() * 0.20,
        offset: Math.round(Math.random() * 15), prob: 0.35 + Math.random() * 0.35, ghost: true });
    }
  }

  // ── タンバリン（60%以上の確率で追加） ────────────────────────────────────────
  // 8分・16分の裏拍、または連続パターンで「シャカシャカ」感を演出
  if (Math.random() > 0.35) {
    if (style === 'minimal') {
      // ミニマル: 2拍・4拍の裏に薄く
      [4, 12].filter(() => Math.random() > 0.3).forEach(s => {
        prAddEvent('tamb', { step: s, vel: 0.40 + Math.random() * 0.20,
          offset: Math.round(Math.random() * 12 + 4), prob: 0.55 + Math.random() * 0.35 });
      });
    } else if (style === 'hiphop') {
      // ヒップホップ: 裏拍に強め
      [2, 6, 10, 14].filter(() => Math.random() > 0.45).forEach(s => {
        prAddEvent('tamb', { step: s, vel: 0.50 + Math.random() * 0.22,
          offset: Math.round(Math.random() * 10 - 2), prob: 0.60 + Math.random() * 0.35 });
      });
    } else {
      // chill: 8分の裏または16分の偶数ステップにシャカシャカ
      const tambPattern = Math.random() > 0.5
        ? [2, 6, 10, 14]   // 8分裏
        : [1, 3, 5, 7, 9, 11, 13, 15].filter(() => Math.random() > 0.55); // 16分裏
      tambPattern.forEach(s => {
        prAddEvent('tamb', { step: s, vel: 0.38 + Math.random() * 0.24,
          offset: Math.round(Math.random() * 18 + 2), prob: 0.55 + Math.random() * 0.38 });
      });
    }
  }

  // ── シェイカー（50%以上の確率で追加） ──────────────────────────────────────
  if (Math.random() > 0.45) {
    if (style === 'chill' || style === 'hiphop') {
      // 8分音符の裏拍パターン
      [2, 6, 10, 14].filter(() => Math.random() > 0.35).forEach(s => {
        prAddEvent('shkr', { step: s, vel: 0.35 + Math.random() * 0.25,
          offset: Math.round(Math.random() * 14 + 2), prob: 0.55 + Math.random() * 0.35 });
      });
    } else {
      // minimal: シンプルに
      [4, 12].filter(() => Math.random() > 0.3).forEach(s => {
        prAddEvent('shkr', { step: s, vel: 0.40 + Math.random() * 0.20,
          offset: Math.round(Math.random() * 10), prob: 0.60 + Math.random() * 0.30 });
      });
    }
  }

  // Swing
  const swingEl = document.getElementById('reditor-swing');
  const swingValEl = document.getElementById('reditor-swing-val');
  if (swingEl) swingEl.value = editorState.swing;
  if (swingValEl) swingValEl.textContent = editorState.swing + '%';

  prDrawImpl();
  applyEditorPatternRTDeferred();
}

// ── エディターを開く/閉じる ────────────────────────────────────────────────
function openRhythmEditor() {
  document.getElementById('rhythm-editor-overlay').classList.add('open');
  document.getElementById('settings-overlay').classList.remove('open');
  // pianorollを初期化（初回のみ）してから描画
  setTimeout(() => {
    if (!prCanvas) prInit();
    else prResize();
    reditorRender();
  }, 50);
  reditorRenderPatList();
}

function closeRhythmEditor() {
  document.getElementById('rhythm-editor-overlay').classList.remove('open');
}

// ── エディターUI接続 ──────────────────────────────────────────────────────────
function setupRhythmEditor() {
  // ── 閉じる ───────────────────────────────────────────────────────────────
  document.getElementById('reditor-close-btn').addEventListener('click', closeRhythmEditor);

  // ナビ: リズムエディター→KITエディター
  document.getElementById('reditor-to-kit-btn').addEventListener('click', async () => {
    await ensureAudio();
    if (!kickSynth) initDrums();
    openKitEditor();
  });

  // ── 再生/停止 ─────────────────────────────────────────────────────────────
  const reditorPlayBtn = document.getElementById('reditor-play-btn');
  reditorPlayBtn.addEventListener('click', async () => {
    await ensureAudio();
    if (!kickSynth) initDrums();
    // 常に最新のエディター内容を user__editor へ反映してから開始/停止を委譲する
    // （rhythm-select に頼らず、エディターの現在状態を確実に使うため）
    RHYTHM_PATTERNS['user__editor'] = editorToPattern();
    // INTRO/FILL/ENDINGのオーケストレーションを含めた開始/停止に統一
    // （state.isPlaying の切り替え・全画面のボタン表示同期は
    //  toggleRhythmArrangement 側（arrangement.js）で一元管理する）
    toggleRhythmArrangement();
  });

  // KIT select は setupRhythm() で配線済み

  // ── クオンタイズボタン ────────────────────────────────────────────────────
  document.querySelectorAll('.pr-q-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      prQuantize = btn.dataset.q;
      document.querySelectorAll('.pr-q-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });

  // ── Swing スライダー ─────────────────────────────────────────────────────
  document.getElementById('reditor-swing').addEventListener('input', e => {
    editorState.swing = parseInt(e.target.value);
    document.getElementById('reditor-swing-val').textContent = editorState.swing + '%';
    applyEditorPatternRT();
  });

  // ── PRESET 選択 + LOAD ────────────────────────────────────────────────────
  document.getElementById('reditor-load-preset-btn').addEventListener('click', loadPresetIntoEditor);

  // ── SAVE (grooveフォーマットで保存) ──────────────────────────────────────
  document.getElementById('reditor-save-btn').addEventListener('click', () => {
    const nameEl = document.getElementById('reditor-pat-name');
    const name = (nameEl.value || '').trim();
    if (!name) { nameEl.focus(); return; }
    const patterns = loadUserPatterns();
    const existing = patterns.findIndex(p => p.name === name);
    const entry = {
      name,
      groove_kick:  editorState.kick.map(e=>({...e})),
      groove_snare: editorState.snare.map(e=>({...e})),
      groove_hat:   editorState.hat.map(e=>({...e})),
      groove_hiop:  editorState.hiop.map(e=>({...e})),
      groove_rim:   editorState.rim.map(e=>({...e})),
      groove_cowbl: editorState.cowbl.map(e=>({...e})),
      groove_clap:  editorState.clap.map(e=>({...e})),
      groove_tamb:  editorState.tamb.map(e=>({...e})),
      groove_shkr:  editorState.shkr.map(e=>({...e})),
      swing: editorState.swing,
    };
    if (existing >= 0) patterns[existing] = entry;
    else patterns.push(entry);
    saveUserPatterns(patterns);
    nameEl.value = '';
    syncUserPatternsToSelect();
    reditorRenderPatList();
  });

  // ── APPLY Q ──────────────────────────────────────────────────────────────
  document.getElementById('reditor-apply-q-btn').addEventListener('click', () => {
    applyQuantizeToAll();
  });

  // ── HUMANIZE ─────────────────────────────────────────────────────
  document.getElementById('reditor-humanize-btn').addEventListener('click', () => {
    applyHumanize();
  });

  // ── RANDOMIZE ────────────────────────────────────────────────────────────
  document.getElementById('reditor-randomize-btn').addEventListener('click', () => {
    randomizeEditorPattern();
  });

  // ── CLEAR ─────────────────────────────────────────────────────────────────
  document.getElementById('reditor-clear-btn').addEventListener('click', () => {
    for (const ch of GROOVE_CHANNELS) editorState[ch] = [];
    editorState.swing = 0;
    reditorRender();
    applyEditorPatternRT();
  });

  // ── JSON書き出し ──────────────────────────────────────────────────────────
  document.getElementById('reditor-export-btn').addEventListener('click', () => {
    const patterns = loadUserPatterns();
    if (patterns.length === 0) { alert('No saved patterns to export.'); return; }
    const json = JSON.stringify(patterns, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.getElementById('dl');
    a.href = url;
    a.download = 'omnitro-patterns-' + new Date().toISOString().slice(0,10) + '.json';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });

  // ── パターンJSONインポート ─────────────────────────────────────────────────
  document.getElementById('reditor-import-file').addEventListener('change', (e) => {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const imported = JSON.parse(ev.target.result);
        const arr = Array.isArray(imported) ? imported : [imported];
        const existing = loadUserPatterns();
        arr.forEach(pat => {
          if (!pat.name) return;
          const idx = existing.findIndex(p => p.name === pat.name);
          if (idx >= 0) existing[idx] = pat; else existing.push(pat);
        });
        saveUserPatterns(existing);
        syncUserPatternsToSelect();
        reditorRenderPatList();
        alert('Imported ' + arr.length + ' pattern(s).');
      } catch(err) { alert('Import failed: ' + err.message); }
      e.target.value = '';
    };
    reader.readAsText(file);
  });

  // 起動時に保存済みパターンをselectに反映
  syncUserPatternsToSelect();
}


