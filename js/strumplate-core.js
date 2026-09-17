function triggerSubAttackRelease(note, velocity = 0.6, duration = 0.75) {
  if (!subSynth || !note || typeof subSynth.triggerAttackRelease !== 'function') return;
  try { subSynth.triggerAttackRelease(note, duration, Tone.now(), velocity); } catch (e) {}
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
  const dot = document.createElement('div');
  dot.className = 'note-flash';
  dot.style.left = x + 'px';
  dot.style.top = (Math.random() * rect.height * 0.7 + rect.height * 0.15) + 'px';
  sp.appendChild(dot);
  setTimeout(() => dot.remove(), 400);
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

