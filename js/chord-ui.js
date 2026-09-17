// ─── BUILD UI ─────────────────────────────────────────────────────────────────
// Omnicord circle-of-fifths root order (flat→sharp): Db Ab Eb Bb F C G D A E B F#
const OMNI_ROOTS = ['Db','Ab','Eb','Bb','F','C','G','D','A','E','B','F#'];
const OMNI_ROOT_DISPLAY = ['D♭','A♭','E♭','B♭','F','C','G','D','A','E','B','F♯'];
const FLAT_ROWS = new Set([0,1,2,3]); // Db Ab Eb Bb
// Map omni display names back to Tone.js note names
const ROOT_TO_NOTE = {'Db':'C#','Ab':'G#','Eb':'D#','Bb':'A#','F':'F','C':'C','G':'G','D':'D','A':'A','E':'E','B':'B','F#':'F#'};

const CHORD_TYPE_KEYS = ['major','minor','7th','major7th','minor7th','augmented','diminished','sus4','add9th'];

function buildChordGrid() {
  // Build type header
  const header = document.getElementById('chord-type-header');
  header.innerHTML = '';
  CHORD_TYPE_KEYS.forEach(key => {
    const cell = document.createElement('div');
    cell.className = 'type-header-cell';
    cell.textContent = CHORD_TYPES[key].label;
    header.appendChild(cell);
  });

  // Build root labels
  const rootLabels = document.getElementById('chord-root-labels');
  rootLabels.innerHTML = '';
  OMNI_ROOTS.forEach((root, ri) => {
    const lbl = document.createElement('div');
    lbl.className = 'root-label' + (FLAT_ROWS.has(ri) ? ' flat-root' : '');
    lbl.textContent = OMNI_ROOT_DISPLAY[ri];
    rootLabels.appendChild(lbl);
  });

  // Build button grid (row=root, col=type)
  const container = document.getElementById('chord-keys');
  container.innerHTML = '';
  OMNI_ROOTS.forEach((omniRoot, ri) => {
    const toneRoot = ROOT_TO_NOTE[omniRoot];
    CHORD_TYPE_KEYS.forEach((typeKey, ci) => {
      const btn = document.createElement('div');
      btn.className = 'chord-key' + (FLAT_ROWS.has(ri) ? ' flat-row' : '');
      btn.dataset.root = toneRoot;
      btn.dataset.omniRoot = omniRoot;
      btn.dataset.type = typeKey;
      btn.dataset.col = ci;
      btn.setAttribute('data-col', ci);

      const clearChordKeys = () => document.querySelectorAll('.chord-key').forEach(b => b.classList.remove('active'));
      const clearSelectedChord = () => {
        state.selectedRoot = null;
        state.selectedType = 'major';
        state.selectedOmniRoot = null;
        updateChordDisplay();
      };

      btn.addEventListener('pointerdown', e => {
        e.preventDefault();
        btn.setPointerCapture?.(e.pointerId);

        const isSame = state.selectedRoot === toneRoot && state.selectedType === typeKey;
        if (isSame && state.chordHold && activeChordNotes.length > 0) {
          clearChordKeys();
          releaseChord();
          clearSelectedChord();
          return;
        }

        if (!state.chordAuto) releaseChord();
        clearChordKeys();
        btn.classList.add('active');
        state.selectedRoot = toneRoot;
        state.selectedType = typeKey;
        state.selectedOmniRoot = omniRoot;
        updateChordDisplay();
        if (state.chordAuto) playChord(toneRoot, typeKey);
      });

      const maybeRelease = () => {
        if (state.chordHold || !state.chordAuto) return;
        const isCurrent = state.selectedRoot === toneRoot && state.selectedType === typeKey;
        if (!isCurrent) return;
        releaseChord();
        clearChordKeys();
        clearSelectedChord();
      };

      btn.addEventListener('pointerup', e => {
        maybeRelease();
      });
      btn.addEventListener('pointercancel', e => {
        maybeRelease();
      });
      btn.addEventListener('lostpointercapture', () => {
        maybeRelease();
      });

      container.appendChild(btn);
    });
  });
}

function buildChordTypes() {} // no-op
function buildChordKeys() {}  // no-op

// ─── SIMPLE MODE: chord resolution from multi-touch ──────────────────────────
// pressedKeys: Set of "rootIdx-col" strings (col: 0=maj,1=min,2=7th)
const pressedKeys = new Set();

// Resolve which chord type from the combination of pressed buttons for one root
function resolveChordType(rootIdx, hasMaj, hasMin, has7th) {
  if (hasMaj && hasMin && has7th) return 'augmented';
  if (hasMaj && hasMin)  return 'diminished';
  if (hasMaj && has7th)  return 'major7th';
  if (hasMin && has7th)  return 'minor7th';
  if (hasMaj) return 'major';
  if (hasMin) return 'minor';
  if (has7th) return '7th';
  return null;
}

// Check for sus4 / add9th: involves two different roots
// sus4:  MAJ(root) + 7th(root-1 in omni order)  → C-MAJ + F-7th = Csus4
// add9:  MAJ(root) + MIN(root-1 in omni order)   → C-MAJ + F-MIN = Cadd9
function resolveSpecialChord() {
  // Build map: rootIdx → {hasMaj, hasMin, has7th}
  const map = {};
  for (const key of pressedKeys) {
    const [ri, ci] = key.split('-').map(Number);
    if (!map[ri]) map[ri] = { hasMaj:false, hasMin:false, has7th:false };
    if (ci === 0) map[ri].hasMaj = true;
    if (ci === 1) map[ri].hasMin = true;
    if (ci === 2) map[ri].has7th = true;
  }

  const rootIdxs = Object.keys(map).map(Number).sort((a,b) => a-b);
  if (rootIdxs.length !== 2) return null;

  const [r1, r2] = rootIdxs;
  const a = map[r1], b = map[r2];

  // sus4: higher root has MAJ only, lower root has 7th only (lower = prev in omni = r1)
  // In omni order, r1 < r2 means r1 is higher up in the list (Db=0 is highest)
  // "left of C-7th" means the row above in the list
  // C is index 5, F is index 4 → F is one step left (lower index)
  if (a.has7th && !a.hasMaj && !a.hasMin && b.hasMaj && !b.hasMin && !b.has7th && r2 === r1 + 1) {
    return { root: OMNI_ROOTS[r2], type: 'sus4' };
  }
  if (a.hasMin && !a.hasMaj && !a.has7th && b.hasMaj && !b.hasMin && !b.has7th && r2 === r1 + 1) {
    return { root: OMNI_ROOTS[r2], type: 'add9th' };
  }
  return null;
}

// ── コードボタン状態管理 ──────────────────────────────────────────────────────
// lastChordKeys: 最後に確定したコードのボタン組み合わせ（常に最新を保存）
// activeSession:  同一押下セッション中フラグ（全指が離れたらfalseにリセット）
let lastChordKeys  = new Set();
let activeSession  = false;

// .pressedの再描画: keysSetのボタンだけ点灯
function redrawPressed(keysSet) {
  document.querySelectorAll('.simple-key.pressed').forEach(b => b.classList.remove('pressed', 'mouse-held'));
  for (const key of keysSet) {
    const [r, c] = key.split('-');
    const btn = document.querySelector(`[data-row="${r}"][data-col="${c}"].simple-key`);
    if (btn) btn.classList.add('pressed');
  }
}

// コード確定: state更新・発音・表示
function commitChord(toneRoot, omniRoot, type, keysSnap) {
  lastChordKeys = new Set(keysSnap);
  activeSession  = true;
  state.selectedRoot    = toneRoot;
  state.selectedType    = type;
  state.selectedOmniRoot = omniRoot;
  updateChordDisplay();
  if (state.chordAuto) playChord(toneRoot, type);
}

function evaluateSimpleChord() {

  // ── 全指が離れた ──────────────────────────────────────────────────────────
  if (pressedKeys.size === 0) {
    activeSession = false;
    clearSimpleBadges();
    mouseHeldKeys.clear();
    if (state.chordHold && lastChordKeys.size > 0) {
      // CHORD HOLDオン: 最後のコードのボタンを点灯して維持
      redrawPressed(lastChordKeys);
      updateChordDisplay();
    } else {
      // CHORD HOLDオフ: 全消灯・コードリセット
      redrawPressed(new Set());
      lastChordKeys.clear();
      state.selectedRoot    = null;
      state.selectedType    = 'major';
      state.selectedOmniRoot = null;
      if (state.chordAuto) releaseChord();
      updateChordDisplay();
    }
    return;
  }

  // ── 同一セッション内で指が減った（一部離れた）場合: コード維持 ────────────
  // 条件: セッション継続中 かつ lastChordKeysが複数 かつ pressedKeysがその部分集合
  if (activeSession && lastChordKeys.size > 1 && pressedKeys.size < lastChordKeys.size) {
    if ([...pressedKeys].every(k => lastChordKeys.has(k))) {
      redrawPressed(pressedKeys);
      return; // コード変更なし
    }
  }

  // ── 新しい押下: コードを再評価 ────────────────────────────────────────────
  redrawPressed(pressedKeys);

  // special 2-root chords (sus4 / add9th)
  const special = resolveSpecialChord();
  if (special) {
    const toneRoot = ROOT_TO_NOTE[special.root];
    const omniIdx  = OMNI_ROOTS.indexOf(special.root);
    if (!state.chordAuto) releaseChord();
    // specialコードは pressedKeys の2キーがそのまま確定キー
    commitChord(toneRoot, special.root, special.type, pressedKeys);
    showSimpleBadge(special.type, omniIdx);
    return;
  }

  // single-root chords
  const map = {};
  for (const key of pressedKeys) {
    const [ri, ci] = key.split('-').map(Number);
    if (!map[ri]) map[ri] = { hasMaj:false, hasMin:false, has7th:false };
    if (ci === 0) map[ri].hasMaj = true;
    if (ci === 1) map[ri].hasMin = true;
    if (ci === 2) map[ri].has7th = true;
  }
  for (const ri of Object.keys(map).map(Number).sort((a,b) => a-b)) {
    const { hasMaj, hasMin, has7th } = map[ri];
    const type = resolveChordType(ri, hasMaj, hasMin, has7th);
    if (type) {
      const omniRoot = OMNI_ROOTS[ri];
      const toneRoot = ROOT_TO_NOTE[omniRoot];
      // 確定したコードに対応するキーだけを収集（余分な同時押しは含めない）
      const chordKeys = new Set();
      if (hasMaj) chordKeys.add(`${ri}-0`);
      if (hasMin) chordKeys.add(`${ri}-1`);
      if (has7th) chordKeys.add(`${ri}-2`);
      if (!state.chordAuto) releaseChord();
      commitChord(toneRoot, omniRoot, type, chordKeys);
      showSimpleBadge(type, ri);
      return;
    }
  }

  // コード未確定（無効な組み合わせ）: セッションをリセット
  activeSession = false;
  lastChordKeys.clear();
}

function clearSimpleBadges() {
  document.querySelectorAll('.chord-resolved-badge').forEach(b => b.remove());
}

function showSimpleBadge(type, rootIdx) {
  clearSimpleBadges();
  const label = CHORD_TYPES[type].label;
  // Find a pressed button in that row to attach the badge
  const btns = document.querySelectorAll(`[data-row="${rootIdx}"].simple-key.pressed`);
  btns.forEach(btn => {
    const badge = document.createElement('div');
    badge.className = 'chord-resolved-badge';
    badge.textContent = label;
    btn.appendChild(badge);
  });
}

// ─── BUILD SIMPLE CHORD GRID ─────────────────────────────────────────────────
const mouseHeldKeys = new Set(); // マウスでホールド中のキー

// PCキーボードマッピング（12ルート × 3タイプ）
// 順序: Db Ab Eb Bb F C G D A E B F# (omni order, index 0-11)
const KB_MAJ = ['a','s','d','f','g','h','j','k','l',';',':',']'];
const KB_MIN = ['q','w','e','r','t','y','u','i','o','p','@','['];
const KB_7TH = ['1','2','3','4','5','6','7','8','9','0','-','^'];

const kbKeyToId = {};
KB_MAJ.forEach((k, i) => { kbKeyToId[k] = `${i}-0`; });
KB_MIN.forEach((k, i) => { kbKeyToId[k] = `${i}-1`; });
KB_7TH.forEach((k, i) => { kbKeyToId[k] = `${i}-2`; });

const kbHeldKeys = new Set(); // 現在押下中のキーボードキー

function clearMouseHeld() {
  mouseHeldKeys.forEach(k => {
    pressedKeys.delete(k);
    const [row, col] = k.split('-');
    const btn = document.querySelector(`[data-row="${row}"][data-col="${col}"].simple-key`);
    if (btn) btn.classList.remove('pressed', 'mouse-held');
  });
  mouseHeldKeys.clear();
}

function clearKbHeld() {
  kbHeldKeys.forEach(key => {
    const id = kbKeyToId[key] ?? kbKeyToId[key.toLowerCase()];
    if (!id) return;
    pressedKeys.delete(id);
    const [row, col] = id.split('-');
    const btn = document.querySelector(`[data-row="${row}"][data-col="${col}"].simple-key`);
    if (btn) btn.classList.remove('pressed');
  });
  kbHeldKeys.clear();
}

function setupKeyboard() {
  document.addEventListener('keydown', e => {
    if (e.repeat) return;
    const id = kbKeyToId[e.key] ?? kbKeyToId[e.key.toLowerCase()];
    if (!id) return;
    if (kbHeldKeys.has(e.key)) return;
    // キーボード操作開始時にマウスホールドをクリア
    clearMouseHeld();
    kbHeldKeys.add(e.key);
    pressedKeys.add(id);
    const [row, col] = id.split('-');
    const btn = document.querySelector(`[data-row="${row}"][data-col="${col}"].simple-key`);
    if (btn) btn.classList.add('pressed');
    evaluateSimpleChord();
  });

  document.addEventListener('keyup', e => {
    const id = kbKeyToId[e.key] ?? kbKeyToId[e.key.toLowerCase()];
    if (!id) return;
    kbHeldKeys.delete(e.key);
    pressedKeys.delete(id);
    const [row, col] = id.split('-');
    const btn = document.querySelector(`[data-row="${row}"][data-col="${col}"].simple-key`);
    if (btn) btn.classList.remove('pressed');
    evaluateSimpleChord();
  });
}

function buildSimpleChordGrid() {
  const grid = document.getElementById('simple-chord-grid');
  grid.innerHTML = '';

  // ルートラベル列なし、コードネームをボタン内に表示
  const TYPE_LABELS = ['MAJ', 'MIN', '7'];

  OMNI_ROOTS.forEach((omniRoot, ri) => {
    // MAJ / MIN / 7th buttons (ラベル列なし: 3列のみ)
    ['col-maj','col-min','col-7th'].forEach((colClass, ci) => {
      const btn = document.createElement('div');
      btn.className = `simple-key ${colClass}${FLAT_ROWS.has(ri) ? ' flat-row' : ''}`;
      btn.dataset.row = ri;
      btn.dataset.col = ci;
      btn.dataset.root = ROOT_TO_NOTE[omniRoot];
      btn.dataset.omniRoot = omniRoot;
      const keyId = `${ri}-${ci}`;

      // コードネームをボタン内に表示
      const rootEl = document.createElement('span');
      rootEl.className = 'simple-key-root';
      rootEl.textContent = OMNI_ROOT_DISPLAY[ri];
      const typeEl = document.createElement('span');
      typeEl.className = 'simple-key-type';
      typeEl.textContent = TYPE_LABELS[ci];
      btn.appendChild(rootEl);
      btn.appendChild(typeEl);

      // マウス/ペン: 押下中のみ有効。離したら解除
      btn.addEventListener('pointerdown', e => {
        if (e.pointerType === 'touch') return;
        e.preventDefault();
        btn.setPointerCapture?.(e.pointerId);
        clearKbHeld();
        clearMouseHeld();
        pressedKeys.add(keyId);
        mouseHeldKeys.add(keyId);
        btn.classList.add('pressed', 'mouse-held');
        evaluateSimpleChord();
      });

      const releaseMouseKey = () => {
        if (!mouseHeldKeys.has(keyId)) return;
        pressedKeys.delete(keyId);
        mouseHeldKeys.delete(keyId);
        evaluateSimpleChord();
      };
      btn.addEventListener('pointerup', e => {
        if (e.pointerType === 'touch') return;
        releaseMouseKey();
      });
      btn.addEventListener('pointercancel', e => {
        if (e.pointerType === 'touch') return;
        releaseMouseKey();
      });
      btn.addEventListener('lostpointercapture', () => {
        releaseMouseKey();
      });

      grid.appendChild(btn);
    });
  });

  // ── タッチ: グリッド全体で管理（setPointerCaptureを使わない）──
  // 各タッチIDがどのボタンを押しているか管理
  const touchMap = new Map(); // pointerId → keyId

  function getKeyIdFromPoint(clientX, clientY) {
    const el = document.elementFromPoint(clientX, clientY);
    if (!el) return null;
    const btn = el.closest('.simple-key');
    if (!btn) return null;
    return `${btn.dataset.row}-${btn.dataset.col}`;
  }

  function addTouchKey(pointerId, keyId) {
    if (!keyId || touchMap.get(pointerId) === keyId) return;
    removeTouchKey(pointerId);
    touchMap.set(pointerId, keyId);
    pressedKeys.add(keyId);
    evaluateSimpleChord();
  }

  function removeTouchKey(pointerId) {
    const kid = touchMap.get(pointerId);
    if (!kid) return;
    touchMap.delete(pointerId);
    if (![...touchMap.values()].includes(kid)) {
      pressedKeys.delete(kid);
    }
    evaluateSimpleChord();
  }

  grid.addEventListener('touchstart', e => {
    e.preventDefault();
    for (const t of e.changedTouches) {
      const kid = getKeyIdFromPoint(t.clientX, t.clientY);
      if (kid) addTouchKey(t.identifier, kid);
    }
  }, { passive: false });

  grid.addEventListener('touchmove', e => {
    e.preventDefault();
    for (const t of e.changedTouches) {
      const kid = getKeyIdFromPoint(t.clientX, t.clientY);
      if (kid) addTouchKey(t.identifier, kid);
      else removeTouchKey(t.identifier);
    }
  }, { passive: false });

  grid.addEventListener('touchend', e => {
    e.preventDefault();
    for (const t of e.changedTouches) {
      removeTouchKey(t.identifier);
    }
  }, { passive: false });

  grid.addEventListener('touchcancel', e => {
    e.preventDefault();
    for (const t of e.changedTouches) {
      removeTouchKey(t.identifier);
    }
  }, { passive: false });
}

// ─── MODE SWITCHING ───────────────────────────────────────────────────────────
let isSimpleMode = true;

function setChordMode(simple) {
  isSimpleMode = simple;
  document.getElementById('simple-play-area').classList.toggle('active', simple);
  document.getElementById('full-play-area').classList.toggle('active', !simple);
  document.getElementById('strumplate-section').classList.toggle('active', !simple);

  // Move strumplate el into correct parent
  const sp = document.getElementById('strumplate');
  if (simple) {
    sp.classList.add('vertical');
    sp.classList.remove('horizontal');
    document.getElementById('simple-strum-wrap').appendChild(sp);
  } else {
    sp.classList.remove('vertical');
    sp.classList.add('horizontal');
    document.getElementById('strumplate-section').querySelector('.section-label').after(sp);
    // Rebuild strum indicator for horizontal
    const ind = document.getElementById('strum-indicator');
    ind.classList.remove('vertical');
  }
  pressedKeys.clear();
  mouseHeldKeys.clear();
  kbHeldKeys.clear();
  document.querySelectorAll('.simple-key.pressed').forEach(b => b.classList.remove('pressed', 'mouse-held'));
  clearSimpleBadges();
  releaseChord();
  updateChordDisplay();
}

function buildVoiceGrid() {
  const container = document.getElementById('voice-grid');
  Object.keys(VOICE_DEFS).forEach(v => {
    const def = VOICE_DEFS[v];
    const btn = document.createElement('button');
    btn.className = 'voice-btn' + (v === state.voice ? ' active' : '');
    btn.textContent = def.label || v;
    btn.title = `${def.label || v} / ${(typeof def.sub === 'string' ? def.sub : def.sub?.type) || 'sub'}`;
    btn.dataset.voice = v;
    btn.addEventListener('click', () => {
      state.voice = v;
      document.querySelectorAll('.voice-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById('header-voice').textContent = def.label || v;
      updateVoice(v);
      syncStrumplateVolumes();
    });
    container.appendChild(btn);
  });
}

function updateChordDisplay() {
  const disp = document.getElementById('chord-display');
  if (!state.selectedRoot) {
    disp.textContent = '──';
    return;
  }
  const label = CHORD_TYPES[state.selectedType].label;
  const rootDisp = (state.selectedOmniRoot || state.selectedRoot)
    .replace('b', '♭').replace('#', '♯');
  disp.textContent = rootDisp + ' ' + label;
}

