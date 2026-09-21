function triggerSubAttackRelease(note, velocity = 0.6, duration = 0.75) {
  if (!subSynth || !note || typeof subSynth.triggerAttackRelease !== 'function') return;
  try { subSynth.triggerAttackRelease(note, duration, Tone.now(), velocity); } catch (e) {}
}

// ─── フラッシュDOM要素プール ───────────────────────────────────────────────────
// 高速ストラム中に note-flash div を毎回 createElement → 400ms後にremove()
// していると、iPadなど非力な端末ではDOM挿入/削除・レイアウト・GCの負荷が
// 積み重なって描画スレッドを圧迫する（strumplate-ui.jsのspawnFlashColoredも
// 同じ問題を持つため、ここに共通のプールを用意して両方から使う）。
// 固定数の要素を使い回し、CSSアニメーションはリフローで強制的に再スタート
// する（見た目・アニメーション自体は元の実装と完全に同一）。
const FLASH_POOL_SIZE = 10;
const _flashPool = [];
let _flashPoolIdx = 0;

function _acquireFlashEl(sp) {
  let el;
  if (_flashPool.length < FLASH_POOL_SIZE) {
    el = document.createElement('div');
    sp.appendChild(el);
    _flashPool.push(el);
  } else {
    el = _flashPool[_flashPoolIdx];
    _flashPoolIdx = (_flashPoolIdx + 1) % FLASH_POOL_SIZE;
  }
  el.className = ''; // アニメーションを一旦解除してから呼び出し側でスタイル設定
  return el;
}

function _playFlash(el) {
  void el.offsetWidth; // リフロー強制でアニメーションを確実に先頭から再生
  el.className = 'note-flash';
}

function getNoteAtPos(clientPos, rect) {
  // vertical strumplate: use Y axis (top=high, bottom=low)
  const isVertical = document.getElementById('strumplate').classList.contains('vertical');
  let pos;
  if (isVertical) {
    pos = Math.max(0, Math.min(1, 1 - (clientPos / rect.height)));
  } else {
    pos = Math.max(0, Math.min(1, clientPos / rect.width));
  }
  return getArpeggioNotes(state.selectedRoot, state.selectedType, pos);
}

function spawnFlash(x, y, rect) {
  const sp = document.getElementById('strumplate');
  const dot = _acquireFlashEl(sp);
  dot.style.background = '';
  dot.style.boxShadow = '';
  dot.style.left = x + 'px';
  dot.style.top = (Math.random() * rect.height * 0.7 + rect.height * 0.15) + 'px';
  _playFlash(dot);
}

async function strumSlide(pos, rect) {
  if (!state.selectedRoot) return;
  await ensureAudio();
  if (Math.abs(pos - lastArpX) > STRUM_THRESHOLD) {
    const note = getNoteAtPos(pos, rect);
    // ノートが変化していない場合は発音しない（重複トリガー防止）
    if (note && note !== lastArpNote && strumSynth) {
      const speed = Math.min(1.0, Math.abs(pos - lastArpX) / 60);
      const velocity = 0.45 + speed * 0.35;
      strumSynth.triggerAttackRelease(note, velocity);
      triggerSubAttackRelease(note, velocity);
      lastArpX    = pos;
      lastArpNote = note;
      spawnFlash(pos, rect.height * 0.5, rect);
    } else if (note) {
      // ノートは同じだが位置は更新（次回の速度計算を正確にする）
      lastArpX = pos;
    }
  }
}

