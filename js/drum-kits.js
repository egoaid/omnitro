const KIT_EDIT_CHANNELS = ['kick','snare','hat','hiop','rim','cowbl','clap','tamb','shkr'];

// ── パラメータ定義テーブル ─────────────────────────────────────────────────────
// 各パラメータ: { key, label, min, max, step, default(ch), fmt, unit }
// fmt: 表示フォーマット関数 (v => string)
const KIT_PARAM_DEFS = [
  // ─ 基本 ──────────────────────────────────────────────────────────────────
  { key:'level',      label:'LEVEL',      min:0,    max:200,  step:1,   fmt:v=>v+'%',        unit:'%'   },
  { key:'tune',       label:'TUNE',       min:-24,  max:24,   step:1,   fmt:v=>(v>0?'+':'')+v+'st', unit:'st' },
  { key:'pan',        label:'PAN',        min:-100, max:100,  step:1,   fmt:v=>v===0?'C':v>0?'R'+v:'L'+(-v), unit:'' },
  // ─ エンベロープ ──────────────────────────────────────────────────────────
  { key:'attack',     label:'ATTACK',     min:0,    max:50,   step:1,   fmt:v=>v+'ms',       unit:'ms'  },
  { key:'decay',      label:'DECAY',      min:20,   max:500,  step:5,   fmt:v=>v+'ms',       unit:'ms'  },
  { key:'transient',  label:'TRANSIENT',  min:0,    max:100,  step:1,   fmt:v=>v+'%',        unit:'%'   },
  // ─ クラップ専用: 3山エンベロープ制御 ──────────────────────────────────────
  // (clap チャンネルのみ有効。他チャンネルでは無視される)
  { key:'clap_spread',label:'SPREAD',     min:3,    max:20,   step:1,   fmt:v=>v+'ms',       unit:'ms', clapOnly:true },
  { key:'clap_tail',  label:'TAIL',       min:5,    max:100,  step:5,   fmt:v=>v+'%',        unit:'%',  clapOnly:true },
  { key:'clap_peaks', label:'PEAKS',      min:2,    max:5,    step:1,   fmt:v=>v,            unit:'',   clapOnly:true },
  // ─ フィルター ─────────────────────────────────────────────────────────────
  { key:'lpf',        label:'LPF CUT',    min:200,  max:20000,step:100, fmt:v=>v>=1000?(v/1000).toFixed(1)+'k':v+'Hz', unit:'Hz' },
  { key:'lpfQ',       label:'BP RES',     min:0,    max:200,  step:5,   fmt:v=>(v/10).toFixed(1), unit:'' },
  { key:'hpf',        label:'HPF CUT',    min:20,   max:4000, step:20,  fmt:v=>v+'Hz',       unit:'Hz'  },
  // ─ キャラクター ──────────────────────────────────────────────────────────
  { key:'drive',      label:'DRIVE',      min:0,    max:100,  step:1,   fmt:v=>v+'%',        unit:'%'   },
  { key:'room',       label:'ROOM',       min:0,    max:100,  step:1,   fmt:v=>v+'%',        unit:'%'   },
  { key:'pitch_env',  label:'PTCH ENV',   min:-24,  max:24,   step:1,   fmt:v=>(v>0?'+':'')+v+'st', unit:'st' },
];

// チャンネルごとのデフォルト値（楽器特性に合わせて個別設定）
const KIT_EDIT_DEFAULTS = {
  kick:  { level:100, tune:0, pan:0, attack:2,  decay:280, transient:60, lpf:3000,  lpfQ:5,  hpf:40,   drive:15, room:8,  pitch_env:-8,
           clap_spread:7, clap_tail:30, clap_peaks:3 },
  snare: { level:100, tune:0, pan:0, attack:1,  decay:160, transient:70, lpf:8000,  lpfQ:8,  hpf:120,  drive:10, room:12, pitch_env:0,
           clap_spread:7, clap_tail:30, clap_peaks:3 },
  hat:   { level:85,  tune:0, pan:0, attack:0,  decay:55,  transient:40, lpf:14000, lpfQ:5,  hpf:2000, drive:0,  room:0,  pitch_env:0,
           clap_spread:7, clap_tail:30, clap_peaks:3 },
  hiop:  { level:80,  tune:0, pan:0, attack:0,  decay:240, transient:30, lpf:12000, lpfQ:5,  hpf:1500, drive:0,  room:5,  pitch_env:0,
           clap_spread:7, clap_tail:30, clap_peaks:3 },
  rim:   { level:75,  tune:0, pan:0, attack:0,  decay:80,  transient:80, lpf:9000,  lpfQ:10, hpf:300,  drive:5,  room:3,  pitch_env:0,
           clap_spread:7, clap_tail:30, clap_peaks:3 },
  cowbl: { level:40,  tune:0, pan:0, attack:0,  decay:200, transient:90, lpf:6000,  lpfQ:15, hpf:400,  drive:20, room:0,  pitch_env:0,
           clap_spread:7, clap_tail:30, clap_peaks:3 },
  // ── CLAP: 記事仕様 ────────────────────────────────────────────────────────
  // BPF cutoff=1400Hz (lpf=2200/hpf=800 でBPF近似), Res=30%(lpfQ=30),
  // Drive=80%(最大寄り), Room=20%(少し残響), Tail=35%, Spread=7ms, Peaks=3
  clap:  { level:90,  tune:0, pan:0, attack:0,  decay:190, transient:40, lpf:2200,  lpfQ:30, hpf:800,  drive:80, room:20, pitch_env:0,
           clap_spread:7, clap_tail:35, clap_peaks:3 },
  tamb:  { level:90,  tune:0, pan:0, attack:0,  decay:500, transient:50, lpf:10000, lpfQ:8,  hpf:400,  drive:8,  room:10, pitch_env:0,
           clap_spread:7, clap_tail:30, clap_peaks:3 },
  shkr:  { level:80,  tune:0, pan:0, attack:0,  decay:300, transient:50, lpf:12000, lpfQ:8,  hpf:600,  drive:8,  room:8,  pitch_env:0,
           clap_spread:7, clap_tail:30, clap_peaks:3 },
};

// 実行時パラメータ（UIで変更される）
const kitEditParams = JSON.parse(JSON.stringify(KIT_EDIT_DEFAULTS));

// 共通プレイバック（initDrums外でも使えるように上位スコープに）
let _drumPlayBuf = null;

// ── キット別デフォルトパラメータ上書きテーブル ────────────────────────────────
// initDrums() でキットを切り替えた際に kitEditParams をリセットして適用する。
// 指定しないキーは KIT_EDIT_DEFAULTS の値が使われる。
const KIT_PARAM_OVERRIDES = {
  // ── 808: ディープなサブキック、カウベル強め、タンバリン明るく ────────────
  '808': {
    tamb:  { level:85, tune:0, pan:0, attack:0, decay:450, transient:50, lpf:11000, lpfQ:7, hpf:350, drive:6, room:8, pitch_env:0, clap_spread:7, clap_tail:30, clap_peaks:3 },
    shkr:  { level:70, tune:0, pan:0, attack:0, decay:280, transient:45, lpf:13000, lpfQ:6, hpf:700, drive:5, room:5, pitch_env:0, clap_spread:7, clap_tail:30, clap_peaks:3 },
    clap:  { level:88, tune:0, pan:0, attack:0, decay:180, transient:42, lpf:2400, lpfQ:28, hpf:850, drive:78, room:18, pitch_env:0, clap_spread:7, clap_tail:35, clap_peaks:3 },
  },
  // ── 909: クリスプなハット、パンチキック、クラップ強め ──────────────────────
  '909': {
    tamb:  { level:82, tune:0, pan:0, attack:0, decay:380, transient:55, lpf:12000, lpfQ:6, hpf:400, drive:8, room:6, pitch_env:0, clap_spread:7, clap_tail:30, clap_peaks:3 },
    shkr:  { level:68, tune:0, pan:0, attack:0, decay:250, transient:48, lpf:14000, lpfQ:5, hpf:800, drive:4, room:4, pitch_env:0, clap_spread:7, clap_tail:30, clap_peaks:3 },
    clap:  { level:92, tune:0, pan:0, attack:0, decay:160, transient:65, lpf:3200, lpfQ:22, hpf:750, drive:85, room:15, pitch_env:0, clap_spread:6, clap_tail:30, clap_peaks:3 },
  },
  // ── LM-1: ヴィンテージ感、タンバリン中域強め ─────────────────────────────
  'lm1': {
    tamb:  { level:80, tune:0, pan:0, attack:0, decay:400, transient:48, lpf:10500, lpfQ:8, hpf:380, drive:10, room:10, pitch_env:0, clap_spread:7, clap_tail:30, clap_peaks:3 },
    shkr:  { level:65, tune:0, pan:0, attack:0, decay:260, transient:42, lpf:11000, lpfQ:7, hpf:650, drive:8, room:8, pitch_env:0, clap_spread:7, clap_tail:30, clap_peaks:3 },
    clap:  { level:85, tune:0, pan:0, attack:0, decay:200, transient:38, lpf:2000, lpfQ:32, hpf:820, drive:75, room:22, pitch_env:0, clap_spread:8, clap_tail:38, clap_peaks:3 },
  },
  // ── LOFI: 曇り・暗め・長い余韻 ───────────────────────────────────────────
  'lofi': {
    tamb:  { level:78, tune:0, pan:0, attack:0, decay:550, transient:40, lpf:8000, lpfQ:9, hpf:300, drive:12, room:18, pitch_env:0, clap_spread:7, clap_tail:30, clap_peaks:3 },
    shkr:  { level:62, tune:0, pan:0, attack:0, decay:320, transient:35, lpf:9000, lpfQ:8, hpf:550, drive:10, room:15, pitch_env:0, clap_spread:7, clap_tail:30, clap_peaks:3 },
    clap:  { level:80, tune:0, pan:0, attack:0, decay:210, transient:30, lpf:1800, lpfQ:35, hpf:750, drive:70, room:28, pitch_env:0, clap_spread:9, clap_tail:42, clap_peaks:3 },
  },
  // ── TAPE: くぐもり・テール長め ──────────────────────────────────────────
  'tape': {
    tamb:  { level:75, tune:0, pan:0, attack:0, decay:600, transient:38, lpf:7500, lpfQ:10, hpf:280, drive:14, room:20, pitch_env:0, clap_spread:7, clap_tail:30, clap_peaks:3 },
    shkr:  { level:60, tune:0, pan:0, attack:0, decay:350, transient:32, lpf:8500, lpfQ:9, hpf:500, drive:12, room:18, pitch_env:0, clap_spread:7, clap_tail:30, clap_peaks:3 },
    clap:  { level:78, tune:0, pan:0, attack:0, decay:225, transient:28, lpf:1600, lpfQ:38, hpf:700, drive:65, room:32, pitch_env:0, clap_spread:10, clap_tail:45, clap_peaks:3 },
  },
  // ── JAZZ: 温かく自然な余韻 ───────────────────────────────────────────────
  'jazz': {
    tamb:  { level:82, tune:0, pan:0, attack:0, decay:520, transient:44, lpf:9500, lpfQ:7, hpf:320, drive:7, room:22, pitch_env:0, clap_spread:7, clap_tail:30, clap_peaks:3 },
    shkr:  { level:66, tune:0, pan:0, attack:0, decay:300, transient:38, lpf:10500, lpfQ:6, hpf:600, drive:5, room:18, pitch_env:0, clap_spread:7, clap_tail:30, clap_peaks:3 },
    clap:  { level:82, tune:0, pan:0, attack:0, decay:195, transient:35, lpf:2000, lpfQ:30, hpf:780, drive:72, room:25, pitch_env:0, clap_spread:8, clap_tail:40, clap_peaks:3 },
  },
  // ── VINYL: ビット荒れ・高域削れ ─────────────────────────────────────────
  'vinyl': {
    tamb:  { level:76, tune:0, pan:0, attack:0, decay:480, transient:42, lpf:8500, lpfQ:9, hpf:340, drive:15, room:14, pitch_env:0, clap_spread:7, clap_tail:30, clap_peaks:3 },
    shkr:  { level:62, tune:0, pan:0, attack:0, decay:290, transient:36, lpf:9500, lpfQ:8, hpf:620, drive:12, room:12, pitch_env:0, clap_spread:7, clap_tail:30, clap_peaks:3 },
    clap:  { level:82, tune:0, pan:0, attack:0, decay:205, transient:33, lpf:1900, lpfQ:33, hpf:810, drive:72, room:24, pitch_env:0, clap_spread:9, clap_tail:40, clap_peaks:3 },
  },
  // ── MINIMAL: 乾いて短い ──────────────────────────────────────────────────
  'minimal': {
    tamb:  { level:80, tune:0, pan:0, attack:0, decay:300, transient:58, lpf:11000, lpfQ:6, hpf:420, drive:5, room:4, pitch_env:0, clap_spread:7, clap_tail:30, clap_peaks:3 },
    shkr:  { level:65, tune:0, pan:0, attack:0, decay:200, transient:52, lpf:13000, lpfQ:5, hpf:750, drive:3, room:3, pitch_env:0, clap_spread:7, clap_tail:30, clap_peaks:3 },
    clap:  { level:85, tune:0, pan:0, attack:0, decay:145, transient:68, lpf:2600, lpfQ:20, hpf:800, drive:88, room:10, pitch_env:0, clap_spread:5, clap_tail:28, clap_peaks:3 },
  },
  acoustic: {
    kick:  { level:105, tune:0, pan:0, attack:3,  decay:320, transient:45, lpf:4500,  lpfQ:4,  hpf:30,   drive:8,  room:22, pitch_env:-6,  clap_spread:7, clap_tail:30, clap_peaks:3 },
    snare: { level:100, tune:0, pan:0, attack:2,  decay:200, transient:60, lpf:6500,  lpfQ:6,  hpf:150,  drive:5,  room:18, pitch_env:0,   clap_spread:7, clap_tail:30, clap_peaks:3 },
    hat:   { level:80,  tune:0, pan:0, attack:0,  decay:70,  transient:35, lpf:12000, lpfQ:3,  hpf:2000, drive:0,  room:4,  pitch_env:0,   clap_spread:7, clap_tail:30, clap_peaks:3 },
    hiop:  { level:75,  tune:0, pan:0, attack:0,  decay:300, transient:25, lpf:10000, lpfQ:3,  hpf:1500, drive:0,  room:8,  pitch_env:0,   clap_spread:7, clap_tail:30, clap_peaks:3 },
    rim:   { level:70,  tune:0, pan:0, attack:0,  decay:90,  transient:75, lpf:7000,  lpfQ:8,  hpf:220,  drive:3,  room:6,  pitch_env:0,   clap_spread:7, clap_tail:30, clap_peaks:3 },
    cowbl: { level:30,  tune:0, pan:0, attack:0,  decay:180, transient:85, lpf:5000,  lpfQ:12, hpf:400,  drive:15, room:0,  pitch_env:0,   clap_spread:7, clap_tail:30, clap_peaks:3 },
    clap:  { level:85,  tune:0, pan:0, attack:0,  decay:160, transient:30, lpf:4000,  lpfQ:12, hpf:400,  drive:15, room:25, pitch_env:0,   clap_spread:8, clap_tail:40, clap_peaks:3 },
    tamb:  { level:90,  tune:0, pan:0, attack:0,  decay:500, transient:40, lpf:12000, lpfQ:5,  hpf:350,  drive:5,  room:15, pitch_env:0,   clap_spread:7, clap_tail:30, clap_peaks:3 },
    shkr:  { level:80,  tune:0, pan:0, attack:0,  decay:300, transient:40, lpf:12000, lpfQ:5,  hpf:600,  drive:5,  room:8,  pitch_env:0,   clap_spread:7, clap_tail:30, clap_peaks:3 },
  },
};

function initDrums(kitName) {
  const ctx = Tone.getContext().rawContext;
  kitName = kitName || currentDrumKit;

  // キット別デフォルトパラメータを適用
  if (KIT_PARAM_OVERRIDES[kitName]) {
    const overrides = KIT_PARAM_OVERRIDES[kitName];
    KIT_EDIT_CHANNELS.forEach(ch => {
      kitEditParams[ch] = { ...KIT_EDIT_DEFAULTS[ch], ...(overrides[ch] || {}) };
    });
  } else {
    // factory/user デフォルトに戻す
    KIT_EDIT_CHANNELS.forEach(ch => {
      kitEditParams[ch] = { ...KIT_EDIT_DEFAULTS[ch] };
    });
  }

  // キットバッファが未生成なら生成
  if (!drumKitBuffers[kitName]) {
    drumKitBuffers[kitName] = buildDrumKit(ctx, kitName);
  }
  const kit = drumKitBuffers[kitName];

  // ── 完全パラメトリック プレイバック ──────────────────────────────────────
  // チェーン: src → transientGain → attackGain → LPF → HPF → drive → room → panner → drumGain
  _drumPlayBuf = function(buf, gainVal, time, ch) {
    if (!buf) return;
    const p = kitEditParams[ch] || KIT_EDIT_DEFAULTS[ch] || {};

    // ── TAMB専用: DECAYスライダー値でMS-20エンベロープを再合成 ───────────
    // TAMBバッファはS&H・リングモジュレーター・フィルターが焼き込み済みのため
    // playbackRateを変えるとピッチが変わってしまう。
    // そこでDECAYスライダーに連動してGainエンベロープをバッファに直接焼き込み、
    // playbackRateは常に1.0固定とする。
    let activeBuf = buf;
    if ((ch === 'tamb' || ch === 'shkr') && buf) {
      const decayMs  = Math.max(50, p.decay ?? 500);
      const decayK   = 1 / (decayMs / 1000);  // 時定数
      const newDur   = Math.max(0.3, (decayMs / 1000) * 4.0); // 十分な長さ
      const srcData  = buf.getChannelData(0);
      const newLen   = Math.floor(ctx.sampleRate * newDur);
      const tData    = new Float32Array(newLen);
      for (let i = 0; i < newLen; i++) {
        const t   = i / ctx.sampleRate;
        const env = Math.exp(-t * decayK);
        // 元バッファをループなしで使う（足りない部分は無音）
        tData[i]  = (i < srcData.length ? srcData[i] : 0) * env;
      }
      // ピーク正規化
      let pk = 0;
      for (const v of tData) if (Math.abs(v) > pk) pk = Math.abs(v);
      if (pk > 0.001) { const g = 0.92 / pk; for (let i = 0; i < newLen; i++) tData[i] *= g; }
      activeBuf = ctx.createBuffer(1, newLen, ctx.sampleRate);
      activeBuf.copyToChannel(tData, 0);
    }

    // ── CLAP専用: 3山エンベロープを現在のパラメータでリアルタイム合成 ──────
    // clap_spread / clap_peaks / clap_tail が変わるたびに正しい波形を生成
    if (ch === 'clap') {
      const spread = Math.max(3, p.clap_spread ?? 7);   // ms
      const nPeaks = Math.max(2, Math.min(5, Math.round(p.clap_peaks ?? 3)));
      const tailPct = (p.clap_tail ?? 35) / 100;
      const totalDur = (nPeaks * spread / 1000) + 0.22;
      const cLen = Math.floor(ctx.sampleRate * totalDur);

      // 元バッファからノイズ素材を再利用（再生成より高速）
      // 元バッファが十分長ければそのデータを使い、短ければ延長
      const srcData = buf.getChannelData(0);
      const cData   = new Float32Array(cLen);
      for (let i = 0; i < cLen; i++) {
        cData[i] = i < srcData.length ? srcData[i] : (Math.random()*2-1);
      }

      // 3〜5山エンベロープ
      const env = new Float32Array(cLen);
      const atkK  = 1200;
      const decKs = [180, 160, 140, 130, 120]; // 後の山ほどやや長め
      for (let pi = 0; pi < nPeaks; pi++) {
        const startSec = (pi * spread) / 1000;
        const amp = 1.0 - pi * 0.18; // 後の山ほど少し小さい
        for (let i = Math.floor(startSec * ctx.sampleRate); i < cLen; i++) {
          const dt = (i / ctx.sampleRate) - startSec;
          env[i] += (1 - Math.exp(-atkK * dt)) * Math.exp(-decKs[pi] * dt) * amp;
        }
      }
      // テール
      const tailStart = (nPeaks * spread / 1000) + 0.003;
      const tailDecK  = 6 + (1 - tailPct) * 14; // tail=100%→decK=6(長), tail=0%→decK=20(短)
      for (let i = 0; i < cLen; i++) {
        const t = i / ctx.sampleRate;
        if (t >= tailStart) env[i] += Math.exp(-tailDecK * (t - tailStart)) * tailPct * 0.50;
      }

      for (let i = 0; i < cLen; i++) cData[i] *= env[i];

      // ピーク正規化
      let pk = 0; for (const v of cData) if (Math.abs(v) > pk) pk = Math.abs(v);
      if (pk > 0.001) { const g = 0.85/pk; for (let i=0;i<cLen;i++) cData[i]*=g; }

      activeBuf = ctx.createBuffer(1, cLen, ctx.sampleRate);
      activeBuf.copyToChannel(cData, 0);
    }

    // ── 基本パラメータ ─────────────────────────────────────────────────────
    const lvl      = gainVal * ((p.level ?? 100) / 100);
    const tune     = p.tune  ?? 0;
    const pitchEnv = p.pitch_env ?? 0;
    const attackMs = Math.max(0, p.attack ?? 1);
    const decayMs  = Math.max(20, p.decay  ?? 200);
    const panVal   = (p.pan ?? 0) / 100;

    // tune: playbackRate で半音単位ピッチ変更（decayとは独立）
    const rate = Math.pow(2, tune / 12);

    // ── ソース ────────────────────────────────────────────────────────────
    const src = ctx.createBufferSource();
    src.buffer = activeBuf;  // clapは再合成済みバッファ、他はそのまま
    src.playbackRate.value = Math.max(0.1, Math.min(4.0, rate));

    // ── ピッチエンベロープ（キックの「ドゥン↓」など） ──────────────────────
    // tambはS&H/フィルター合成済みバッファなのでpitch_env/tuneを無効化
    if (Math.abs(pitchEnv) > 0.5 && ch !== 'tamb' && ch !== 'shkr') {
      const startRate = rate * Math.pow(2, pitchEnv / 12);
      src.playbackRate.setValueAtTime(Math.max(0.1, startRate), time);
      src.playbackRate.exponentialRampToValueAtTime(
        Math.max(0.1, rate), time + Math.max(0.001, decayMs * 0.001 * 0.6));
    }

    // ── デケイエンベロープ（独立したGainカーブ） ────────────────────────────
    // attack: 0〜attackMs でランプアップ（トランジェントの前のソフト立ち上がり）
    // decay:  attackMs以降から decayMs で指数減衰
    const envGain = ctx.createGain();
    const atk = Math.max(0.0005, attackMs / 1000);
    const dec = Math.max(0.005,  decayMs  / 1000);
    envGain.gain.setValueAtTime(0.0001, time);
    envGain.gain.linearRampToValueAtTime(lvl, time + atk);
    envGain.gain.exponentialRampToValueAtTime(0.0001, time + atk + dec);

    // ── トランジェント（アタック感: 短いゲインスパイク） ───────────────────
    // transient: 0=なし, 100=最大。元のlvlの上に+80%のスパイクを乗せる
    const transAmt = (p.transient ?? 0) / 100;
    if (transAmt > 0.01) {
      const transSpike = lvl * (1 + transAmt * 1.8);
      envGain.gain.cancelScheduledValues(time);
      envGain.gain.setValueAtTime(0.0001, time);
      envGain.gain.linearRampToValueAtTime(transSpike, time + Math.min(atk * 0.25, 0.003));
      envGain.gain.exponentialRampToValueAtTime(lvl, time + atk);
      envGain.gain.exponentialRampToValueAtTime(0.0001, time + atk + dec);
    }

    // ── LPF ─────────────────────────────────────────────────────────────────
    let lastNode = envGain;
    const lpfFreq = Math.max(200, Math.min(20000, p.lpf ?? 20000));
    const lpfQ    = (p.lpfQ ?? 5) / 10;
    if (lpfFreq < 19000) {
      const lpf = ctx.createBiquadFilter();
      lpf.type = 'lowpass';
      lpf.frequency.value = lpfFreq;
      lpf.Q.value = lpfQ;
      lastNode.connect(lpf);
      lastNode = lpf;
    }

    // ── HPF ─────────────────────────────────────────────────────────────────
    const hpfFreq = Math.max(20, Math.min(2000, p.hpf ?? 20));
    if (hpfFreq > 25) {
      const hpf = ctx.createBiquadFilter();
      hpf.type = 'highpass';
      hpf.frequency.value = hpfFreq;
      hpf.Q.value = 0.5;
      lastNode.connect(hpf);
      lastNode = hpf;
    }

    // ── DRIVE（ソフトサチュレーション） ──────────────────────────────────────
    const driveAmt = (p.drive ?? 0) / 100;
    if (driveAmt > 0.01) {
      const shaper = ctx.createWaveShaper();
      const k = driveAmt * 12;
      const curve = new Float32Array(256);
      for (let i = 0; i < 256; i++) {
        const x = i * 2 / 255 - 1;
        curve[i] = ((1 + k) * x) / (1 + k * Math.abs(x));
      }
      shaper.curve = curve;
      shaper.oversample = '2x';
      // ドライブ後のゲイン補正
      const driveComp = ctx.createGain();
      driveComp.gain.value = 1.0 / (1 + driveAmt * 0.5);
      lastNode.connect(shaper);
      shaper.connect(driveComp);
      lastNode = driveComp;
    }

    // ── ROOM（軽量コンボリューションリバーブ） ────────────────────────────────
    const roomAmt = (p.room ?? 0) / 100;
    if (roomAmt > 0.01) {
      // ルームIR: 短いランダムノイズ (10〜80ms)
      const roomMs  = 10 + roomAmt * 70;
      const roomLen = Math.floor(ctx.sampleRate * roomMs / 1000);
      const ir      = ctx.createBuffer(1, roomLen, ctx.sampleRate);
      const irData  = ir.getChannelData(0);
      for (let i = 0; i < roomLen; i++) {
        irData[i] = (Math.random() * 2 - 1) * Math.exp(-i / (roomLen * 0.4));
      }
      const conv   = ctx.createConvolver(); conv.normalize = true; conv.buffer = ir;
      const dryG   = ctx.createGain(); dryG.gain.value  = 1.0 - roomAmt * 0.4;
      const wetG   = ctx.createGain(); wetG.gain.value  = roomAmt * 0.4;
      const roomOut = ctx.createGain(); roomOut.gain.value = 1.0;
      lastNode.connect(dryG);
      lastNode.connect(conv);
      conv.connect(wetG);
      dryG.connect(roomOut);
      wetG.connect(roomOut);
      lastNode = roomOut;
    }

    // ── PAN ─────────────────────────────────────────────────────────────────
    let finalDest = drumGain;
    const nodes = [envGain];
    if (Math.abs(panVal) > 0.01) {
      const panner = ctx.createStereoPanner();
      panner.pan.value = Math.max(-1, Math.min(1, panVal));
      lastNode.connect(panner);
      panner.connect(drumGain);
      src.connect(envGain);
      src.start(time);
      src.onended = () => { try { panner.disconnect(); } catch(e){} };
    } else {
      lastNode.connect(drumGain);
      src.connect(envGain);
      src.start(time);
    }
    // envGain は自然に消音するのでdisconnectはGCに任せる
  };
  const playBuf = _drumPlayBuf;

  kickSynth  = { trigger(t, v=0.85) { playBuf(kit.kick,  v, t||ctx.currentTime, 'kick');  }, triggerAttackRelease(n,d,t){ this.trigger(t); } };
  snareSynth = { trigger(t, v=0.80) { playBuf(kit.snare, v, t||ctx.currentTime, 'snare'); }, triggerAttackRelease(d,t,vel){ this.trigger(t, vel||0.8); } };
  hatSynth   = { trigger(t, v=0.55) { playBuf(kit.hat,   v, t||ctx.currentTime, 'hat');   }, triggerAttackRelease(d,t){ this.trigger(t); } };
  hiopSynth  = kit.hiop  ? { trigger(t, v=0.60){ playBuf(kit.hiop,  v, t||ctx.currentTime, 'hiop');  } } : null;
  rimSynth   = kit.rim   ? { trigger(t, v=0.65){ playBuf(kit.rim,   v, t||ctx.currentTime, 'rim');   } } : null;
  cowblSynth = kit.cowbl ? { trigger(t, v=0.60){ playBuf(kit.cowbl, v, t||ctx.currentTime, 'cowbl'); } } : null;
  clapSynth  = kit.clap  ? { trigger(t, v=0.75){ playBuf(kit.clap,  v, t||ctx.currentTime, 'clap');  } } : null;
  tambSynth  = { trigger: makeTambTrigger(ctx) };
  shkrSynth  = kit.shkr  ? { trigger(t, v=0.65){ playBuf(kit.shkr,  v, t||ctx.currentTime, 'shkr');  } } : null;

  currentDrumKit = kitName;

  // KIT select のUI同期（settings + rhythm editor）
  ['kit-select-settings','kit-select-reditor','kit-select-editor'].forEach(selId => {
    const el = document.getElementById(selId);
    if (el) el.value = kitName;
  });
  // kit-editor の kitname 表示更新
  const kitNameEl = document.getElementById('kit-editor-kitname');
  if (kitNameEl) kitNameEl.textContent = kitName.toUpperCase();
}

// ── キット別バッファ生成 ────────────────────────────────────────────────────
function buildDrumKit(ctx, kitName) {
  switch(kitName) {
    case '808':     return build808Kit(ctx);
    case '909':     return build909Kit(ctx);
    case 'lofi':    return buildLofiKit(ctx);
    case 'tape':    return buildTapeKit(ctx);
    case 'jazz':    return buildJazzKit(ctx);
    case 'vinyl':   return buildVinylKit(ctx);
    case 'minimal':  return buildMinimalKit(ctx);
    case 'acoustic': return buildAcousticKit(ctx);
    default:         return buildLm1Kit(ctx);
  }
}

// ── LM-1 KIT（現行） ─────────────────────────────────────────────────────────
function buildLm1Kit(ctx) {
  const kick = makeLm1Buffer(ctx, 0.38, (data, sr) => {
    let phase = 0;
    for (let i = 0; i < data.length; i++) {
      const t = i / sr;
      const freq = 42 + 23 * Math.exp(-t * 38);
      phase += (2 * Math.PI * freq) / sr;
      const body  = Math.sin(phase);
      const click = (Math.random() * 2 - 1) * Math.exp(-t * 280) * 0.35;
      const h2    = Math.sin(phase * 2) * 0.08 * Math.exp(-t * 60);
      const env   = Math.exp(-t * 7.5);
      data[i] = (body + h2) * env + click;
    }
  });

  const snare = makeLm1Buffer(ctx, 0.18, (data, sr) => {
    let lfsr = 0xACE1;
    for (let i = 0; i < data.length; i++) {
      const t   = i / sr;
      const bit = ((lfsr>>0)^(lfsr>>2)^(lfsr>>3)^(lfsr>>5))&1;
      lfsr      = ((lfsr>>1)|(bit<<15))&0xFFFF;
      const noise    = (lfsr/0xFFFF)*2-1;
      const tone1    = Math.sin(2*Math.PI*270*t)*Math.exp(-t*55);
      const tone2    = Math.sin(2*Math.PI*180*t)*Math.exp(-t*35)*0.5;
      const noiseEnv = Math.exp(-t*28);
      data[i] = noise*noiseEnv*0.65 + tone1*0.28 + tone2*0.12;
    }
  });

  const hat = makeLm1Buffer(ctx, 0.062, (data, sr) => {
    const partials = [
      {freq:3200,amp:0.30},{freq:4050,amp:0.25},{freq:5400,amp:0.20},
      {freq:6800,amp:0.14},{freq:8300,amp:0.10},{freq:10200,amp:0.06},
    ];
    const phases = partials.map(()=>Math.random()*2*Math.PI);
    for (let i = 0; i < data.length; i++) {
      const t=i/sr, env=Math.exp(-t*55); let s=0;
      for (let k=0;k<partials.length;k++) {
        phases[k]+=(2*Math.PI*partials[k].freq)/sr;
        s+=Math.sin(phases[k])*partials[k].amp;
      }
      data[i]=s*env;
    }
  });

  return { kick, snare, hat,
    hiop:  buildHiop(ctx, 'lm1'),
    rim:   buildRim(ctx, 'lm1'),
    cowbl: buildCowbell(ctx),
    clap:  buildClap(ctx, 'lm1'),
    tamb:  buildTamb(ctx, 'lm1'),
    shkr:  buildShkr(ctx,'lm1'),
  };
}

// ── LOFI KIT ─────────────────────────────────────────────────────────────────
// 曇ったキック: クリックなし、低域重視(38Hz中心)、長いテール、強めLPF
// リムショット: スネアの代わり。木質な打音 + 短いノイズ
// 曇ったスネア: ノイズが少なく胴鳴りが主体、LPFで高域をカット
function buildLofiKit(ctx) {
  const sr = ctx.sampleRate;

  // ── KICK: 曇り系 ─────────────────────────────────────────────────────────
  // 低域重視(38Hz)、クリックなし、ゆっくりした減衰、LPFで丸め
  const kickLen = Math.floor(sr * 0.45);
  const kickData = new Float32Array(kickLen);
  let phase = 0;
  for (let i = 0; i < kickLen; i++) {
    const t    = i / sr;
    const freq = 36 + 18 * Math.exp(-t * 22);  // 54Hz→36Hz、緩やかに降下
    phase += (2 * Math.PI * freq) / sr;
    const env  = Math.exp(-t * 5.5);            // 長めのテール
    const body = Math.sin(phase) * 0.95;
    const sub  = Math.sin(phase * 0.5) * 0.12 * env; // オクターブ下のサブ
    kickData[i] = (body + sub) * env;
  }
  // LPFで曇らせる（~600Hz）
  { const alpha = 1/(1+sr/(2*Math.PI*600)); let prev=0;
    for(let i=0;i<kickLen;i++){prev=prev+alpha*(kickData[i]-prev);kickData[i]=prev;} }
  const kickBuf = ctx.createBuffer(1, kickLen, sr);
  kickBuf.copyToChannel(kickData, 0);

  // ── RIMSHOT: 木質・曇り ───────────────────────────────────────────────────
  // 短いアタックトーン(250Hz木管感) + 薄いノイズ + LPF
  const rimLen = Math.floor(sr * 0.12);
  const rimData = new Float32Array(rimLen);
  let lfsr2 = 0xBEEF;
  for (let i = 0; i < rimLen; i++) {
    const t    = i / sr;
    const tone = Math.sin(2*Math.PI*320*t) * Math.exp(-t*80) * 0.7;
    const tone2 = Math.sin(2*Math.PI*640*t) * Math.exp(-t*140) * 0.3;
    const bit  = ((lfsr2>>0)^(lfsr2>>3)^(lfsr2>>5)^(lfsr2>>7))&1;
    lfsr2      = ((lfsr2>>1)|(bit<<15))&0xFFFF;
    const noise = ((lfsr2/0xFFFF)*2-1) * Math.exp(-t*60) * 0.2;
    rimData[i] = tone + tone2 + noise;
  }
  { const alpha = 1/(1+sr/(2*Math.PI*3000)); let prev=0;
    for(let i=0;i<rimLen;i++){prev=prev+alpha*(rimData[i]-prev);rimData[i]=prev;} }
  const snareBuf = ctx.createBuffer(1, rimLen, sr);
  snareBuf.copyToChannel(rimData, 0);

  // ── HAT: 曇り・短め ──────────────────────────────────────────────────────
  // 高域成分を絞ってソフトな質感
  const hatLen = Math.floor(sr * 0.07);
  const hatData = new Float32Array(hatLen);
  const lofiPartials = [
    {freq:2200,amp:0.35},{freq:3100,amp:0.28},{freq:4200,amp:0.20},
    {freq:5500,amp:0.12},{freq:7000,amp:0.05},
  ];
  const lPhases = lofiPartials.map(()=>Math.random()*2*Math.PI);
  for (let i = 0; i < hatLen; i++) {
    const t=i/sr, env=Math.exp(-t*40); let s=0;
    for(let k=0;k<lofiPartials.length;k++){
      lPhases[k]+=(2*Math.PI*lofiPartials[k].freq)/sr;
      s+=Math.sin(lPhases[k])*lofiPartials[k].amp;
    }
    hatData[i]=s*env;
  }
  { const alpha=1/(1+sr/(2*Math.PI*5000)); let prev=0;
    for(let i=0;i<hatLen;i++){prev=prev+alpha*(hatData[i]-prev);hatData[i]=prev;} }
  const hatBuf = ctx.createBuffer(1, hatLen, sr);
  hatBuf.copyToChannel(hatData, 0);

  return { kick: kickBuf, snare: snareBuf, hat: hatBuf,
    hiop:  buildHiop(ctx, 'lofi'),
    rim:   buildRim(ctx, 'lofi'),
    cowbl: buildCowbell(ctx),
    clap:  buildClap(ctx, 'lofi'),
    tamb:  buildTamb(ctx, 'lofi'),
    shkr:  buildShkr(ctx,'lofi'),
  };
}

// ── TAPE KIT ─────────────────────────────────────────────────────────────────
// テープ劣化: さらに低域よりのキック、くぐもったスネア、非常に短いハット
// μ-law + さらに強いLPFで「遠くで鳴っている」感
function buildTapeKit(ctx) {
  const sr = ctx.sampleRate;

  // ── KICK: テープ劣化 ──────────────────────────────────────────────────────
  const kickLen = Math.floor(sr * 0.55);
  const kickData = new Float32Array(kickLen);
  let ph = 0;
  for (let i = 0; i < kickLen; i++) {
    const t   = i / sr;
    const freq = 32 + 14 * Math.exp(-t*18);  // 46Hz→32Hz、非常に低い
    ph += (2*Math.PI*freq)/sr;
    const env  = Math.exp(-t*4.5);
    const body = Math.sin(ph);
    const sub  = Math.sin(ph*0.5)*0.18*env;
    kickData[i] = (body+sub)*env;
  }
  // LPFを非常に低く設定（~320Hz）→ 全体がくぐもる
  { const alpha=1/(1+sr/(2*Math.PI*320)); let prev=0;
    for(let i=0;i<kickLen;i++){prev=prev+alpha*(kickData[i]-prev);kickData[i]=prev;} }
  // μ-law量子化でテープ歪み
  applyMulaw8bit(kickData);
  const kickBuf = ctx.createBuffer(1, kickLen, sr);
  kickBuf.copyToChannel(kickData, 0);

  // ── SNARE: くぐもったスネア ────────────────────────────────────────────────
  // ノイズ少なめ、胴鳴り(150Hz)主体、強いLPFとμ-law
  const snLen = Math.floor(sr * 0.22);
  const snData = new Float32Array(snLen);
  let lfsr3 = 0xD0C1;
  for (let i = 0; i < snLen; i++) {
    const t    = i / sr;
    const bit  = ((lfsr3>>0)^(lfsr3>>2)^(lfsr3>>3)^(lfsr3>>5))&1;
    lfsr3      = ((lfsr3>>1)|(bit<<15))&0xFFFF;
    const noise  = ((lfsr3/0xFFFF)*2-1)*Math.exp(-t*18)*0.25;
    const tone1  = Math.sin(2*Math.PI*150*t)*Math.exp(-t*28)*0.55;
    const tone2  = Math.sin(2*Math.PI*95*t)*Math.exp(-t*20)*0.25;
    snData[i] = noise + tone1 + tone2;
  }
  { const alpha=1/(1+sr/(2*Math.PI*1800)); let prev=0;
    for(let i=0;i<snLen;i++){prev=prev+alpha*(snData[i]-prev);snData[i]=prev;} }
  applyMulaw8bit(snData);
  const snareBuf = ctx.createBuffer(1, snLen, sr);
  snareBuf.copyToChannel(snData, 0);

  // ── HAT: 非常に短く曇り ────────────────────────────────────────────────────
  const hatLen = Math.floor(sr * 0.045);
  const hatData = new Float32Array(hatLen);
  const tapePartials = [
    {freq:1800,amp:0.40},{freq:2600,amp:0.30},{freq:3800,amp:0.18},
    {freq:5000,amp:0.08},{freq:6500,amp:0.04},
  ];
  const tPhases = tapePartials.map(()=>Math.random()*2*Math.PI);
  for (let i = 0; i < hatLen; i++) {
    const t=i/sr, env=Math.exp(-t*50); let s=0;
    for(let k=0;k<tapePartials.length;k++){
      tPhases[k]+=(2*Math.PI*tapePartials[k].freq)/sr;
      s+=Math.sin(tPhases[k])*tapePartials[k].amp;
    }
    hatData[i]=s*env;
  }
  { const alpha=1/(1+sr/(2*Math.PI*3500)); let prev=0;
    for(let i=0;i<hatLen;i++){prev=prev+alpha*(hatData[i]-prev);hatData[i]=prev;} }
  applyMulaw8bit(hatData);
  const hatBuf = ctx.createBuffer(1, hatLen, sr);
  hatBuf.copyToChannel(hatData, 0);

  return { kick: kickBuf, snare: snareBuf, hat: hatBuf,
    hiop:  buildHiop(ctx, 'tape'),
    rim:   buildRim(ctx, 'tape'),
    cowbl: buildCowbell(ctx),
    clap:  buildClap(ctx, 'tape'),
    tamb:  buildTamb(ctx, 'tape'),
    shkr:  buildShkr(ctx,'tape'),
  };
}

// ─── ヘルパー: 生バッファ作成 ─────────────────────────────────────────────────
function makeBuf(ctx, len, fn) {
  const data = new Float32Array(len);
  fn(data, ctx.sampleRate, len);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  buf.copyToChannel(data, 0);
  return buf;
}
function lpf1p(data, cutHz, sr) {
  const a = 1/(1+sr/(2*Math.PI*cutHz)); let p=0;
  for(let i=0;i<data.length;i++){p=p+a*(data[i]-p);data[i]=p;}
}
function hpf1p(data, cutHz, sr) {
  const a = 1/(1+sr/(2*Math.PI*cutHz)); let p=0,px=0;
  for(let i=0;i<data.length;i++){const x=data[i];p=p*(1-a)+x-px;px=x;data[i]=p;}
}

// ── TR-808 KIT ────────────────────────────────────────────────────────────────
// 深いサブキック(55Hz)、長いリリース、特徴的なカウベル、長いオープンハット
function build808Kit(ctx) {
  const sr = ctx.sampleRate;

  // 808 KICK: 55Hz→28Hz、非常に長いテール(600ms)、クリック小さめ
  const kick = makeBuf(ctx, Math.floor(sr*0.62), (d,sr) => {
    let ph=0;
    for(let i=0;i<d.length;i++){
      const t=i/sr;
      const freq=28+27*Math.exp(-t*14);
      ph+=(2*Math.PI*freq)/sr;
      const click=(Math.random()*2-1)*Math.exp(-t*400)*0.12;
      d[i]=Math.sin(ph)*Math.exp(-t*4.2)+click;
    }
    lpf1p(d,900,sr);
  });

  // 808 SNARE: 200Hz胴鳴り主体、ノイズ控えめ、柔らかい
  const snare = makeBuf(ctx, Math.floor(sr*0.25), (d,sr) => {
    let lfsr=0xACE1;
    for(let i=0;i<d.length;i++){
      const t=i/sr;
      const bit=((lfsr>>0)^(lfsr>>2)^(lfsr>>3)^(lfsr>>5))&1;
      lfsr=((lfsr>>1)|(bit<<15))&0xFFFF;
      const noise=(lfsr/0xFFFF*2-1)*Math.exp(-t*22)*0.35;
      const tone=Math.sin(2*Math.PI*200*t)*Math.exp(-t*30)*0.55
               +Math.sin(2*Math.PI*320*t)*Math.exp(-t*45)*0.15;
      d[i]=noise+tone;
    }
    lpf1p(d,4500,sr);
  });

  // 808 HAT(closed): 非常に短くメタリック
  const hat = makeBuf(ctx, Math.floor(sr*0.05), (d,sr) => {
    const pp=[{f:4047,a:.28},{f:4353,a:.22},{f:5765,a:.18},{f:8013,a:.14},{f:9345,a:.10},{f:11012,a:.08}];
    const ph=pp.map(()=>Math.random()*2*Math.PI);
    for(let i=0;i<d.length;i++){
      const t=i/sr,env=Math.exp(-t*80);let s=0;
      pp.forEach((p,k)=>{ph[k]+=(2*Math.PI*p.f)/sr;s+=Math.sin(ph[k])*p.a;});
      d[i]=s*env;
    }
    lpf1p(d,12000,sr);
  });

  return { kick, snare, hat,
    hiop:  buildHiop(ctx,'lofi'),     // 808風の長いオープンハット
    rim:   buildRim(ctx,'lm1'),
    cowbl: buildCowbell(ctx),
    clap:  buildClap(ctx,'lm1'),
    tamb:  buildTamb(ctx,'808'),
    shkr:  buildShkr(ctx,'808'),
  };
}

// ── TR-909 KIT ────────────────────────────────────────────────────────────────
// パンチのあるキック(60Hz、クリック強め)、クラック系スネア、シャリっとハット
function build909Kit(ctx) {
  const sr = ctx.sampleRate;

  // 909 KICK: 60Hz→30Hz、クリック強め、中域も出る
  const kick = makeBuf(ctx, Math.floor(sr*0.45), (d,sr) => {
    let ph=0;
    for(let i=0;i<d.length;i++){
      const t=i/sr;
      const freq=30+30*Math.exp(-t*25);
      ph+=(2*Math.PI*freq)/sr;
      const click=(Math.random()*2-1)*Math.exp(-t*350)*0.55;
      const body=Math.sin(ph)*Math.exp(-t*7);
      const h2=Math.sin(ph*2)*0.12*Math.exp(-t*14);
      d[i]=body+h2+click;
    }
    lpf1p(d,5000,sr);
  });

  // 909 SNARE: ノイズ多め、アタッククラック、鋭いスナッピー感
  const snare = makeBuf(ctx, Math.floor(sr*0.18), (d,sr) => {
    let lfsr=0xBEEF;
    for(let i=0;i<d.length;i++){
      const t=i/sr;
      const bit=((lfsr>>0)^(lfsr>>2)^(lfsr>>3)^(lfsr>>5))&1;
      lfsr=((lfsr>>1)|(bit<<15))&0xFFFF;
      const noise=(lfsr/0xFFFF*2-1)*Math.exp(-t*32)*0.70;
      const tone=Math.sin(2*Math.PI*250*t)*Math.exp(-t*60)*0.22
               +Math.sin(2*Math.PI*180*t)*Math.exp(-t*40)*0.08;
      d[i]=noise+tone;
    }
    hpf1p(d,200,sr); lpf1p(d,7000,sr);
  });

  // 909 HAT: シャリっとした金属感、中高域重視
  const hat = makeBuf(ctx, Math.floor(sr*0.055), (d,sr) => {
    const pp=[{f:3547,a:.30},{f:4756,a:.25},{f:6234,a:.20},{f:7891,a:.15},{f:9876,a:.10}];
    const ph=pp.map(()=>Math.random()*2*Math.PI);
    for(let i=0;i<d.length;i++){
      const t=i/sr,env=Math.exp(-t*70);let s=0;
      pp.forEach((p,k)=>{ph[k]+=(2*Math.PI*p.f)/sr;s+=Math.sin(ph[k])*p.a;});
      d[i]=s*env;
    }
    lpf1p(d,10000,sr);
  });

  return { kick, snare, hat,
    hiop:  buildHiop(ctx,'lm1'),
    rim:   buildRim(ctx,'lm1'),
    cowbl: buildCowbell(ctx),
    clap:  buildClap(ctx,'909'),
    tamb:  buildTamb(ctx,'909'),
    shkr:  buildShkr(ctx,'909'),
  };
}

// ── JAZZ KIT ─────────────────────────────────────────────────────────────────
// ブラシスネア、シマリング系ハット、ウォームなキック
function buildJazzKit(ctx) {
  const sr = ctx.sampleRate;

  // JAZZ KICK: 50Hz、ウォーム、クリックなし、素早い減衰
  const kick = makeBuf(ctx, Math.floor(sr*0.30), (d,sr) => {
    let ph=0;
    for(let i=0;i<d.length;i++){
      const t=i/sr;
      const freq=48+18*Math.exp(-t*20);
      ph+=(2*Math.PI*freq)/sr;
      d[i]=Math.sin(ph)*Math.exp(-t*9)*(0.8+0.2*Math.sin(ph*0.5));
    }
    lpf1p(d,600,sr);
  });

  // JAZZ SNARE(ブラシ): ノイズ主体、長めのシャーっとした音
  const snare = makeBuf(ctx, Math.floor(sr*0.28), (d,sr) => {
    let lfsr=0xD1CE;
    for(let i=0;i<d.length;i++){
      const t=i/sr;
      const bit=((lfsr>>0)^(lfsr>>3)^(lfsr>>5)^(lfsr>>7))&1;
      lfsr=((lfsr>>1)|(bit<<15))&0xFFFF;
      const noise=(lfsr/0xFFFF*2-1)*Math.exp(-t*12)*0.55;
      const tone=Math.sin(2*Math.PI*180*t)*Math.exp(-t*20)*0.22;
      d[i]=noise+tone;
    }
    lpf1p(d,3500,sr); hpf1p(d,120,sr);
  });

  // JAZZ HAT: シマリング感、ランダム性高め
  const hat = makeBuf(ctx, Math.floor(sr*0.06), (d,sr) => {
    const pp=[{f:2890,a:.32},{f:3680,a:.26},{f:5120,a:.20},{f:7340,a:.14},{f:9100,a:.08}];
    const ph=pp.map(()=>Math.random()*2*Math.PI);
    for(let i=0;i<d.length;i++){
      const t=i/sr,env=Math.exp(-t*35)*(0.8+0.2*(Math.random()-0.5));let s=0;
      pp.forEach((p,k)=>{ph[k]+=(2*Math.PI*p.f)/sr;s+=Math.sin(ph[k])*p.a;});
      d[i]=s*env;
    }
    lpf1p(d,6000,sr);
  });

  return { kick, snare, hat,
    hiop:  buildHiop(ctx,'lofi'),
    rim:   buildRim(ctx,'lofi'),
    cowbl: buildCowbell(ctx),
    clap:  buildClap(ctx,'lofi'),
    tamb:  buildTamb(ctx,'jazz'),
    shkr:  buildShkr(ctx,'jazz'),
  };
}

// ── VINYL KIT ────────────────────────────────────────────────────────────────
// サンプリング感、強めのビットクラッシュ、低サンプリングレート感
function buildVinylKit(ctx) {
  const sr = ctx.sampleRate;
  const vinylSR = Math.round(sr * 0.45); // ~22kHz相当

  function vinylBuf(durationSec, fn) {
    const loLen = Math.floor(vinylSR * durationSec);
    const lo = new Float32Array(loLen);
    fn(lo, vinylSR, loLen);
    applyMulaw8bit(lo);
    // 6bit量子化でさらにクラッシュ
    for(let i=0;i<lo.length;i++) lo[i]=Math.round(lo[i]*31)/31;
    // ネイティブSRに最近傍補間
    const hiLen = Math.floor(sr * durationSec);
    const hi = new Float32Array(hiLen);
    for(let i=0;i<hiLen;i++) hi[i]=lo[Math.min(Math.floor(i/sr*vinylSR),loLen-1)];
    lpf1p(hi, 8000, sr);
    const buf=ctx.createBuffer(1,hiLen,sr); buf.copyToChannel(hi,0); return buf;
  }

  const kick = vinylBuf(0.35, (d,sr) => {
    let ph=0;
    for(let i=0;i<d.length;i++){
      const t=i/sr;
      const freq=40+25*Math.exp(-t*28);
      ph+=(2*Math.PI*freq)/sr;
      const click=(Math.random()*2-1)*Math.exp(-t*300)*0.3;
      d[i]=Math.sin(ph)*Math.exp(-t*7)+click;
    }
  });

  const snare = vinylBuf(0.20, (d,sr) => {
    let lfsr=0xA5B6;
    for(let i=0;i<d.length;i++){
      const t=i/sr;
      const bit=((lfsr>>0)^(lfsr>>2)^(lfsr>>3)^(lfsr>>5))&1;
      lfsr=((lfsr>>1)|(bit<<15))&0xFFFF;
      const noise=(lfsr/0xFFFF*2-1)*Math.exp(-t*28)*0.60;
      const tone=Math.sin(2*Math.PI*220*t)*Math.exp(-t*50)*0.25;
      d[i]=noise+tone;
    }
  });

  const hat = vinylBuf(0.055, (d,sr) => {
    const pp=[{f:3200,a:.30},{f:4050,a:.25},{f:5400,a:.20},{f:6800,a:.15},{f:8300,a:.10}];
    const ph=pp.map(()=>Math.random()*2*Math.PI);
    for(let i=0;i<d.length;i++){
      const t=i/sr,env=Math.exp(-t*60);let s=0;
      pp.forEach((p,k)=>{ph[k]+=(2*Math.PI*p.f)/sr;s+=Math.sin(ph[k])*p.a;});
      d[i]=s*env;
    }
  });

  return { kick, snare, hat,
    hiop:  buildHiop(ctx,'tape'),
    rim:   buildRim(ctx,'tape'),
    cowbl: buildCowbell(ctx),
    clap:  buildClap(ctx,'tape'),
    tamb:  buildTamb(ctx,'vinyl'),
    shkr:  buildShkr(ctx,'vinyl'),
  };
}

// ── MINIMAL KIT ───────────────────────────────────────────────────────────────
// 非常に短く乾いた音。テクノ/ミニマル向け。
function buildMinimalKit(ctx) {
  const sr = ctx.sampleRate;

  // キック: 超短い(150ms)、クリッキー、60Hz一発
  const kick = makeBuf(ctx, Math.floor(sr*0.15), (d,sr) => {
    let ph=0;
    for(let i=0;i<d.length;i++){
      const t=i/sr;
      const freq=60+40*Math.exp(-t*60);
      ph+=(2*Math.PI*freq)/sr;
      const click=(Math.random()*2-1)*Math.exp(-t*800)*0.6;
      d[i]=Math.sin(ph)*Math.exp(-t*18)+click;
    }
    lpf1p(d,3000,sr);
  });

  // スネア: 非常に短いクラック
  const snare = makeBuf(ctx, Math.floor(sr*0.08), (d,sr) => {
    let lfsr=0xF00D;
    for(let i=0;i<d.length;i++){
      const t=i/sr;
      const bit=((lfsr>>0)^(lfsr>>2)^(lfsr>>3)^(lfsr>>5))&1;
      lfsr=((lfsr>>1)|(bit<<15))&0xFFFF;
      d[i]=(lfsr/0xFFFF*2-1)*Math.exp(-t*60);
    }
    hpf1p(d,1000,sr); lpf1p(d,8000,sr);
  });

  // ハット: 極短い
  const hat = makeBuf(ctx, Math.floor(sr*0.025), (d,sr) => {
    const pp=[{f:6000,a:.35},{f:8500,a:.30},{f:11000,a:.25},{f:14000,a:.10}];
    const ph=pp.map(()=>Math.random()*2*Math.PI);
    for(let i=0;i<d.length;i++){
      const t=i/sr,env=Math.exp(-t*150);let s=0;
      pp.forEach((p,k)=>{ph[k]+=(2*Math.PI*p.f)/sr;s+=Math.sin(ph[k])*p.a;});
      d[i]=s*env;
    }
  });

  return { kick, snare, hat,
    hiop:  buildHiop(ctx,'minimal'),
    rim:   buildRim(ctx,'minimal'),
    cowbl: buildCowbell(ctx),
    clap:  buildClap(ctx,'minimal'),
    tamb:  buildTamb(ctx,'minimal'),
    shkr:  buildShkr(ctx,'minimal'),
  };
}

// ── ACOUSTIC KIT (Mac DeMarco風) ──────────────────────────────────────────────
//
// コンセプト: 部屋で録ったような「生っぽさ」。
//   - Kick: 55Hz胴鳴り主体。クリックほぼなし。ウッドな中域(180Hz)がアクセント。
//           ルームアンビエンス込み（短い部屋反射）。
//   - Snare: 胴鳴り(220Hz)強め、スナッピー控えめ。リムが当たった瞬間の
//            「パコッ」感をノイズバーストで表現。わずかなルーム。
//   - Hat: 生シンバルに近いシマー。複数の倍音部分音を不均一な減衰で重ねる。
//          金属的すぎず有機的な「シャッ」感。
//   - HiOp: ハットより長い余韻。自然なリング感。
//   - Rim: 木質スティックサウンド。シャープだが硬くない。
//   - Cowbell: buildCowbell流用（控えめゲイン）
//   - Clap: 素手の柔らかい手拍子。BPF緩め、driveほぼなし。
//
// 全体をテープサチュレーション相当の軽いμ-law処理でまとめ、
// 「小さなスタジオで一発録り」の質感を出す。

function buildAcousticKit(ctx) {
  const sr = ctx.sampleRate;

  // ── KICK: ウッドな胴鳴り ────────────────────────────────────────────────────
  // 55Hz→38Hz の緩やかなピッチ降下、長めのテール(480ms)
  // 180Hzの木質共鳴をサイン波で加味、クリックは最小限
  const kick = makeBuf(ctx, Math.floor(sr * 0.48), (d, sr) => {
    let ph = 0, ph2 = 0;
    for (let i = 0; i < d.length; i++) {
      const t = i / sr;
      // メイン: 55Hz→38Hz
      const freq = 38 + 17 * Math.exp(-t * 12);
      ph += (2 * Math.PI * freq) / sr;
      // ウッド共鳴: 180Hz 速い減衰
      ph2 += (2 * Math.PI * 180) / sr;
      const wood  = Math.sin(ph2) * Math.exp(-t * 55) * 0.18;
      const body  = Math.sin(ph) * Math.exp(-t * 5.8);
      // サブ層: オクターブ下を薄く
      const sub   = Math.sin(ph * 0.5) * Math.exp(-t * 7) * 0.10;
      // クリック: 極控えめ
      const click = (Math.random() * 2 - 1) * Math.exp(-t * 600) * 0.06;
      d[i] = body + sub + wood + click;
    }
    // LPF: 4kHz → ウッド質感を残しつつ金属感を除く
    lpf1p(d, 4000, sr);
    // HPF: 30Hz以下のルンブルをカット
    hpf1p(d, 30, sr);
    // 軽いテープ処理
    applyMulaw8bit(d);
  });

  // ── SNARE: 胴鳴り主体、温かみのある「パコッ」 ─────────────────────────────
  // 220Hz胴鳴り + 薄いスナッピーノイズ + アタック時の「パコッ」バースト
  const snare = makeBuf(ctx, Math.floor(sr * 0.30), (d, sr) => {
    let lfsr = 0xC3D2;
    for (let i = 0; i < d.length; i++) {
      const t = i / sr;
      const bit = ((lfsr >> 0) ^ (lfsr >> 2) ^ (lfsr >> 3) ^ (lfsr >> 5)) & 1;
      lfsr = ((lfsr >> 1) | (bit << 15)) & 0xFFFF;
      const noise = (lfsr / 0xFFFF * 2 - 1);
      // 胴鳴り: 220Hz + 三倍音(660Hz)
      const tone1 = Math.sin(2 * Math.PI * 220 * t) * Math.exp(-t * 28) * 0.55;
      const tone2 = Math.sin(2 * Math.PI * 660 * t) * Math.exp(-t * 55) * 0.08;
      // スナッピー: ノイズ、遅い減衰
      const snappy = noise * Math.exp(-t * 22) * 0.28;
      // アタックバースト: 「パコッ」感の短いノイズスパイク
      const burst  = noise * Math.exp(-t * 280) * 0.55;
      d[i] = tone1 + tone2 + snappy + burst;
    }
    // BPF的処理: HPFで低域カット、LPFで高域丸め
    hpf1p(d, 150, sr);
    lpf1p(d, 6500, sr);
    // テープ処理
    applyMulaw8bit(d);
  });

  // ── HAT(CL): 808アプローチ — 6本の不協和矩形波 + ノイズ + 短いエンベロープ ──
  //
  // TR-808的な「チッ」「ツッ」感を生音感でまとめる設計:
  //   1. 6本の矩形波を不協和音程に設定（整数比を意図的に避ける）
  //      → 金属的なザラッとした倍音構造
  //   2. ホワイトノイズを薄くミックス（空気感）
  //   3. アタック瞬間のピッチ降下（ピッチエンベロープ）でスティック打撃感
  //   4. 非常に短いDecay（"チッ" = ~55ms）
  //   5. HPFで低域完全カット、LPFで8〜10kHz狙い
  //   6. 軽いサチュレーションで「ジリ」感を加える
  const INHARMONIC_FREQS = [240, 285, 361, 432, 518, 666]; // 808に近い不協和比
  const hat = makeBuf(ctx, Math.floor(sr * 0.12), (d, sr) => {
    const phases = INHARMONIC_FREQS.map(() => Math.random() * 2 * Math.PI);
    const DECAY_K = 55;  // 短いDecay: クローズ感
    let lfsr = 0xF2A1;
    for (let i = 0; i < d.length; i++) {
      const t = i / sr;
      const env = Math.exp(-t * DECAY_K);
      // ピッチエンベロープ: アタック直後だけ周波数を1オクターブ上にずらして降下
      // → スティックがシンバルに当たった瞬間の「チッ」感
      const pitchMod = 1.0 + Math.exp(-t * 800) * 1.0;
      // 6本の不協和矩形波
      let metal = 0;
      for (let k = 0; k < 6; k++) {
        phases[k] += (2 * Math.PI * INHARMONIC_FREQS[k] * pitchMod) / sr;
        metal += Math.sign(Math.sin(phases[k])) * (k === 0 ? 0.28 : 0.16 - k * 0.015);
      }
      // ノイズ（隠し味）
      const bit  = ((lfsr >> 0) ^ (lfsr >> 2) ^ (lfsr >> 3) ^ (lfsr >> 5)) & 1;
      lfsr       = ((lfsr >> 1) | (bit << 15)) & 0xFFFF;
      const noise = ((lfsr / 0xFFFF) * 2 - 1) * 0.22;
      d[i] = (metal * 0.65 + noise * 0.35) * env;
    }
    // HPF 8kHz: 低〜中域を完全除去して「チッ」の金属感だけ残す
    hpf1p(d, 8000, sr);
    // LPF 16kHz: 超高域のエイリアシングをカット
    lpf1p(d, 16000, sr);
    // サチュレーション: ザラッとした実体感
    const k = 3.5;
    for (let i = 0; i < d.length; i++) {
      const x = d[i];
      d[i] = ((1 + k) * x) / (1 + k * Math.abs(x));
    }
    applyMulaw8bit(d);
  });

  // ── HI-OP: 同じ音源 + 長いエンベロープ + 短いリバーブ ────────────────────────
  //
  // クローズと同じ金属ソースを使い、Decayだけ大幅に伸ばす。
  // これにより「同じシンバルを開いた/閉じた」の物理的リアルさが出る。
  // + 短いルームリバーブで「金属板が響いている」奥行き感を追加。
  const hiopDur = 0.42;
  const hiopLen = Math.floor(sr * hiopDur);
  const hiopData = new Float32Array(hiopLen);
  {
    const phases2 = INHARMONIC_FREQS.map(() => Math.random() * 2 * Math.PI);
    const HIOP_DECAY_K = 7.5;  // 長いDecay: オープン感 (~420ms)
    let lfsr2 = 0xA3F5;
    for (let i = 0; i < hiopLen; i++) {
      const t = i / sr;
      const env = Math.exp(-t * HIOP_DECAY_K);
      const pitchMod = 1.0 + Math.exp(-t * 800) * 1.0;
      let metal = 0;
      for (let k = 0; k < 6; k++) {
        phases2[k] += (2 * Math.PI * INHARMONIC_FREQS[k] * pitchMod) / sr;
        metal += Math.sign(Math.sin(phases2[k])) * (k === 0 ? 0.28 : 0.16 - k * 0.015);
      }
      const bit2  = ((lfsr2 >> 0) ^ (lfsr2 >> 2) ^ (lfsr2 >> 3) ^ (lfsr2 >> 5)) & 1;
      lfsr2       = ((lfsr2 >> 1) | (bit2 << 15)) & 0xFFFF;
      const noise2 = ((lfsr2 / 0xFFFF) * 2 - 1) * 0.22;
      hiopData[i] = (metal * 0.65 + noise2 * 0.35) * env;
    }
    hpf1p(hiopData, 8000, sr);
    lpf1p(hiopData, 16000, sr);
    // サチュレーション
    const k = 3.5;
    for (let i = 0; i < hiopData.length; i++) {
      const x = hiopData[i];
      hiopData[i] = ((1 + k) * x) / (1 + k * Math.abs(x));
    }
    // 短いルームリバーブ（金属板の響き = 約35ms IR）
    const irLen = Math.floor(sr * 0.035);
    const ir = new Float32Array(irLen);
    for (let i = 0; i < irLen; i++) {
      ir[i] = (Math.random() * 2 - 1) * Math.exp(-i / (irLen * 0.3));
    }
    // 簡易畳み込み（線形、精度より速度優先）
    const wet = 0.18;
    const dry = 1.0 - wet;
    const conv = new Float32Array(hiopLen);
    for (let i = 0; i < hiopLen; i++) {
      let sum = 0;
      const jMax = Math.min(irLen, i + 1);
      for (let j = 0; j < jMax; j++) sum += hiopData[i - j] * ir[j];
      conv[i] = sum;
    }
    for (let i = 0; i < hiopLen; i++) hiopData[i] = hiopData[i] * dry + conv[i] * wet;
    applyMulaw8bit(hiopData);
  }
  const hiop = ctx.createBuffer(1, hiopLen, sr);
  hiop.copyToChannel(hiopData, 0);

  // ── RIM: スティックの木質打音 ─────────────────────────────────────────────
  // buildRim('jazz')より明るく、硬くない
  const rimLen = Math.floor(sr * 0.11);
  const rimData = new Float32Array(rimLen);
  {
    let lfsr = 0xA7C3;
    for (let i = 0; i < rimLen; i++) {
      const t = i / sr;
      // 木質トーン: 380Hzメイン + 760Hz倍音
      const tone  = Math.sin(2 * Math.PI * 380 * t) * Math.exp(-t * 75) * 0.62;
      const tone2 = Math.sin(2 * Math.PI * 760 * t) * Math.exp(-t * 130) * 0.20;
      const bit   = ((lfsr >> 0) ^ (lfsr >> 3) ^ (lfsr >> 5) ^ (lfsr >> 7)) & 1;
      lfsr        = ((lfsr >> 1) | (bit << 15)) & 0xFFFF;
      const noise = (lfsr / 0xFFFF * 2 - 1) * Math.exp(-t * 90) * 0.16;
      rimData[i]  = tone + tone2 + noise;
    }
    lpf1p(rimData, 7000, sr);
    hpf1p(rimData, 220, sr);
    applyMulaw8bit(rimData);
  }
  const rim = ctx.createBuffer(1, rimLen, sr);
  rim.copyToChannel(rimData, 0);

  // ── CLAP: 素手の柔らかい手拍子 ──────────────────────────────────────────
  // buildClapのベース素材をそのまま使い、kitEditParamsのデフォルトで
  // BPF広め(hpf=400/lpf=4000)、drive低め(15)で柔らかく仕上げる
  const clap = buildClap(ctx, 'acoustic');

  return { kick, snare, hat, hiop, rim,
    cowbl: buildCowbell(ctx),
    clap,
    tamb:  buildTamb(ctx, 'acoustic'),
    shkr:  buildShkr(ctx,'acoustic'),
  };
}

