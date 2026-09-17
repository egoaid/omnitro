// ─── LINN LM-1 ドラムエミュレーション ───────────────────────────────────────
//
// LINN LM-1（1980）の実機スペック:
//   サンプリングレート: ~28kHz
//   ビット深度: 8bit μ-law圧縮（実効6〜7bit相当だが温かみある歪み）
//   特徴: 生ドラムをサンプリングした最初の商業機。深いキック、スナッピーなスネア、
//         金属質なハット。8bitμ-lawの独特の「温かいのに粗い」質感が命。

// μ-law圧縮エンコード（録音時）→ デコード（再生時）でLM-1の歪み感を再現
function mulawEncode(x) {
  const MU = 255;
  const sign = x < 0 ? -1 : 1;
  x = Math.abs(x);
  x = Math.min(x, 1.0);
  return sign * Math.log(1 + MU * x) / Math.log(1 + MU);
}
function mulawDecode(x) {
  const MU = 255;
  const sign = x < 0 ? -1 : 1;
  x = Math.abs(x);
  return sign * (Math.pow(1 + MU, x) - 1) / MU;
}
function applyMulaw8bit(data) {
  // 8bit量子化（256段階）してμ-lawでエンコード→デコード
  for (let i = 0; i < data.length; i++) {
    const enc = mulawEncode(data[i]);                  // μ-law圧縮
    const q   = Math.round((enc + 1) / 2 * 255) / 255 * 2 - 1; // 8bit量子化
    data[i]   = mulawDecode(q);                        // デコード（歪み成分が乗る）
  }
}

// LM-1実機SR≈28kHz。44.1kHzに対して ratio≈0.635
// 線形補間なし（最近傍）で引き伸ばし → ステップノイズがLM-1の粒感を再現
function makeLm1Buffer(ctx, durationSec, renderFn) {
  const nativeSR  = ctx.sampleRate;
  const lm1SR     = Math.round(nativeSR * 0.635);   // ~28kHz相当
  const loSamples = Math.floor(lm1SR * durationSec);
  const hiSamples = Math.floor(nativeSR * durationSec);

  // LM-1レートで波形を生成
  const loData = new Float32Array(loSamples);
  renderFn(loData, lm1SR);

  // 8bit μ-law量子化（LM-1のROM圧縮を再現）
  applyMulaw8bit(loData);

  // 最近傍補間でネイティブレートに引き伸ばし
  const hiData = new Float32Array(hiSamples);
  for (let i = 0; i < hiSamples; i++) {
    hiData[i] = loData[Math.min(Math.floor(i / nativeSR * lm1SR), loSamples - 1)];
  }

  // LM-1のアナログ出力段を模倣: 軽いLPF（DAC後のRCフィルタ相当）
  // カットオフ ~10kHz：高域は若干なまる、中低域の温かさを残す
  const cutoff = 10000;
  const alpha  = 1 / (1 + nativeSR / (2 * Math.PI * cutoff));
  let prev = 0;
  for (let i = 0; i < hiSamples; i++) {
    prev = prev + alpha * (hiData[i] - prev);
    hiData[i] = prev;
  }

  const buf = ctx.createBuffer(1, hiSamples, nativeSR);
  buf.copyToChannel(hiData, 0);
  return buf;
}

// ─── 共通音色生成関数 ──────────────────────────────────────────────────────────
// これらは3キット共通で使用（kitNameで音色を微調整）

// ── OPEN HI-HAT ───────────────────────────────────────────────────────────────
// クローズより長く、高域を残す。テール ~300ms
function buildHiop(ctx, kitName) {
  const sr  = ctx.sampleRate;
  const dur = kitName==='tape'||kitName==='minimal' ? 0.18 : kitName==='lofi'||kitName==='jazz' ? 0.32 : 0.40;
  const len = Math.floor(sr * dur);
  const data = new Float32Array(len);
  const lpCut = kitName==='tape'||kitName==='minimal' ? 4000 : kitName==='lofi'||kitName==='jazz' ? 6000 : 11000;
  const decay = kitName==='tape'||kitName==='minimal' ? 20 : kitName==='lofi'||kitName==='jazz' ? 10 : 7;
  const partials = [
    {freq:3200,amp:0.28},{freq:4050,amp:0.22},{freq:5400,amp:0.18},
    {freq:6800,amp:0.14},{freq:8300,amp:0.10},{freq:10200,amp:0.08},
  ];
  const phases = partials.map(()=>Math.random()*2*Math.PI);
  for (let i = 0; i < len; i++) {
    const t=i/sr, env=Math.exp(-t*decay); let s=0;
    for (let k=0;k<partials.length;k++){
      phases[k]+=(2*Math.PI*partials[k].freq)/sr;
      s+=Math.sin(phases[k])*partials[k].amp;
    }
    data[i]=s*env;
  }
  const alpha=1/(1+sr/(2*Math.PI*lpCut)); let prev=0;
  for(let i=0;i<len;i++){prev=prev+alpha*(data[i]-prev);data[i]=prev;}
  if (kitName==='tape') applyMulaw8bit(data);
  const buf=ctx.createBuffer(1,len,sr); buf.copyToChannel(data,0); return buf;
}

// ── RIM SHOT ──────────────────────────────────────────────────────────────────
// 木質トーン + 短いノイズバースト。lofi/tapeは曇り処理あり。
function buildRim(ctx, kitName) {
  const sr  = ctx.sampleRate;
  const len = Math.floor(sr * 0.10);
  const data = new Float32Array(len);
  const freq1 = kitName==='tape' ? 280 : kitName==='lofi' ? 310 : 350;
  const freq2 = freq1 * 2;
  let lfsr = 0xFACE;
  for (let i = 0; i < len; i++) {
    const t    = i / sr;
    const tone  = Math.sin(2*Math.PI*freq1*t)*Math.exp(-t*90)*0.65
                + Math.sin(2*Math.PI*freq2*t)*Math.exp(-t*140)*0.25;
    const bit  = ((lfsr>>0)^(lfsr>>3)^(lfsr>>5)^(lfsr>>7))&1;
    lfsr       = ((lfsr>>1)|(bit<<15))&0xFFFF;
    const noise = ((lfsr/0xFFFF)*2-1)*Math.exp(-t*80)*0.18;
    data[i] = tone + noise;
  }
  const lpCutR = kitName==='tape' ? 2500 : kitName==='lofi'||kitName==='jazz' ? 3500 : kitName==='minimal' ? 5000 : 9000;
  const alphaR=1/(1+sr/(2*Math.PI*lpCutR)); let prevR=0;
  for(let i=0;i<len;i++){prevR=prevR+alphaR*(data[i]-prevR);data[i]=prevR;}
  if (kitName==='tape'||kitName==='vinyl') applyMulaw8bit(data);
  const buf=ctx.createBuffer(1,len,sr); buf.copyToChannel(data,0); return buf;
}

// ── COWBELL ───────────────────────────────────────────────────────────────────
// 562Hz + 845Hz の2倍音（TR-808風）、矩形波的な波形、金属的なリング
function buildCowbell(ctx) {
  const sr  = ctx.sampleRate;
  // 短め: 0.30s。ゲインを控えめに。
  const len = Math.floor(sr * 0.30);
  const data = new Float32Array(len);
  for (let i = 0; i < len; i++) {
    const t   = i / sr;
    // TR-808カウベル: 562Hzと845Hzの矩形波合成、速いエンベロープ
    const env = Math.exp(-t * 18);   // 以前の9→18: より短くアタック的に
    const f1  = Math.sign(Math.sin(2*Math.PI*562*t));
    const f2  = Math.sign(Math.sin(2*Math.PI*845*t));
    data[i] = (f1*0.55 + f2*0.45) * env * 0.35; // ゲイン0.35(以前は1.0相当)
  }
  // HPF 500Hz: 低域をカットしてメタリック感だけ残す
  const alphaH=1/(1+sr/(2*Math.PI*500)); let prevH=0,prevX=0;
  for(let i=0;i<len;i++){
    const x=data[i]; prevH=prevH*(1-alphaH)+x-prevX; prevX=x; data[i]=prevH;
  }
  // LPF 6kHz
  const alphaL=1/(1+sr/(2*Math.PI*6000)); let prevL=0;
  for(let i=0;i<len;i++){prevL=prevL+alphaL*(data[i]-prevL);data[i]=prevL;}
  const buf=ctx.createBuffer(1,len,sr); buf.copyToChannel(data,0); return buf;
}

// ── CLAP ─────────────────────────────────────────────────────────────────────
// よりナチュラルな手拍子: ランダムフェーズのサイン波群 + フィルタードノイズ
// シンセ感を排してアコースティックなスラップ音を目指す
// ─── HAND CLAP シンセシス ────────────────────────────────────────────────────
//
// 記事の指定通り:
//   1. ホワイトノイズ素材（ガウスノイズ）
//   2. 「パパパパーーーーーン」= 3つの短い山（各 ~6〜8ms）+ 減衰テール(~200ms)
//      山のカーブ: exponential attack + exponential decay（鋭い立ち上がり）
//   3. バンドパスフィルター 6dB/oct, Cutoff=1400Hz, Res=30%（Q≒1.0）
//   4. ドライブ: ソフトクリッピングで「前に出る」音
//
// buildClap はホワイトノイズ+3山エンベロープを焼き込んだ「素材バッファ」を返す。
// BPF・ドライブは _drumPlayBuf 内の KIT_EDIT パラメータで個別適用。
// ただし kitName別の初期値調整はここで行う。
//
// kitEditParams.clap のデフォルト値（KIT_EDIT_DEFAULTS）:
//   lpf=4000 (BPFのLP側), lpfQ=10 (Q=1.0相当), hpf=800 (BPFのHP側), drive=80

function buildClap(ctx, kitName) {
  const sr  = ctx.sampleRate;

  // ── 素材長: 3山(~25ms) + テール(~220ms) ────────────────────────────────
  const totalDur = kitName==='tape'||kitName==='lofi' ? 0.20 : 0.26;
  const len = Math.floor(sr * totalDur);
  const raw = new Float32Array(len);   // ノイズ素材

  // ── ガウスノイズ生成（Box-Muller法: ホワイトノイズより自然な分布） ─────────
  let _bm = null;
  function gauss() {
    if (_bm !== null) { const v = _bm; _bm = null; return v; }
    let u, v, s;
    do { u = Math.random()*2-1; v = Math.random()*2-1; s = u*u+v*v; }
    while (s >= 1 || s === 0);
    const m = Math.sqrt(-2 * Math.log(s) / s);
    _bm = v * m;
    return u * m;
  }
  for (let i = 0; i < len; i++) raw[i] = gauss();

  // ── 「パパパパーーーーーン」エンベロープ ─────────────────────────────────
  // 3つの短い山: それぞれ exponential attack + exponential decay
  // 山の間隔は約6〜8ms。後の山ほど少し小さく（手の平が重なる感）
  // テール: 3山が終わった後、長めの指数減衰（残響感）
  const env = new Float32Array(len);

  // 山パラメータ: [開始秒, attack定数, decay定数, 振幅]
  // attack定数が大きいほど急峻な立ち上がり（カーブを付ける）
  const peaks = [
    { start: 0.000, atkK: 1200, decK: 180, amp: 1.00 },
    { start: 0.007, atkK: 1000, decK: 160, amp: 0.80 },
    { start: 0.015, atkK:  800, decK: 140, amp: 0.62 },
  ];
  // テール: 3山後から始まる長い減衰
  const tailStart = 0.024;
  const tailDecK  = kitName==='tape'||kitName==='lofi' ? 12 : 9; // lofiは短め

  for (let i = 0; i < len; i++) {
    const t = i / sr;
    let e = 0;

    // 3山の合算
    for (const pk of peaks) {
      const dt = t - pk.start;
      if (dt < 0) continue;
      // 山の形: (1 - e^(-atkK*dt)) * e^(-decK*dt) × 振幅
      // これにより鋭い立ち上がりとすばやい減衰のパルス形が出る
      const mountain = (1 - Math.exp(-pk.atkK * dt)) * Math.exp(-pk.decK * dt);
      e += mountain * pk.amp;
    }

    // テール（3山後の残響）
    if (t >= tailStart) {
      const td = t - tailStart;
      e += Math.exp(-tailDecK * td) * 0.30;
    }

    env[i] = e;
  }

  // ── ノイズ × エンベロープ ─────────────────────────────────────────────────
  const data = new Float32Array(len);
  for (let i = 0; i < len; i++) data[i] = raw[i] * env[i];

  // ── LoFi/Tape: μ-law劣化 ─────────────────────────────────────────────────
  if (kitName==='tape'||kitName==='vinyl') applyMulaw8bit(data);

  // ── ピーク正規化（0.85 FSFS = ほぼフル、音割れなし） ──────────────────────
  let peak = 0;
  for (const v of data) if (Math.abs(v) > peak) peak = Math.abs(v);
  if (peak > 0.001) { const g = 0.85 / peak; for (let i = 0; i < len; i++) data[i] *= g; }

  const buf = ctx.createBuffer(1, len, sr);
  buf.copyToChannel(data, 0);
  return buf;
}
// ── TAMBOURINE ────────────────────────────────────────────────────────────────
// 設計思想:
//   1. 4本のデチューンした矩形波でジングルの金属ベースを作る
//      各ボイスのピッチをわずかにずらしてビート現象 = 複数枚ジングルの干渉感
//   2. 高速ランダムLFO（S&H的: 16〜22Hzの矩形波LFO）でピッチを激しく変調
//      「金属片がバラバラにぶつかり合う」ジャラジャラ感
//   3. マルチステージ「凸凹エンベロープ」: 単純減衰でなく、
//      複数の小バーストを時間差で重ねてジングル群の衝突時間差を再現
//   4. ノイズ薄掛け（隠し味、シンバル系の空気感）
//   5. 軽いLPFで高域の粗さを整えて完成
// ─── TAMBOURINE: グラニュラー合成エンジン ────────────────────────────────────
//
// 設計思想:
//   タンバリンはドラム系の「1イベント=1音源」ではなく
//   「1イベント=多数の微小金属衝突の非同期重なり」。
//   _drumPlayBuf を使わず、Web Audio API グラフで直接発音する独立系統。
//
// 各グレイン（金属衝突1回分）:
//   - サイン波ペア（デチューン）→ チープで柔らかい金属共鳴
//   - 極短いGainエンベロープ（5〜60ms）→ 一瞬の衝突感
//   - ランダムなタイミング（0〜25ms）→ 非同期な重なり
//   - ランダムな周波数（3k〜9kHz）→ 各ジングルの固有共鳴
//
// グレイン数: ベロシティに比例（弱打=8個, 強打=20個）
// → 強く叩くほど多くのジングルが動く物理的リアリティ
//
// DECAYパラメータ: kitEditParams.tamb.decayで全グレインのmaster gainを制御
// ピッチ変化: 完全にゼロ（playbackRate不使用）

function makeTambTrigger(ctx) {
  // ═══════════════════════════════════════════════════════════════════
  // KORG MS-20 タンバリンパッチ — ピッチ変化ゼロ版
  //
  // 【ユーザー確認済みの最良音色】
  //   Core: ホワイトノイズ → HPF(Q=16, 6800Hz) → LPF(Q=18, 10500Hz)
  //   Jingle: VCO2リングモジュレーター(4200Hz×2800Hz) + S&H(15Hz)
  //   Mix: Core 72% + Jingle 28%
  //
  // 【ピッチ変化の原因と解決】
  //   原因: バッファ内にエンベロープを焼き込むと、音量減衰中に
  //         S&Hの低周波成分が相対的に目立ち「高→低」に聴こえる。
  //   解決: バッファはフラット（エンベロープなし）で事前生成。
  //         DECAYはWeb Audio APIのGainノードで制御。
  //         → playbackRate変更なし = ピッチ変化ゼロ保証。
  //
  // 【バッファ事前生成】
  //   initDrumsのたびに1回だけ生成してキャッシュ。
  //   発音のたびにBufferSourceNodeを新規作成してGainで制御。
  // ═══════════════════════════════════════════════════════════════════

  const sr = ctx.sampleRate;

  // ── MS-20パッチをフラットバッファとして事前生成 ─────────────────
  // 長さ: 2秒（最大余韻でも十分）
  const BUF_DUR = 2.0;
  const bufLen  = Math.floor(sr * BUF_DUR);
  const bufData = new Float32Array(bufLen);

  // バイクアッドHPF係数
  function makeBiquadHPF(cutHz, q) {
    const w0 = 2 * Math.PI * cutHz / sr;
    const cosW = Math.cos(w0), sinW = Math.sin(w0);
    const alpha = sinW / (2 * q), a0 = 1 + alpha;
    return {
      b0: (1+cosW)/(2*a0), b1: -(1+cosW)/a0, b2: (1+cosW)/(2*a0),
      a1: -2*cosW/a0, a2: (1-alpha)/a0,
      x1:0, x2:0, y1:0, y2:0
    };
  }
  // バイクアッドLPF係数
  function makeBiquadLPF(cutHz, q) {
    const w0 = 2 * Math.PI * cutHz / sr;
    const cosW = Math.cos(w0), sinW = Math.sin(w0);
    const alpha = sinW / (2 * q), a0 = 1 + alpha;
    return {
      b0: (1-cosW)/(2*a0), b1: (1-cosW)/a0, b2: (1-cosW)/(2*a0),
      a1: -2*cosW/a0, a2: (1-alpha)/a0,
      x1:0, x2:0, y1:0, y2:0
    };
  }
  function bpTick(f, x) {
    const y = f.b0*x + f.b1*f.x1 + f.b2*f.x2 - f.a1*f.y1 - f.a2*f.y2;
    f.x2=f.x1; f.x1=x; f.y2=f.y1; f.y1=isFinite(y)?y:0; return f.y1;
  }

  const hpf = makeBiquadHPF(6800, 16);
  const lpf = makeBiquadLPF(10500, 18);

  // S&H設定
  const SH_STEP  = Math.floor(sr / 15);  // 15Hz
  const SH_DEPTH = 3200;
  let shVal = 0, shCount = 0;
  let lfsr  = 0xACE1, lfsr2 = 0xF3C2;

  // VCO2リングモジュレーター
  const VCO2_BASE = 4200, VCO2_MOD = 2800;
  let ph_car = 0, ph_mod = 0;

  // ── フラットに生成（エンベロープなし） ────────────────────────────
  for (let i = 0; i < bufLen; i++) {
    // Core: ホワイトノイズ → HPF → LPF
    const b1 = ((lfsr>>0)^(lfsr>>2)^(lfsr>>3)^(lfsr>>5))&1;
    lfsr = ((lfsr>>1)|(b1<<15))&0xFFFF;
    const wn = (lfsr / 0xFFFF) * 2 - 1;
    const core = bpTick(lpf, bpTick(hpf, wn));

    // S&Hクロック
    if (++shCount >= SH_STEP) {
      shCount = 0;
      const b2 = ((lfsr2>>0)^(lfsr2>>2)^(lfsr2>>3)^(lfsr2>>5))&1;
      lfsr2 = ((lfsr2>>1)|(b2<<15))&0xFFFF;
      shVal = ((lfsr2 / 0xFFFF) * 2 - 1) * SH_DEPTH;
    }

    // VCO2: リングモジュレーター + S&H
    const freq = Math.max(200, VCO2_BASE + shVal);
    ph_car += (2 * Math.PI * freq)     / sr;
    ph_mod += (2 * Math.PI * VCO2_MOD) / sr;
    const ring = Math.sin(ph_car) * Math.sin(ph_mod);

    // Mix Core:Jingle = 10:4
    bufData[i] = core * 0.72 + ring * 0.28;
  }

  // ピーク正規化（フラットなので均一）
  let peak = 0;
  for (let i = 0; i < bufLen; i++) if (Math.abs(bufData[i]) > peak) peak = Math.abs(bufData[i]);
  if (peak > 0.001) {
    const g = 0.90 / peak;
    for (let i = 0; i < bufLen; i++) bufData[i] *= g;
  }

  // キャッシュ用AudioBuffer
  const cachedBuf = ctx.createBuffer(1, bufLen, sr);
  cachedBuf.copyToChannel(bufData, 0);

  // ── トリガー関数（発音のたびに呼ばれる） ────────────────────────
  return function trigger(time, velocity = 0.65) {
    const t0  = time || ctx.currentTime;
    const vel = Math.max(0.1, Math.min(1.0, velocity));

    const p = (typeof kitEditParams !== 'undefined' && kitEditParams.tamb)
      ? kitEditParams.tamb : {};
    const decayMs  = Math.max(80, p.decay  ?? 450);
    const levelMul = (p.level ?? 90) / 90;
    const panVal   = (p.pan   ?? 0)  / 100;

    // ソース（毎回新規作成、playbackRate=1.0固定）
    const src = ctx.createBufferSource();
    src.buffer = cachedBuf;
    src.playbackRate.value = 1.0;  // 絶対に変えない

    // GainエンベロープのみでDecayを制御
    const gainNode = ctx.createGain();
    gainNode.gain.setValueAtTime(vel * levelMul * 0.88, t0);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, t0 + decayMs / 1000);

    src.connect(gainNode);

    if (Math.abs(panVal) > 0.01) {
      const panner = ctx.createStereoPanner();
      panner.pan.value = Math.max(-1, Math.min(1, panVal));
      gainNode.connect(panner);
      panner.connect(drumGain);
    } else {
      gainNode.connect(drumGain);
    }

    src.start(t0);
    src.stop(t0 + decayMs / 1000 + 0.05);

    // 後始末
    src.onended = () => {
      try { gainNode.disconnect(); } catch(e) {}
    };
  };
}


function buildTamb(ctx, kitName) { return ctx.createBuffer(1, 1, ctx.sampleRate); }


// ── SHAKER ────────────────────────────────────────────────────────────────────
// マイクロインパクトクラスター合成によるシェイカー音。
// 以前のタンバリン合成（BPFノイズバースト群）をシェイカーとして転用。
function buildShkr(ctx, kitName) {
  const sr  = ctx.sampleRate;
  const dur = 1.20;
  const len = Math.floor(sr * dur);
  const data = new Float32Array(len);

  let rngState = 0xCAFE_BABE;
  function rng() {
    rngState ^= rngState << 13;
    rngState ^= rngState >> 17;
    rngState ^= rngState << 5;
    return ((rngState >>> 0) / 0xFFFFFFFF);
  }

  const N_EVENTS = 16;
  const events = [];
  for (let k = 0; k < N_EVENTS; k++) {
    const isMain = k < 8;
    events.push({
      delayMs:  isMain ? rng() * 12 : 5 + rng() * 20,
      freqHz:   2000 + rng() * 10000,
      q:        6 + rng() * 8,
      decayMs:  isMain ? 20 + rng() * 60 : 10 + rng() * 40,
      amp:      isMain ? 0.6 + rng() * 0.4 : 0.3 + rng() * 0.4,
    });
  }

  const filters = events.map(ev => {
    const w0 = 2 * Math.PI * ev.freqHz / sr;
    const cosW = Math.cos(w0), sinW = Math.sin(w0);
    const alpha = sinW / (2 * ev.q);
    const a0 = 1 + alpha;
    return {
      b0: (sinW/2)/a0, b1: 0, b2: -(sinW/2)/a0,
      a1: (-2*cosW)/a0, a2: (1-alpha)/a0,
      x1:0, x2:0, y1:0, y2:0,
    };
  });

  const delaySamples = events.map(ev => Math.floor(ev.delayMs/1000*sr));
  const decayConsts  = events.map(ev => 1/(ev.decayMs/1000));
  const lfsrs = events.map((_, k) => ((0xACE1 ^ (k*0x1234+0x5678)) >>> 0));
  let lfsrW = 0xB2D4;

  for (let i = 0; i < len; i++) {
    const t = i / sr;
    let sum = 0;
    for (let k = 0; k < N_EVENTS; k++) {
      const ds = delaySamples[k];
      if (i < ds) continue;
      const tj = (i - ds) / sr;
      lfsrs[k] ^= lfsrs[k] << 13;
      lfsrs[k] ^= lfsrs[k] >> 17;
      lfsrs[k] ^= lfsrs[k] << 5;
      const noise = ((lfsrs[k]>>>0)/0xFFFFFFFF)*2-1;
      const f = filters[k];
      const y = f.b0*noise + f.b1*f.x1 + f.b2*f.x2 - f.a1*f.y1 - f.a2*f.y2;
      f.x2=f.x1; f.x1=noise; f.y2=f.y1; f.y1=isFinite(y)?y:0;
      sum += y * Math.exp(-tj*decayConsts[k]) * events[k].amp;
    }
    sum /= (N_EVENTS * 0.4);
    lfsrW ^= lfsrW<<13; lfsrW ^= lfsrW>>17; lfsrW ^= lfsrW<<5;
    data[i] = sum + ((lfsrW>>>0)/0xFFFFFFFF*2-1) * Math.exp(-t*300) * 0.04;
  }

  hpf1p(data, 600, sr);
  lpf1p(data, 12000, sr);
  const satK = kitName==='tape'||kitName==='lofi' ? 3.5 : 1.5;
  for (let i=0;i<data.length;i++){const x=data[i];data[i]=((1+satK)*x)/(1+satK*Math.abs(x));}
  if (kitName==='tape'||kitName==='lofi'||kitName==='vinyl') applyMulaw8bit(data);
  let peak=0;
  for (let i=0;i<data.length;i++) if(Math.abs(data[i])>peak) peak=Math.abs(data[i]);
  if (peak>0.001){const g=0.90/peak;for(let i=0;i<data.length;i++) data[i]*=g;}
  const buf=ctx.createBuffer(1,len,sr); buf.copyToChannel(data,0); return buf;
}

// 現在のドラムキット
let currentDrumKit = '808';

// キットごとのバッファを保持（一度生成したら再利用）
const drumKitBuffers = {};

// ── キットエディター: チャンネルごとのパラメータ ─────────────────────────────
// level: 0.0〜2.0 (1.0=標準)
// tune:  -24〜+24 半音単位 → playbackRate = 2^(tune/12)
// decay: 0.5〜2.0 (1.0=標準、>1でテール延長) → gainカーブのscale
// pan:   -1.0〜1.0
