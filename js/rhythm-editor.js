// ─── RHYTHM EDITOR ────────────────────────────────────────────────────────────

// エディター内部状態
const GROOVE_CHANNELS = ['kick','snare','hat','hiop','rim','cowbl','clap','tamb','shkr'];

const editorState = {
  kick:[], snare:[], hat:[],
  hiop:[], rim:[],   cowbl:[], clap:[], tamb:[], shkr:[],
  swing: 0,
};

const CH_DEFAULT_VEL = {
  kick:0.85, snare:0.80, hat:0.55,
  hiop:0.60, rim:0.65,  cowbl:0.60, clap:0.75, tamb:0.65, shkr:0.65,
};

const REDITOR_STORAGE_KEY = 'omnitro_user_patterns_v2';

function loadUserPatterns() {
  try { const r=localStorage.getItem(REDITOR_STORAGE_KEY); return r?JSON.parse(r):[]; }
  catch(e){ return []; }
}
function saveUserPatterns(ps) {
  try { localStorage.setItem(REDITOR_STORAGE_KEY, JSON.stringify(ps)); }
  catch(e){}
}

// ── イベント操作ヘルパー ──────────────────────────────────────────────────────
function getEvent(ch, step)  { return editorState[ch].find(e=>e.step===step)||null; }
function hasEvent(ch, step)  { return editorState[ch].some(e=>e.step===step); }
function removeEvent(ch, step){ editorState[ch]=editorState[ch].filter(e=>e.step!==step); }
function setEvent(ch, step, props) {
  const idx=editorState[ch].findIndex(e=>e.step===step);
  if(idx>=0) Object.assign(editorState[ch][idx],props);
  else editorState[ch].push({step, vel:CH_DEFAULT_VEL[ch]||0.7, offset:0, prob:1.0, ...props});
  editorState[ch].sort((a,b)=>a.step-b.step);
}

// ── grooveフォーマット→editorState ──────────────────────────────────────────
function grooveToEditorState(groove) {
  for(const ch of GROOVE_CHANNELS)
    editorState[ch]=(groove[ch]||[]).map(e=>({...e}));
  editorState.swing=Math.round((groove.swing||0)*100);
}

// ── バイナリパターン→editorState ─────────────────────────────────────────────
function binaryPatternToEditorState(pat) {
  for(const ch of GROOVE_CHANNELS) editorState[ch]=[];
  const steps=pat.pattern?pat.pattern.length:16;
  for(let i=0;i<steps;i++){
    const v=pat.pattern?pat.pattern[i]:0;
    if(v===1) setEvent('kick', i,{vel:0.85,offset:0,prob:1.0});
    if(v===2) setEvent('snare',i,{vel:0.80,offset:0,prob:1.0,ghost:false});
    if(v===3) setEvent('snare',i,{vel:0.20,offset:0,prob:1.0,ghost:true});
    if(pat.hats &&pat.hats[i])  setEvent('hat',  i,{vel:0.55,offset:0,prob:1.0});
    if(pat.hiop &&pat.hiop[i])  setEvent('hiop', i,{vel:0.60,offset:0,prob:1.0});
    if(pat.rim  &&pat.rim[i])   setEvent('rim',  i,{vel:0.65,offset:0,prob:1.0});
    if(pat.cowbl&&pat.cowbl[i]) setEvent('cowbl',i,{vel:0.60,offset:0,prob:1.0});
    if(pat.clap &&pat.clap[i])  setEvent('clap', i,{vel:0.75,offset:0,prob:1.0});
  }
  editorState.swing=pat.swing!=null?Math.round(pat.swing*100):0;
}

// ── プリセットをエディターにロード ───────────────────────────────────────────
// ── パターン名でロード（全selectの唯一の真のソース） ────────────────────────
// Settings/起動時/RHYTHM EDITORのどこから選んでも必ずこれを経由する。
// editorStateを更新 → pianorollを再描画 → 再生中なら即座に反映。
function loadPatternByName(name) {
  if (!name) return;
  const pat = RHYTHM_PATTERNS[name];
  if (!pat) return;

  // editorStateに反映
  // swingはRHYTHM_PATTERNSでは0〜1の小数、grooveToEditorStateは×100で整数化
  if (pat.groove_kick !== undefined) {
    grooveToEditorState({
      kick:  pat.groove_kick  || [], snare: pat.groove_snare || [],
      hat:   pat.groove_hat   || [], hiop:  pat.groove_hiop  || [],
      rim:   pat.groove_rim   || [], cowbl: pat.groove_cowbl || [],
      clap:  pat.groove_clap  || [], tamb:  pat.groove_tamb  || [],
      shkr:  pat.groove_shkr  || [],
      swing: pat.swing || 0,  // 0〜1の小数（grooveToEditorStateで×100）
    });
  } else {
    binaryPatternToEditorState(pat);
  }

  // 全selectを同期
  ['rhythm-select', 'rhythm-select-settings', 'reditor-preset-sel'].forEach(selId => {
    const sel = document.getElementById(selId);
    if (sel && Array.from(sel.options).some(o => o.value === name)) {
      sel.value = name;
    }
  });

  // pianorollを再描画
  if (prCanvas) reditorRender();

  // 再生中かつ録音中でない場合は Transport ごと再起動してパターンを即座に切り替え。
  // 録音中は Transport を止めずに、鳴っているシーケンスだけを差し替える。
  if (!recState.active) {
    applyEditorPatternRT();
  } else {
    RHYTHM_PATTERNS['user__editor'] = editorToPattern();
    if (state.isPlaying) swapRhythmPatternLive(RHYTHM_PATTERNS['user__editor']);
  }
}

function loadPresetIntoEditor() {
  const sel = document.getElementById('reditor-preset-sel');
  const name = sel ? sel.value : '';
  loadPatternByName(name);
}

function editorToPattern() {
  return {
    groove_kick:  editorState.kick.map(e=>({...e})),
    groove_snare: editorState.snare.map(e=>({...e})),
    groove_hat:   editorState.hat.map(e=>({...e})),
    groove_hiop:  editorState.hiop.map(e=>({...e})),
    groove_rim:   editorState.rim.map(e=>({...e})),
    groove_cowbl: editorState.cowbl.map(e=>({...e})),
    groove_clap:  editorState.clap.map(e=>({...e})),
    groove_tamb:  editorState.tamb.map(e=>({...e})),
    groove_shkr:  editorState.shkr.map(e=>({...e})),
    swing: editorState.swing/100,
    beats: 4,
    pattern: Array.from({length:16},(_,i)=>{
      if(hasEvent('kick',i)) return 1;
      const se=getEvent('snare',i);
      if(se) return se.ghost?3:2;
      return 0;
    }),
    hats:  Array.from({length:16},(_,i)=>hasEvent('hat',i)?1:0),
    hiop:  Array.from({length:16},(_,i)=>hasEvent('hiop',i)?1:0),
    rim:   Array.from({length:16},(_,i)=>hasEvent('rim',i)?1:0),
    cowbl: Array.from({length:16},(_,i)=>hasEvent('cowbl',i)?1:0),
    clap:  Array.from({length:16},(_,i)=>hasEvent('clap',i)?1:0),
    tamb:  Array.from({length:16},(_,i)=>hasEvent('tamb',i)?1:0),
    shkr:  Array.from({length:16},(_,i)=>hasEvent('shkr',i)?1:0),
  };
}

// ── トグル ───────────────────────────────────────────────────────────────────
