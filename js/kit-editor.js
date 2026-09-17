// ─── KIT EDITOR ──────────────────────────────────────────────────────────────
//
// 各チャンネル（KICK / SNARE / HI-CL / HI-OP / RIM / COWBL / CLAP）に対して
// LEVEL / TUNE / DECAY / PAN の4パラメータをリアルタイム調整できる。
// 変更は kitEditParams に即反映され、次の発音から適用される。

const KIT_CH_LABELS = { kick:'KICK', snare:'SNARE', hat:'HI-CL', hiop:'HI-OP', rim:'RIM', cowbl:'COWBL', clap:'CLAP', tamb:'TAMB', shkr:'SHKR' };
const KIT_CH_COLORS = { kick:'#27ae60', snare:'#e8c95a', hat:'#4fc3f7', hiop:'#80d8ff', rim:'#d4e040', cowbl:'#ce93d8', clap:'#ef9a9a', tamb:'#ffb347', shkr:'#7ec8a0' };

function openKitEditor() {
  document.getElementById('settings-overlay').classList.remove('open');
  document.getElementById('rhythm-editor-overlay').classList.remove('open');
  const overlay = document.getElementById('kit-editor-overlay');
  overlay.style.display = 'flex';
  document.getElementById('kit-editor-kitname').textContent = currentDrumKit.toUpperCase();
  const kitSelEditor = document.getElementById('kit-select-editor');
  if (kitSelEditor) kitSelEditor.value = currentDrumKit;
  buildKitEditorStrips();
  kitRenderUserList();
}

function closeKitEditor() {
  document.getElementById('kit-editor-overlay').style.display = 'none';
}

function buildKitEditorStrips() {
  const container = document.getElementById('kit-editor-strips');
  container.innerHTML = '';

  // パラメータグループ定義（UIのセクション分け）
  const PARAM_GROUPS = [
    { label: 'LEVEL / PITCH',  keys: ['level','tune','pan'] },
    { label: 'ENVELOPE',       keys: ['attack','decay','transient','pitch_env'] },
    { label: 'CLAP SHAPE',     keys: ['clap_spread','clap_peaks','clap_tail'], clapOnly: true },
    { label: 'FILTER',         keys: ['lpf','lpfQ','hpf'] },
    { label: 'CHARACTER',      keys: ['drive','room'] },
  ];

  KIT_EDIT_CHANNELS.forEach(ch => {
    const p     = kitEditParams[ch];
    const color = KIT_CH_COLORS[ch];
    const label = KIT_CH_LABELS[ch];

    const strip = document.createElement('div');
    strip.style.cssText = `background:#0d1b2a;border:1px solid ${color}44;border-radius:8px;padding:8px 12px;margin-bottom:2px;`;

    // ヘッダー
    const header = document.createElement('div');
    header.style.cssText = 'display:flex;align-items:center;gap:8px;margin-bottom:6px;cursor:pointer;user-select:none;';
    header.innerHTML = `
      <div style="font-family:'Orbitron',sans-serif;font-size:10px;color:${color};letter-spacing:2px;min-width:50px;">${label}</div>
      <button class="kit-preview-btn" data-ch="${ch}" style="font-family:'Share Tech Mono',monospace;font-size:8px;letter-spacing:1px;border-radius:3px;cursor:pointer;padding:3px 9px;border:1px solid ${color}88;background:#060e18;color:${color};">▶ TEST</button>
      <div style="flex:1;"></div>
      <div class="kit-strip-toggle" style="font-size:9px;color:var(--text-dim);">▼</div>`;
    strip.appendChild(header);

    // パラメータ本体（折りたたみ可能）
    const body = document.createElement('div');
    body.className = 'kit-strip-body';

    PARAM_GROUPS.forEach(group => {
      // clapOnly グループは clap チャンネルのみ表示
      if (group.clapOnly && ch !== 'clap') return;
      const defs = group.keys.map(k => KIT_PARAM_DEFS.find(d => d.key === k)).filter(Boolean);
      if (!defs.length) return;

      const groupEl = document.createElement('div');
      groupEl.style.cssText = 'margin-bottom:6px;';
      groupEl.innerHTML = `<div style="font-size:7px;color:var(--text-dim);letter-spacing:2px;text-transform:uppercase;margin-bottom:4px;padding-bottom:2px;border-bottom:1px solid #1a3a5a;">${group.label}</div>`;

      defs.forEach(def => {
        const rawVal = p[def.key] ?? 0;
        const row = document.createElement('div');
        row.className = 'kit-param-row';
        row.innerHTML = `
          <div class="kit-param-label">${def.label}</div>
          <input type="range" class="kit-slider" data-ch="${ch}" data-param="${def.key}"
            min="${def.min}" max="${def.max}" step="${def.step}" value="${rawVal}">
          <div class="kit-param-val" id="kpe-${ch}-${def.key}">${def.fmt(rawVal)}</div>`;
        groupEl.appendChild(row);
      });

      body.appendChild(groupEl);
    });

    strip.appendChild(body);

    // スライダーイベント（全パラメータ共通）
    strip.querySelectorAll('.kit-slider').forEach(slider => {
      slider.addEventListener('input', () => {
        const sch  = slider.dataset.ch;
        const prm  = slider.dataset.param;
        const raw  = parseFloat(slider.value);
        kitEditParams[sch][prm] = raw;
        const def  = KIT_PARAM_DEFS.find(d => d.key === prm);
        const valEl = document.getElementById(`kpe-${sch}-${prm}`);
        if (valEl && def) valEl.textContent = def.fmt(raw);
      });
    });

    // テストボタン
    header.querySelector('.kit-preview-btn').addEventListener('click', async (e) => {
      e.stopPropagation();
      await ensureAudio();
      if (!kickSynth) initDrums();
      const synths = { kick:kickSynth, snare:snareSynth, hat:hatSynth,
                       hiop:hiopSynth, rim:rimSynth, cowbl:cowblSynth, clap:clapSynth, tamb:tambSynth, shkr:shkrSynth };
      const s = synths[ch];
      if (s && s.trigger) s.trigger(Tone.getContext().rawContext.currentTime, 0.85);
    });

    // 折りたたみトグル
    header.addEventListener('click', () => {
      const isHidden = body.style.display === 'none';
      body.style.display = isHidden ? '' : 'none';
      header.querySelector('.kit-strip-toggle').textContent = isHidden ? '▼' : '▶';
    });

    container.appendChild(strip);
  });
}

// ── ユーザーキット保存 ──────────────────────────────────────────────────────
const USER_KITS_KEY = 'omnitro_user_kits_v1';

function loadUserKits() {
  try { const r = localStorage.getItem(USER_KITS_KEY); return r ? JSON.parse(r) : []; }
  catch(e) { return []; }
}
function saveUserKits(kits) {
  try { localStorage.setItem(USER_KITS_KEY, JSON.stringify(kits)); } catch(e) {}
}

function syncUserKitsToSelect() {
  const kits = loadUserKits();
  // Settings と Rhythm Editor の両 select を更新
  ['kit-select-settings', 'kit-select-reditor', 'kit-select-editor'].forEach(selId => {
    const sel = document.getElementById(selId);
    if (!sel) return;
    const optsGroup = sel.querySelector('[id$="-user-opts"]');
    if (!optsGroup) return;
    optsGroup.innerHTML = '';
    kits.forEach(kit => {
      const opt = document.createElement('option');
      opt.value = 'user__' + kit.name;
      opt.textContent = '★ ' + kit.name;
      optsGroup.appendChild(opt);
    });
  });
  kitRenderUserList();
}

// Kit dropdown 変更時の処理（factory or user kit ロード）
async function onKitSelectChange(kitVal) {
  await ensureAudio();
  if (kitVal.startsWith('user__')) {
    const name = kitVal.slice(6);
    const kits = loadUserKits();
    const found = kits.find(k => k.name === name);
    if (found) {
      KIT_EDIT_CHANNELS.forEach(ch => {
        if (found.params[ch]) kitEditParams[ch] = { ...KIT_EDIT_DEFAULTS[ch], ...found.params[ch] };
      });
      // ユーザーキットは既存バッファを使いつつ kitEditParams のみ更新
      initDrums(currentDrumKit);
    }
  } else {
    // キャッシュを破棄して必ず再生成（tambなど後追加チャンネルが欠落しないよう保証）
    delete drumKitBuffers[kitVal];
    initDrums(kitVal);
  }
  // 両方のselectを同期
  ['kit-select-settings','kit-select-reditor','kit-select-editor'].forEach(id => {
    const el = document.getElementById(id);
    if (el && el.value !== kitVal) el.value = kitVal;
  });
  // KIT切り替え後にリズムを再始動する際は、現在実際にアクティブなパターン
  // （ピアノロールでの未保存の編集内容を含む editorState）をそのまま維持する。
  // 引数なしの startRhythm() は隠しセレクト rhythm-select の値からパターンを
  // 再取得するため、その場で編集中の未保存パターンが失われてしまっていた
  // （現在は startRhythm 側の優先順位も修正済みだが、念のため明示的に渡す）。
  if (state.isPlaying) {
    if (typeof arrangementState !== 'undefined') arrangementState.mode = 'main';
    stopRhythm(); startRhythm(editorToPattern());
  }
}

function kitRenderUserList() {
  const list = document.getElementById('kit-user-list');
  if (!list) return;
  list.innerHTML = '';
  const kits = loadUserKits();
  if (kits.length === 0) {
    list.innerHTML = '<div style="font-size:8px;color:var(--text-dim);letter-spacing:1px;">No saved kits</div>';
    return;
  }
  kits.forEach((kit, idx) => {
    const item = document.createElement('div');
    item.style.cssText = 'display:flex;align-items:center;gap:6px;padding:4px 7px;background:#0e1c2c;border:1px solid #1a3a5a;border-radius:3px;cursor:pointer;';
    item.innerHTML = `<div style="font-family:'Share Tech Mono',monospace;font-size:9px;color:var(--text-dim);flex:1;letter-spacing:1px;">${kit.name}</div>
      <div style="font-size:9px;color:#4fc3f7;cursor:pointer;padding:0 4px;" data-load="${idx}">LOAD</div>
      <div style="font-size:11px;color:#5a3a3a;cursor:pointer;padding:0 4px;" data-del="${idx}">✕</div>`;
    item.querySelector('[data-load]').addEventListener('click', () => {
      KIT_EDIT_CHANNELS.forEach(ch => {
        if (kit.params[ch]) kitEditParams[ch] = { ...KIT_EDIT_DEFAULTS[ch], ...kit.params[ch] };
      });
      buildKitEditorStrips();
      document.getElementById('kit-editor-kitname').textContent = kit.name;
    });
    item.querySelector('[data-del]').addEventListener('click', (e) => {
      e.stopPropagation();
      const ks = loadUserKits(); ks.splice(idx, 1);
      saveUserKits(ks); kitRenderUserList();
    });
    list.appendChild(item);
  });
}

// ── KITランダム生成 ──────────────────────────────────────────────────────────
function randomizeKitParams() {
  const rnd = (min, max) => Math.round(min + Math.random() * (max - min));
  const rndF = (min, max) => parseFloat((min + Math.random() * (max - min)).toFixed(1));

  // KICK: 深いサブキックから明るいタイトキックまで
  kitEditParams.kick = {
    level: rnd(80,120), tune: rnd(-8,4), pan: 0,
    attack: rnd(0,5), decay: rnd(120,400), transient: rnd(40,90),
    lpf: rnd(1200,6000), lpfQ: rnd(2,15), hpf: rnd(20,80),
    drive: rnd(5,40), room: rnd(0,20), pitch_env: rnd(-16,-2),
    clap_spread:7, clap_tail:30, clap_peaks:3,
  };
  // SNARE: スナッピーからクラップ感まで
  kitEditParams.snare = {
    level: rnd(80,115), tune: rnd(-6,6), pan: rnd(-10,10),
    attack: rnd(0,3), decay: rnd(80,280), transient: rnd(50,95),
    lpf: rnd(3000,12000), lpfQ: rnd(3,18), hpf: rnd(80,300),
    drive: rnd(0,30), room: rnd(5,30), pitch_env: rnd(-4,4),
    clap_spread:7, clap_tail:30, clap_peaks:3,
  };
  // HI-HAT(CL): タイトメタルから曇りまで
  kitEditParams.hat = {
    level: rnd(60,100), tune: rnd(-8,8), pan: rnd(-20,20),
    attack: 0, decay: rnd(30,120), transient: rnd(20,60),
    lpf: rnd(6000,18000), lpfQ: rnd(1,10), hpf: rnd(1000,5000),
    drive: rnd(0,15), room: 0, pitch_env: 0,
    clap_spread:7, clap_tail:30, clap_peaks:3,
  };
  // HI-HAT(OP): 少し長め
  kitEditParams.hiop = {
    level: rnd(55,95), tune: rnd(-6,6), pan: rnd(-25,25),
    attack: 0, decay: rnd(120,400), transient: rnd(15,50),
    lpf: rnd(5000,16000), lpfQ: rnd(1,8), hpf: rnd(800,3000),
    drive: rnd(0,10), room: rnd(0,12), pitch_env: 0,
    clap_spread:7, clap_tail:30, clap_peaks:3,
  };
  // RIM
  kitEditParams.rim = {
    level: rnd(55,90), tune: rnd(-4,8), pan: rnd(-15,15),
    attack: 0, decay: rnd(50,160), transient: rnd(60,95),
    lpf: rnd(4000,12000), lpfQ: rnd(5,20), hpf: rnd(200,800),
    drive: rnd(0,20), room: rnd(0,10), pitch_env: 0,
    clap_spread:7, clap_tail:30, clap_peaks:3,
  };
  // COWBELL
  kitEditParams.cowbl = {
    level: rnd(25,55), tune: rnd(-6,6), pan: rnd(-20,20),
    attack: 0, decay: rnd(100,350), transient: rnd(70,100),
    lpf: rnd(3000,9000), lpfQ: rnd(8,25), hpf: rnd(300,700),
    drive: rnd(10,45), room: 0, pitch_env: 0,
    clap_spread:7, clap_tail:30, clap_peaks:3,
  };
  // CLAP: ナチュラルからエレクトロまで
  const clapStyle = Math.random() < 0.5 ? 'natural' : 'electro';
  kitEditParams.clap = {
    level: rnd(75,110), tune: rnd(-3,3), pan: rnd(-8,8),
    attack: 0, decay: rnd(120,250), transient: rnd(30,70),
    lpf: clapStyle==='natural' ? rnd(1800,3500) : rnd(3000,8000),
    lpfQ: clapStyle==='natural' ? rnd(20,40) : rnd(5,20),
    hpf: clapStyle==='natural' ? rnd(600,1200) : rnd(300,800),
    drive: rnd(50,95), room: rnd(10,35), pitch_env: 0,
    clap_spread: rnd(4,14), clap_tail: rnd(20,60), clap_peaks: rnd(2,4),
  };
  // TAMB: タンバリン — 金属感の強さ・明るさ・長さをランダムに
  kitEditParams.tamb = {
    level: rnd(50,90), tune: rnd(-6,6), pan: rnd(-15,15),
    attack: 0, decay: rnd(150,380), transient: rnd(35,70),
    lpf: rnd(7000,14000), lpfQ: rnd(3,14), hpf: rnd(400,1200),
    drive: rnd(0,25), room: rnd(5,20), pitch_env: 0,
    clap_spread:7, clap_tail:30, clap_peaks:3,
  };
  kitEditParams.shkr = {
    level: rnd(45,85), tune: rnd(-4,4), pan: rnd(-15,15),
    attack: 0, decay: rnd(100,350), transient: rnd(30,65),
    lpf: rnd(8000,16000), lpfQ: rnd(3,12), hpf: rnd(500,1500),
    drive: rnd(0,20), room: rnd(3,15), pitch_env: 0,
    clap_spread:7, clap_tail:30, clap_peaks:3,
  };
  buildKitEditorStrips();
}

function setupKitEditor() {
  // CSS for kit param rows (injected once)
  if (!document.getElementById('kit-editor-style')) {
    const style = document.createElement('style');
    style.id = 'kit-editor-style';
    style.textContent = `
      .kit-param-row { display:flex; align-items:center; gap:8px; margin-bottom:5px; }
      .kit-param-label { font-size:8px; color:var(--text-dim); letter-spacing:1px; width:52px; flex-shrink:0; }
      .kit-slider { flex:1; height:3px; accent-color:var(--accent1); background:#1a2a3a; border-radius:2px; cursor:pointer; }
      .kit-param-val { font-size:8px; color:var(--accent1); min-width:32px; text-align:right; font-family:'Share Tech Mono',monospace; flex-shrink:0; }
    `;
    document.head.appendChild(style);
  }

  document.getElementById('kit-editor-close-btn').addEventListener('click', closeKitEditor);

  // RESET (ヘッダーから本体へ移動したので kit-editor-reset-btn2 を使用)
  const resetFn = () => {
    KIT_EDIT_CHANNELS.forEach(ch => { kitEditParams[ch] = { ...KIT_EDIT_DEFAULTS[ch] }; });
    buildKitEditorStrips();
  };
  const resetBtn2 = document.getElementById('kit-editor-reset-btn2');
  if (resetBtn2) resetBtn2.addEventListener('click', resetFn);

  // ナビ: KIT→リズムエディター
  document.getElementById('kit-to-reditor-btn').addEventListener('click', () => {
    closeKitEditor();
    openRhythmEditor();
  });

  // ▶ PLAY / ■ STOP ボタン
  const kitPlayBtn = document.getElementById('kit-play-btn');
  if (kitPlayBtn) {
    kitPlayBtn.addEventListener('click', async () => {
      await ensureAudio();
      if (!kickSynth) initDrums();
      // INTRO/FILL/ENDINGのオーケストレーションを含めた開始/停止に統一
      // （state.isPlaying の切り替え・全画面のボタン表示同期は
      //  toggleRhythmArrangement 側（arrangement.js）で一元管理する）
      toggleRhythmArrangement();
    });
  }

  // ランダム
  document.getElementById('kit-random-btn').addEventListener('click', randomizeKitParams);

  // 保存
  document.getElementById('kit-save-btn').addEventListener('click', () => {
    const nameEl = document.getElementById('kit-name-input');
    const name = (nameEl.value || '').trim();
    if (!name) { nameEl.focus(); return; }
    const kits = loadUserKits();
    const entry = {
      name,
      params: JSON.parse(JSON.stringify(kitEditParams)),
    };
    const existing = kits.findIndex(k => k.name === name);
    if (existing >= 0) kits[existing] = entry; else kits.push(entry);
    saveUserKits(kits);
    nameEl.value = '';
    const status = document.getElementById('kit-save-status');
    if (status) { status.textContent = 'SAVED'; setTimeout(() => { status.textContent = ''; }, 1500); }
    syncUserKitsToSelect();
    kitRenderUserList();
  });

  // JSON書き出し
  document.getElementById('kit-export-btn').addEventListener('click', () => {
    const kits = loadUserKits();
    if (!kits.length) { alert('No saved kits to export.'); return; }
    const blob = new Blob([JSON.stringify(kits, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.getElementById('dl');
    a.href = url; a.download = 'omnitro-kits-' + new Date().toISOString().slice(0,10) + '.json';
    a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  });

  // JSONインポート
  document.getElementById('kit-import-file').addEventListener('change', (e) => {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const imported = JSON.parse(ev.target.result);
        if (!Array.isArray(imported)) throw new Error('Not an array');
        const existing = loadUserKits();
        imported.forEach(kit => {
          if (!kit.name || !kit.params) return;
          const idx = existing.findIndex(k => k.name === kit.name);
          if (idx >= 0) existing[idx] = kit; else existing.push(kit);
        });
        saveUserKits(existing);
        syncUserKitsToSelect();
        kitRenderUserList();
        alert('Imported ' + imported.length + ' kit(s).');
      } catch(err) { alert('Import failed: ' + err.message); }
      e.target.value = '';
    };
    reader.readAsText(file);
  });

  document.getElementById('open-kit-editor-btn').addEventListener('click', async () => {
    await ensureAudio();
    if (!kickSynth) initDrums();
    openKitEditor();
  });

  // 初期化時にユーザーKitをselectに反映
  syncUserKitsToSelect();
}

// ── Studio UI setup ────────────────────────────────────────────────────────────
