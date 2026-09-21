// ─── STRUMPLATE EVENTS ────────────────────────────────────────────────────────
function setupStrumplate() {
  const sp = document.getElementById('strumplate');
  const hint = document.getElementById('strum-hint');
  const indicator = document.getElementById('strum-indicator');
  const modeLabel = document.getElementById('strum-mode-label');
  let rect = sp.getBoundingClientRect();

  let active = false, startPos = 0, startTime = 0, totalMove = 0;
  let holdTimer = null, gestureMode = null;

  const updateRect = () => { rect = sp.getBoundingClientRect(); };

  // Get primary axis position relative to strumplate
  function getPos(clientX, clientY) {
    if (sp.classList.contains('vertical')) {
      return clientY - rect.top;
    }
    return clientX - rect.left;
  }

  function showIndicator(pos, mode) {
    if (sp.classList.contains('vertical')) {
      indicator.style.top = pos + 'px';
      indicator.style.left = '';
    } else {
      indicator.style.left = pos + 'px';
      indicator.style.top = '';
    }
    indicator.classList.add('visible');
    indicator.classList.toggle('hold-mode', mode === 'hold');
    modeLabel.className = 'strum-mode-label visible' + (mode === 'hold' ? ' hold' : '');
    modeLabel.textContent = mode === 'hold' ? 'HOLD' : mode === 'slide' ? 'SLIDE' : 'TAP';
  }

  function hideIndicator() {
    indicator.classList.remove('visible', 'hold-mode');
    modeLabel.classList.remove('visible', 'hold');
  }

  function cancelHoldTimer() {
    if (holdTimer) { clearTimeout(holdTimer); holdTimer = null; }
  }

  async function onStart(pos) {
    if (!state.selectedRoot) return;
    await ensureAudio();
    updateRect();
    active = true;
    startPos = pos; startTime = Date.now(); totalMove = 0;
    gestureMode = null;
    // lastArpX / lastArpNote を発音ノートで初期化する。
    // -999 のままだと最初の touchmove で必ず閾値を超えて重複発音が起きるため、
    // onStart の発音ノートを記録しておき strumSlide 側で同一ノートをスキップする。
    lastArpX    = pos;
    lastArpNote = null;   // まだ発音前なので null → 直後に更新
    hint.classList.add('hidden');
    showIndicator(pos, 'tap');
    cancelHoldTimer();
    // タッチした瞬間に発音
    const note = getNoteAtPos(pos, rect);
    if (note && strumSynth) {
      strumSynth.triggerAttackRelease(note, 0.75);
      triggerSubAttackRelease(note, 0.75);
      lastArpNote = note;   // 発音したノートを記録
      spawnFlashColored(pos, 0);
    }
  }

  async function onMove(pos) {
    if (!active) return;
    const prevPos = lastArpX === -999 ? startPos : lastArpX;
    totalMove += Math.abs(pos - prevPos);

    if (totalMove >= STRUM_THRESHOLD) {
      if (gestureMode !== 'slide') { cancelHoldTimer(); gestureMode = 'slide'; }
      showIndicator(pos, 'slide');
      await strumSlide(pos, rect);
    } else {
      showIndicator(pos, 'tap');
    }
  }

  async function onEnd(pos) {
    if (!active) return;
    active = false;
    cancelHoldTimer();
    // 発音はonStartで済んでいるので、onEndでは何もしない
    hideIndicator();
    gestureMode = null;
  }

  // ─── マルチタッチ: 全指を同一ロジックで処理 ──────────────────────────────
  // 各指: touchstart→即発音、touchmove→閾値超えで発音、touchend→何もしない
  // 1本指の時だけジェスチャー判定（タップ・ホールド）を有効にする
  // 2本目が触れた瞬間にホールドタイマーをキャンセルし全指スライドモードへ

  // 指ごとの色: 1本目=青、2本目=紫、3本目=オレンジ
  const FINGER_COLORS = [
    { rgb: '79,195,247',  hex: '#4fc3f7' },   // 青
    { rgb: '167,139,250', hex: '#a78bfa' },   // 紫
    { rgb: '251,146,60',  hex: '#fb923c' },   // オレンジ
  ];

  // strumFingers: id → { lastArpX, colorIdx, indicatorEl }
  const strumFingers = new Map();

  // 指のインジケーター要素を生成してストラムプレートに追加
  function createIndicatorEl(colorIdx) {
    const isVertical = sp.classList.contains('vertical');
    const el = document.createElement('div');
    el.className = 'strum-touch-indicator' + (isVertical ? ' vertical' : '');
    const c = FINGER_COLORS[colorIdx] || FINGER_COLORS[0];
    if (isVertical) {
      el.style.background = `linear-gradient(90deg, transparent, rgba(${c.rgb},0.8), rgba(255,255,255,0.9), rgba(${c.rgb},0.8), transparent)`;
    } else {
      el.style.background = `linear-gradient(180deg, transparent, rgba(${c.rgb},0.8), rgba(255,255,255,0.9), rgba(${c.rgb},0.8), transparent)`;
    }
    el.style.boxShadow = `0 0 8px rgba(${c.rgb},0.8), 0 0 16px rgba(${c.rgb},0.4)`;
    sp.appendChild(el);
    return el;
  }

  // インジケーター位置を更新して表示
  function moveIndicatorEl(el, pos) {
    const isVertical = sp.classList.contains('vertical');
    if (isVertical) {
      el.style.top = pos + 'px';
    } else {
      el.style.left = pos + 'px';
    }
    el.classList.add('visible');
  }

  // インジケーター要素を非表示にして削除
  function removeIndicatorEl(el) {
    if (!el) return;
    el.classList.remove('visible');
    setTimeout(() => { try { el.remove(); } catch(e){} }, 100);
  }

  // 色付きフラッシュを生成（spawnFlashの拡張版）
  // ── パフォーマンス: DOM要素はstrumplate-core.jsの共有プールを再利用する
  //    （高速ストラム/マルチタッチ時のDOM生成・破棄churnを削減）。
  function spawnFlashColored(pos, colorIdx) {
    const c = FINGER_COLORS[colorIdx] || FINGER_COLORS[0];
    const dot = _acquireFlashEl(sp);
    dot.style.background = `rgba(${c.rgb},0.9)`;
    dot.style.boxShadow = `0 0 8px rgba(${c.rgb},1), 0 0 20px rgba(${c.rgb},0.5)`;
    const isVertical = sp.classList.contains('vertical');
    if (isVertical) {
      dot.style.left = (rect.width * 0.5) + 'px';
      dot.style.top  = pos + 'px';
    } else {
      dot.style.left = pos + 'px';
      dot.style.top  = (rect.height * 0.5) + 'px';
    }
    _playFlash(dot);
  }

  function playAtPos(pos, velocity, colorIdx, finger) {
    if (!state.selectedRoot || !strumSynth) return;
    const note = getNoteAtPos(pos, rect);
    if (!note) return;
    // 同一ノートゾーンへの重複発音を防ぐ（各指が独立した lastNote を持つ）
    if (finger && note === finger.lastNote) return;
    if (finger) finger.lastNote = note;
    strumSynth.triggerAttackRelease(note, velocity);
    triggerSubAttackRelease(note, velocity);
    spawnFlashColored(pos, colorIdx ?? 0);
  }

  sp.addEventListener('touchstart', e => {
    e.preventDefault();
    updateRect();
    for (const t of e.changedTouches) {
      const pos = getPos(t.clientX, t.clientY);
      const colorIdx = strumFingers.size % FINGER_COLORS.length;

      if (strumFingers.size === 0) {
        // 1本目: 動的インジケーター要素を生成（2本目以降と同じ経路）
        const el = createIndicatorEl(colorIdx);
        moveIndicatorEl(el, pos);
        strumFingers.set(t.identifier, { lastArpX: pos, colorIdx, indicatorEl: el, lastNote: null });
        onStart(pos);
      } else {
        // 2本目以降: ホールドタイマーをキャンセル、全指をスライドモードへ
        cancelHoldTimer();
        if (!active) { active = true; gestureMode = 'slide'; lastArpX = pos; lastArpNote = null; }
        // 2本目以降は独自の色付きインジケーターを動的生成
        const el = createIndicatorEl(colorIdx);
        moveIndicatorEl(el, pos);
        const finger = { lastArpX: pos, colorIdx, indicatorEl: el, lastNote: null };
        strumFingers.set(t.identifier, finger);
        // 即座に発音（lastNote=nullなので必ず鳴る）
        ensureAudio().then(() => playAtPos(pos, 0.6, colorIdx, finger));
      }
    }
  }, { passive: false });

  sp.addEventListener('touchmove', e => {
    e.preventDefault();
    for (const t of e.changedTouches) {
      if (!strumFingers.has(t.identifier)) continue;
      const pos = getPos(t.clientX, t.clientY);
      const finger = strumFingers.get(t.identifier);
      const isFirst = t.identifier === strumFingers.keys().next().value;

      // インジケーターを移動（全指共通）
      if (finger.indicatorEl) moveIndicatorEl(finger.indicatorEl, pos);

      if (isFirst) {
        // 1本目の指: ジェスチャー判定に委ねる
        onMove(pos);
      } else {
        // 2本目以降: 独立してスライド発音（ノート変化チェックあり）
        if (Math.abs(pos - finger.lastArpX) > STRUM_THRESHOLD) {
          const speed = Math.min(1.0, Math.abs(pos - finger.lastArpX) / 60);
          playAtPos(pos, 0.45 + speed * 0.35, finger.colorIdx, finger);
          finger.lastArpX = pos;
        }
      }
    }
  }, { passive: false });

  sp.addEventListener('touchend', e => {
    e.preventDefault();
    for (const t of e.changedTouches) {
      if (!strumFingers.has(t.identifier)) continue;
      const pos = getPos(t.clientX, t.clientY);
      const finger = strumFingers.get(t.identifier);
      const wasFirst = t.identifier === strumFingers.keys().next().value;
      if (finger.indicatorEl) removeIndicatorEl(finger.indicatorEl);
      strumFingers.delete(t.identifier);

      if (wasFirst) {
        if (strumFingers.size === 0) {
          onEnd(pos);
        } else {
          cancelHoldTimer();
          onEnd(pos);
          active = true;
          gestureMode = 'slide';
          lastArpX    = pos;
          lastArpNote = null;   // 新しい1本目が引き継ぐのでリセット
        }
      }
    }
  }, { passive: false });

  sp.addEventListener('touchcancel', e => {
    e.preventDefault();
    for (const t of e.changedTouches) {
      if (!strumFingers.has(t.identifier)) continue;
      const finger = strumFingers.get(t.identifier);
      if (finger.indicatorEl) removeIndicatorEl(finger.indicatorEl);
      strumFingers.delete(t.identifier);
    }
    if (strumFingers.size === 0) {
      cancelHoldTimer();
      hideIndicator();
      active = false;
      gestureMode = null;
    }
  }, { passive: false });

  sp.addEventListener('mousedown',  e => { onStart(getPos(e.clientX, e.clientY)); });
  sp.addEventListener('mousemove',  e => { if (active) onMove(getPos(e.clientX, e.clientY)); });
  sp.addEventListener('mouseup',    e => { onEnd(getPos(e.clientX, e.clientY)); });
  sp.addEventListener('mouseleave', e => { if (active) onEnd(getPos(e.clientX, e.clientY)); });
}

