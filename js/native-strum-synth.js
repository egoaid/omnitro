// ─── NATIVE STRUM SYNTH ──────────────────────────────────────────────────────
// OM-84/OM-108の音響物理を再現:
//   Voice1: FM変調（LFOでピッチを±30セント変調）→ 揺らぎのある温かみ
//   Voice2: ストレート方形波（一切揺らぎなし）
//   2つを同時発音 → うなり（ビート現象）= コーラス/フェイジング効果
//
// AM変調（振幅変調）はOrganのみ → RotarySpkr効果
// ストラムのトレモロはこのビート現象で実現するのが正解
//
// ─── v1.5.14 パフォーマンス最適化（2026-09-21） ──────────────────────────────
// iPad第7世代（A10）でストラムプレート演奏時にノイズ/フリーズが発生する問題を
// 調査した結果、音楽的仕様には一切触れず、以下の3点のみを最適化した。
// 音色・エンベロープ・ボイス構成（オシレーター数、フィルター、ビート現象等）は
// 完全に維持している。詳細は REFACTOR_NOTES.md 参照。
//
//   1. WaveShaperカーブの毎ノート再計算・再アロケートを廃止
//      → drive量ごとにカーブをキャッシュ（Float32Array 44100点→2048点。
//        WaveShaperNodeは線形補間するため、なめらかなソフトクリップ曲線は
//        2048点でも44100点と聴感上/測定上区別がつかない一方、生成コストは
//        約1/21になる。ドラム側は元々256点で実装済みで問題が出ていないため、
//        この解像度低下が音質に影響しないことは既存実装からも裏付けられる）
//   2. フィルター定義の正規化（Array.isArray判定・フォールバック配列生成）を
//      ノートごとではなくupdate()時（ボイス切替時）に1回だけ行うようキャッシュ
//   3. ノート名→周波数のTone.Frequency()パースをキャッシュ
//      （文字列パース＋正規表現コストをノートごとに毎回払わない）
//   4. 同時発音数に上限（MAX_ACTIVE_VOICES）を設け、超過時のみ最古のボイスを
//      12msの短いフェードで穏やかに間引く（voice stealing）。
//      OMNI1のリリースは最大4秒あり、素早い連続ストラムでは同時に鳴っている
//      ノート数が無制限に積み上がってオーディオスレッドのDSP負荷が跳ね上がる
//      ことがある（iPhone SE2のA13では問題にならないが、A10では顕著）。
//      上限は通常の演奏では絶対に到達しない値（20ボイス）に設定しており、
//      普段の演奏の音楽的結果・音質には一切影響しない安全弁として機能する。
//      ポリフォニーを下げる設定ではなく、暴走時のみ働くセーフティネット。
//
// これらは全て「同じ音楽的結果をより少ないCPU/メモリ/AudioNode操作で実現する」
// ための最適化であり、音質・ストラムの音楽的仕様・演奏感は変更していない。

// LFO周波数: 約5.5Hz、振幅: ±30セント(=約0.003の周波数比)
const VIBRATO_RATE  = 5.5;   // Hz
const VIBRATO_DEPTH = 0.003; // ±30セント

// 同時発音の安全上限（通常の演奏では到達しない値。暴走時のみのセーフティネット）
// v1.5.22: AUDIO PERFORMANCE MODEがLOW POWERのときは、この上限自体を
// 大幅に下げることでiPad第7世代のような非力な端末でも安定して鳴らせる
// ようにする（ユーザーが明示的に選択した場合のみ。既定はHIGH QUALITY
// で従来と完全に同じ挙動）。
const MAX_ACTIVE_VOICES_HIGH = 20;
const MAX_ACTIVE_VOICES_LOW  = 7;
function isLowPowerMode() {
  return typeof state !== 'undefined' && state.audioPerformanceMode === 'low';
}
function getMaxActiveVoices() {
  return isLowPowerMode() ? MAX_ACTIVE_VOICES_LOW : MAX_ACTIVE_VOICES_HIGH;
}
// voice steal時のフェード時間（クリック音を防ぎつつ素早く間引く）
const VOICE_STEAL_FADE = 0.012;

// ── LOW POWER: 発音トリガー自体のレート上限（v1.5.23） ──────────────────────
// 実機ログで判明した事実: LOW POWERで同時発音数の上限を7に下げても、
// 高速マルチタッチストラム時はnotes triggered 489回中445回(91%)がvoice steal
// になっていた。これは「上限に達した状態でトリガーが来るたび、cap判定＋
// 間引き処理（AudioParam操作・setTimeout予約）を実行する」コストそのものが
// メインスレッドを圧迫していたことを意味する——同時発音数の上限だけでは
// 「トリガー自体の頻度」は一切減らせない。
// LOW POWER時のみ、直近の発音から一定時間（約22ms≒45notes/sec相当。通常の
// 演奏では絶対に到達しない値）が経っていない発音は静かに間引く（音を出さず
// 早期return）。これにより極端なバースト時のAudioNode生成・AudioParam
// スケジューリング・voice steal処理の発生回数そのものを減らす。
// HIGH QUALITY時はこのゲート自体が無効（従来と完全に同じ挙動）。
const MIN_TRIGGER_INTERVAL_LOW = 0.022; // 秒

// ── LOW POWER: ボイスプール（v1.5.27） ──────────────────────────────────────
// 調査結果: OMNI1のリリースは約4秒あり、上限7だと1.75音/秒を超える演奏では
// 常時voice stealになる（実測: 388ノート中367回=95%）。従来はstealのたびに
// 「フェード＋stop＋setTimeout＋7ノード破棄」と「7ノード新規生成」の両方を
// 毎ノート実行しており、これがUIスレッドのフレーム落ちとGC負荷の原因だった。
// LOW POWERでは、ボイス（オシレーター2個・GainNode・フィルター群）を最初に
// 一度だけ作って常時走らせたまま使い回し、ノートごとの生成/破棄を無くす。
// 未使用ボイスは出力をnativeDestから外して（グラフ末端に到達しない状態に
// して）DSP負荷ゼロにし、使うときに1本繋ぎ直すだけにする。
// HIGH QUALITY経路（従来のノード生成方式）には一切触れない。
const POOL_FADE = 0.006;         // 使用中ボイスを再利用する際のフェードアウト時間
const POOL_RETRIGGER_DELAY = 0.008; // 再利用ボイスで新ノートを始めるまでの遅延
const POOL_SWEEP_MS = 500;       // 鳴り終えたボイスを切り離す共有タイマー（1本のみ）

// ── 軽量パフォーマンスカウンター ────────────────────────────────────────────
// console.logを撒かず、診断オーバーレイ（js/perf-diagnostics.js）が任意の
// タイミングでポーリングして読み取れるようにするための単純なカウンタ集合。
// 加算のみでコストは無視できるレベル。診断オーバーレイを一度も開かなくても
// このカウンタ自体のオーバーヘッドは実質ゼロ。
// ── 処理時間の簡易プロファイラ（診断モニター表示用。performance.now()2回のみで軽量） ──
window._omniProf = window._omniProf || {};
function omniProfEnd(name, t0) {
  const d = performance.now() - t0;
  const s = window._omniProf[name] || (window._omniProf[name] = { n: 0, sum: 0, max: 0 });
  s.n++; s.sum += d; if (d > s.max) s.max = d;
}

window._omniPerf = window._omniPerf || {
  notesTriggered: 0,
  voicesStolen: 0,
  nodesCreated: 0,
  nodesDestroyed: 0,
  currentVoices: 0,
  maxConcurrentVoices: 0,
  curveCacheHits: 0,
  curveCacheMisses: 0,
};

// ── WaveShaperカーブ キャッシュ ──────────────────────────────────────────────
// drive量（≒音色プロファイルごとに固定値）をキーにカーブを使い回す。
// 音色切替やチューニング変更ではdrive量は変わらないため、実質「初回のみ生成」
// になる。カーブの数学的な形は元の実装と完全に同一（解像度のみ縮小）。
const _saturationCurveCache = new Map();
const SATURATION_CURVE_POINTS = 2048; // 44100点から縮小（WaveShaperは線形補間するため聴感上同一）

function makeSaturationCurve(amount) {
  const key = Math.round(amount * 10000); // drive量を丸めてキャッシュキー化
  const cached = _saturationCurveCache.get(key);
  if (cached) {
    window._omniPerf.curveCacheHits++;
    return cached;
  }
  window._omniPerf.curveCacheMisses++;
  const k = Math.max(1, amount * 10);
  const curve = new Float32Array(SATURATION_CURVE_POINTS);
  for (let i = 0; i < curve.length; i++) {
    const x = i * 2 / curve.length - 1;
    curve[i] = ((1 + k) * x) / (1 + k * Math.abs(x));
  }
  _saturationCurveCache.set(key, curve);
  return curve;
}

// ── ノート名 → 周波数 キャッシュ ─────────────────────────────────────────────
// Tone.Frequency(noteStr).toFrequency() は文字列パース（正規表現）を伴うため、
// 同じノート名が毎ノート再パースされないようキャッシュする。
// チューニング（tuneCents）は参照後に別途乗算するため、キャッシュ自体は
// チューニング非依存で安全。
const _noteFreqCache = new Map();

function noteToFrequency(noteStr) {
  let f = _noteFreqCache.get(noteStr);
  if (f === undefined) {
    f = Tone.Frequency(noteStr).toFrequency();
    _noteFreqCache.set(noteStr, f);
  }
  return f;
}

function normalizeFilterDefs(filters) {
  if (Array.isArray(filters)) return filters;
  if (filters) return [filters];
  return [];
}

function getSustainEnvelopeScale() {
  return 0.25 + state.volumes.sustain * 1.25;
}

function getReleaseEnvelopeScale() {
  return 0.4 + state.volumes.sustain * 1.0;
}

function tuneRatio() {
  return Math.pow(2, (state.tuneCents || 0) / 1200);
}

class NativeStrumSynth {
  constructor(dest, voiceDef) {
    this.ctx = Tone.getContext().rawContext;
    if (dest instanceof AudioNode) {
      this.nativeDest = dest;
    } else if (dest && dest._nativeNode instanceof AudioNode) {
      this.nativeDest = dest._nativeNode;
    } else {
      this.nativeDest = getNativeNode(dest);
    }
    // ── アクティブボイス追跡 ──────────────────────────────────────────────────
    // 各 triggerAttackRelease が生成した全ノードをここに登録する。
    // panic() はこの配列を走査して全ノードを即時停止・切断する。
    // 配列の先頭が常に「最も古いボイス」になる（push/shiftで管理）ため、
    // voice stealingでの間引き対象選定がO(1)で行える。
    this._activeVoices = []; // Array<{ oscs: OscillatorNode[], gains: AudioNode[] }>
    this.update(voiceDef);
  }

  update(voiceDef) {
    this.oscType = voiceDef.osc === 'fmsine' ? 'sine' : voiceDef.osc;
    this.attack  = voiceDef.attack;
    this.decay   = Math.max(voiceDef.decay, 0.1);
    this.sustain = Math.max(0.04, Math.min(1, voiceDef.sustain * getSustainEnvelopeScale()));
    this.release = Math.max(0.03, Math.min(6.0, voiceDef.release * getReleaseEnvelopeScale()));
    this.gainVal = 0.22;
    this.subGainVal = 0.08;
    this.color = voiceDef;
    this.subColor = normalizeSubDef(voiceDef.sub);
    this.tuneCents = state.tuneCents || 0;
    // フィルター定義はボイス切替時に1回だけ正規化してキャッシュ（毎ノート計算しない）
    this._mainFilters = normalizeFilterDefs(voiceDef.filters);
    this._subFilters  = normalizeFilterDefs(this.subColor.filters);

    // ── 共有ビブラートLFO（v1.5.21最適化） ──────────────────────────────────
    // vibratoRate/Depthはボイス固有の定数（ノートごとに変わらない）ため、
    // 従来は毎ノートで生成していたLFO用OscillatorNodeを、ボイス切替時に
    // 1個だけ作って鳴らし続ける方式に変更した。各ノートは深さ調整用の
    // lfoDepth（GainNode、ノートの周波数に応じて深さが変わるため個別に
    // 必要）だけをこの共有LFOにfan-out接続し、ノート終了時はlfoDepthだけを
    // 切断する（共有LFO自体は次のノートのためにそのまま鳴り続ける）。
    // 変調のかかり方・音自体は従来と完全に同一で、ノートごとのオシレー
    // ター生成数を1個減らせる（iPad等CPU制約端末でのノード生成コスト
    // 削減が目的）。
    if (this._sharedLfo) {
      try { this._sharedLfo.stop(); this._sharedLfo.disconnect(); } catch(e){}
    }
    this._sharedLfo = this.ctx.createOscillator();
    this._sharedLfo.type = 'sine';
    this._sharedLfo.frequency.value =
      voiceDef.vibratoRate != null ? voiceDef.vibratoRate : VIBRATO_RATE;
    this._sharedLfo.start();
  }

  // ── 真のパニック停止 ─────────────────────────────────────────────────────
  // 全アクティブボイスの OscillatorNode を即時 stop() し、
  // 関連する GainNode / フィルター等を disconnect() して音を物理的に消す。
  panic() {
    const now = this.ctx.currentTime;
    this._panicPool(now);

    // ── Stage 1: 即時消音（同一サンプル精度） ────────────────────────────────
    // gain パラメータを持つノード（envGain, subEnv, mixGain 等）のみを対象に
    // cancelScheduledValues + setValueAtTime(0) を適用する。
    // stop() / disconnect() はまだ呼ばない — レンダリングスレッドへの
    // 一括負荷を避け、録音バッファのタイミングディスコンティニュイティを防ぐ。
    for (const voice of this._activeVoices) {
      for (const node of voice.gains) {
        if (node.gain) {
          try {
            node.gain.cancelScheduledValues(now);
            node.gain.setValueAtTime(0, now);
          } catch(e){}
        }
      }
    }

    // ── Stage 2: 100ms後にノードを破壊 ──────────────────────────────────────
    // この時点では全ノードはすでに無音。
    // Tone.Transport・リズムスケジューラ・レコーダータイミングには一切触れない。
    const voicesToDestroy = this._activeVoices;
    this._activeVoices = [];   // 新しい発音は新しい配列に追加される
    window._omniPerf.currentVoices = 0;
    for (const voice of voicesToDestroy) voice._stolen = true; // onended側の二重処理防止

    setTimeout(() => {
      const stopAt = this.ctx.currentTime;
      let destroyed = 0;
      for (const voice of voicesToDestroy) {
        for (const osc of voice.oscs) {
          try { osc.stop(stopAt); } catch(e){}
          try { osc.disconnect();  } catch(e){}
        }
        for (const node of voice.gains) {
          try { node.disconnect(); } catch(e){}
          destroyed++;
        }
      }
      window._omniPerf.nodesDestroyed += destroyed;
    }, 100);
  }

  // ── voice stealing: 上限超過時、最古のボイスを短いフェードで間引く ────────
  // クリックノイズを避けるため12msの直線フェードを挟んでから停止する。
  // 通常の演奏でこの上限（MAX_ACTIVE_VOICES）に達することはなく、
  // 素早い連続ストラム等でオーディオスレッド負荷が積み上がる場合のみ働く
  // セーフティネット。音質・ポリフォニー設定を恒常的に下げるものではない。
  _stealOldestVoice() {
    const voice = this._activeVoices.shift();
    if (!voice) return;
    voice._stolen = true; // onended側に「後片付け済み」を伝える印（二重disconnect防止）
    const now = this.ctx.currentTime;
    for (const node of voice.gains) {
      if (node.gain) {
        try {
          const cur = node.gain.value;
          node.gain.cancelScheduledValues(now);
          node.gain.setValueAtTime(cur, now);
          node.gain.linearRampToValueAtTime(0.0001, now + VOICE_STEAL_FADE);
        } catch(e){}
      }
    }
    const stopAt = now + VOICE_STEAL_FADE + 0.005;
    for (const osc of voice.oscs) {
      try { osc.stop(stopAt); } catch(e){}
    }
    setTimeout(() => {
      let destroyed = 0;
      for (const node of voice.gains) { try { node.disconnect(); } catch(e){} destroyed++; }
      window._omniPerf.nodesDestroyed += destroyed;
    }, (VOICE_STEAL_FADE + 0.05) * 1000);
    window._omniPerf.voicesStolen++;
  }

  // ═══ LOW POWER ボイスプール ═════════════════════════════════════════════
  // voice = { osc1, osc2, envGain, lfoDepth, out, nodes[], connected, endTime, gen }
  _poolCreateVoice() {
    const ctx = this.ctx;
    const MIX1 = 0.68, MIX2 = 0.04;
    const envGain = ctx.createGain();
    envGain.gain.value = 0.0001;
    const osc1 = ctx.createOscillator();
    osc1.type = this.oscType;
    const lfoDepth = ctx.createGain();
    this._sharedLfo.connect(lfoDepth);
    lfoDepth.connect(osc1.frequency);
    osc1.connect(envGain);
    const osc2 = ctx.createOscillator();
    osc2.type = 'square';
    const mix2 = ctx.createGain();
    mix2.gain.value = MIX2 / MIX1;
    osc2.connect(mix2);
    mix2.connect(envGain);
    const nodes = [envGain, osc1, lfoDepth, osc2, mix2];
    let out = envGain;
    for (const def of this._mainFilters) {
      const f = ctx.createBiquadFilter();
      f.type = def.type || 'lowpass';
      f.frequency.value = def.frequency || 2000;
      f.Q.value = def.Q || def.q || 0.7;
      out.connect(f); out = f; nodes.push(f);
    }
    if (this.color.drive && this.color.drive >= 0.02) {
      const sh = ctx.createWaveShaper();
      sh.curve = makeSaturationCurve(this.color.drive);
      sh.oversample = '2x';
      out.connect(sh); out = sh; nodes.push(sh);
    }
    // オシレーターは常時走らせたまま使い回す。out は未接続（=DSP負荷ゼロ）。
    osc1.start(); osc2.start();
    window._omniPerf.nodesCreated += nodes.length;
    window._omniPerf.poolVoices = (window._omniPerf.poolVoices || 0) + 1;
    return { osc1, osc2, envGain, lfoDepth, out, nodes, connected: false, endTime: 0, gen: 0 };
  }

  _poolAcquire(now) {
    const pool = this._pool || (this._pool = []);
    // 1) 鳴り終えている（無音の）ボイスを優先
    for (const v of pool) if (v.endTime <= now) return { v, stolen: false };
    // 2) 上限までは新規作成（初回のみ）
    if (pool.length < MAX_ACTIVE_VOICES_LOW) {
      const v = this._poolCreateVoice();
      pool.push(v);
      return { v, stolen: false };
    }
    // 3) 全て使用中: 終了時刻が最も近い（=残響が最も小さい）ボイスを再利用
    let best = pool[0];
    for (const v of pool) if (v.endTime < best.endTime) best = v;
    return { v: best, stolen: true };
  }

  _triggerPooled(noteStr, velocity) {
    const _pt0 = performance.now();
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const { v, stolen } = this._poolAcquire(now);
    let t = now;
    const g = v.envGain.gain;
    if (stolen) {
      // 使用中ボイスの再利用: 短いフェードで無音にしてからピッチを変える（クリック防止）
      let cur = 0.0001;
      try { cur = Math.max(0.0001, g.value); } catch(e){}
      g.cancelScheduledValues(now);
      g.setValueAtTime(cur, now);
      g.linearRampToValueAtTime(0.0001, now + POOL_FADE);
      t = now + POOL_RETRIGGER_DELAY;
      window._omniPerf.voicesStolen++;
    } else {
      g.cancelScheduledValues(now);
    }

    const freq = noteToFrequency(noteStr) * tuneRatio();
    const peak = this.gainVal * velocity;
    const safeAttack = Math.max(0.008, this.attack);
    const MIX1 = 0.68;
    const safePeak = Math.max(0.0001, peak * MIX1);
    const sustLevel = Math.max(0.0001, safePeak * this.sustain);

    v.osc1.frequency.setValueAtTime(freq, t);
    v.osc1.detune.setValueAtTime((Math.random() - 0.5) * 1.8, t);
    v.osc2.frequency.setValueAtTime(freq, t);
    v.osc2.detune.setValueAtTime((Math.random() - 0.5) * 0.9, t);
    v.lfoDepth.gain.setValueAtTime(freq * (this.color.vibratoDepth != null ? this.color.vibratoDepth : VIBRATO_DEPTH), t);

    // エンベロープは従来ノード生成方式と同一の形状
    g.setValueAtTime(0.0001, t);
    g.exponentialRampToValueAtTime(safePeak, t + safeAttack);
    g.linearRampToValueAtTime(sustLevel, t + safeAttack + this.decay);
    const releaseStart = t + safeAttack + this.decay + 0.05;
    g.setValueAtTime(sustLevel, releaseStart);
    g.exponentialRampToValueAtTime(0.0001, releaseStart + this.release);

    v.endTime = releaseStart + this.release + 0.02;
    v.gen++;
    if (!v.connected) {
      v.out.connect(this.nativeDest);
      v.connected = true;
      this._poolStartSweeper();
    }

    const perf = window._omniPerf;
    perf.notesTriggered++;
    let busy = 0;
    for (const x of this._pool) if (x.endTime > now) busy++;
    perf.currentVoices = busy;
    if (busy > perf.maxConcurrentVoices) perf.maxConcurrentVoices = busy;
    omniProfEnd('strum-trigger', _pt0);
  }

  // 鳴り終えたボイスの出力を切り離す共有タイマー（プール全体で1本のみ。
  // 接続中のボイスが無くなれば自動停止）。ノートごとのsetTimeoutは使わない。
  _poolStartSweeper() {
    if (this._poolSweeper) return;
    this._poolSweeper = setInterval(() => {
      const now = this.ctx.currentTime;
      let anyConnected = false, busy = 0;
      for (const v of (this._pool || [])) {
        if (!v.connected) continue;
        if (v.endTime <= now) {
          try { v.out.disconnect(); } catch(e){}
          v.connected = false;
        } else { anyConnected = true; busy++; }
      }
      window._omniPerf.currentVoices = busy;
      if (!anyConnected) { clearInterval(this._poolSweeper); this._poolSweeper = null; }
    }, POOL_SWEEP_MS);
  }

  _panicPool(now) {
    const pool = this._pool;
    if (!pool || pool.length === 0) return;
    for (const v of pool) {
      try {
        v.envGain.gain.cancelScheduledValues(now);
        v.envGain.gain.setValueAtTime(0.0001, now);
      } catch(e){}
      v.endTime = 0;
      v.gen++;
    }
    const gens = pool.map(v => v.gen);
    setTimeout(() => {   // プール全体で1回のみ。この間に再利用されたボイス(gen変化)は触らない
      pool.forEach((v, i) => {
        if (v.gen === gens[i] && v.connected) {
          try { v.out.disconnect(); } catch(e){}
          v.connected = false;
        }
      });
    }, 100);
    window._omniPerf.currentVoices = 0;
  }

  // ボイス切替時: 短いフェードで消してから、プール全体を1回のsetTimeoutで破棄
  _disposePool() {
    const pool = this._pool;
    if (this._poolSweeper) { clearInterval(this._poolSweeper); this._poolSweeper = null; }
    if (!pool || pool.length === 0) return;
    this._pool = [];
    const now = this.ctx.currentTime;
    for (const v of pool) {
      try {
        v.envGain.gain.cancelScheduledValues(now);
        v.envGain.gain.setValueAtTime(Math.max(0.0001, v.envGain.gain.value), now);
        v.envGain.gain.linearRampToValueAtTime(0.0001, now + 0.03);
      } catch(e){}
    }
    setTimeout(() => {
      for (const v of pool) {
        try { v.osc1.stop(); v.osc2.stop(); } catch(e){}
        for (const n of v.nodes) { try { n.disconnect(); } catch(e){} }
        try { v.out.disconnect(); } catch(e){}
        window._omniPerf.nodesDestroyed += v.nodes.length;
        window._omniPerf.poolVoices = Math.max(0, (window._omniPerf.poolVoices || 0) - 1);
      }
    }, 80);
  }

  triggerAttackRelease(noteStr, velocity = 0.6) {
    const lowPower = isLowPowerMode();
    const ctx  = this.ctx;
    const now  = ctx.currentTime;

    // ── LOW POWER: 発音レート自体のゲート（cap判定より前に行う） ────────────
    // ここで弾くことで、以降のcap判定・voice steal処理・ノード生成が
    // 一切走らなくなる（間引きコストそのものをゼロにする）。
    if (lowPower) {
      if (this._lastTriggerTime != null && (now - this._lastTriggerTime) < MIN_TRIGGER_INTERVAL_LOW) {
        return;
      }
      this._lastTriggerTime = now;
    }

    // ── LOW POWER: ボイスプール経路（ノード生成/破棄なし） ──────────────────
    if (lowPower) {
      this._triggerPooled(noteStr, velocity);
      return;
    }

    // ── 同時発音数の安全上限チェック（通常演奏では発火しない） ──────────────
    if (this._activeVoices.length >= getMaxActiveVoices()) {
      this._stealOldestVoice();
    }

    const freq = noteToFrequency(noteStr) * tuneRatio();
    const peak = this.gainVal * velocity;

    // クリックノイズ防止: attack最低8ms保証 + exponentialRampで滑らかな立ち上がり
    const safeAttack = Math.max(0.008, this.attack);

    let nodesCreated = 0;

    // ── Voice1/Voice2のミックス比（v1.5.21最適化） ──────────────────────────
    // 従来はosc1・osc2それぞれに専用のmix1/mix2 GainNodeで0.68/0.04倍して
    // からenvGainへ合流させていたが、mix1（osc1側）は「envGainの目標振幅
    // 自体を0.68倍しておく」ことで省略できる（envGainはosc1を直結で
    // 受け取り、その合計をenベロープ倍率で増幅するため、目標値を先に0.68倍
    // しておけば数式上mix1を挟んだ場合と完全に同じ出力になる）。
    // osc2側はenvGainに対する相対比（0.04/0.68）のGainNode(mix2)のみ残す。
    // 出力波形は従来と1サンプルも変わらず、ノードを1個節約できる。
    const MIX1 = 0.68, MIX2 = 0.04;
    const safePeak = Math.max(0.0001, peak * MIX1);
    const envGain = ctx.createGain(); nodesCreated++;
    envGain.gain.setValueAtTime(0.0001, now);
    envGain.gain.exponentialRampToValueAtTime(safePeak, now + safeAttack);
    envGain.gain.linearRampToValueAtTime(Math.max(0.0001, safePeak * this.sustain), now + safeAttack + this.decay);
    const releaseStart = now + safeAttack + this.decay + 0.05;
    envGain.gain.setValueAtTime(Math.max(0.0001, safePeak * this.sustain), releaseStart);
    envGain.gain.exponentialRampToValueAtTime(0.0001, releaseStart + this.release);

    // ── Voice1: FM変調ボイス（ヴィブラート） ──
    const osc1  = ctx.createOscillator(); nodesCreated++;
    osc1.type   = this.oscType;
    osc1.frequency.setValueAtTime(freq, now);
    osc1.detune.setValueAtTime((Math.random() - 0.5) * 1.8, now);

    // ビブラートLFO自体はボイス共有（update()で1個だけ生成・常時稼働）。
    // ノートごとに必要なのは深さ調整用のlfoDepthだけ（周波数依存のため
    // ノート固有）。共有LFOにfan-out接続し、ノート終了時はlfoDepthだけを
    // 切断する（共有LFO自体は止めない＝他のノートに影響しない）。
    const lfoDepth = ctx.createGain(); nodesCreated++;
    lfoDepth.gain.value = freq * (this.color.vibratoDepth != null ? this.color.vibratoDepth : VIBRATO_DEPTH);
    this._sharedLfo.connect(lfoDepth);
    lfoDepth.connect(osc1.frequency);

    osc1.connect(envGain);
    osc1.start(now);
    osc1.stop(releaseStart + this.release + 0.1);

    // ── Voice2: ストレートボイス（方形波、揺らぎなし） ──
    const osc2  = ctx.createOscillator(); nodesCreated++;
    const mix2  = ctx.createGain(); nodesCreated++;
    osc2.type   = 'square';
    osc2.frequency.setValueAtTime(freq, now);
    osc2.detune.setValueAtTime((Math.random() - 0.5) * 0.9, now);
    mix2.gain.value = MIX2 / MIX1;

    osc2.connect(mix2);
    mix2.connect(envGain);
    osc2.start(now);
    osc2.stop(releaseStart + this.release + 0.1);

    let output = envGain;
    const allGainNodes = [envGain, mix2, lfoDepth];
    for (const def of this._mainFilters) {
      const filter = ctx.createBiquadFilter(); nodesCreated++;
      filter.type = def.type || 'lowpass';
      filter.frequency.value = def.frequency || 2000;
      filter.Q.value = def.Q || def.q || 0.7;
      output.connect(filter);
      output = filter;
      allGainNodes.push(filter);
    }

    if (this.color.drive && this.color.drive >= 0.02) {
      const shaper = ctx.createWaveShaper(); nodesCreated++;
      shaper.curve = makeSaturationCurve(this.color.drive);
      shaper.oversample = '2x';
      output.connect(shaper);
      output = shaper;
      allGainNodes.push(shaper);
    }

    output.connect(this.nativeDest);

    // ── Sub layer ──────────────────────────────────────────────────────────
    // AUDIO PERFORMANCE MODEがLOW POWERのときはサブレイヤー（トレモロ/
    // ストリングス等の重ね音）を丸ごと省略する。1ノートあたりオシレーター
    // 1個・GainNode/フィルター数個ぶんの負荷を削れる、最も効果の大きい
    // 軽量化ポイントのため（メインのVoice1/Voice2は鳴るので無音にはならない）。
    let subOsc = null;
    let subGainNodes = [];
    if (!lowPower) {
      const sub = this.subColor || {};
      const subOscType = sub.osc || this.oscType;
      const subAttack = Math.max(0.008, sub.attack ?? Math.max(0.02, this.attack * 1.25));
      const subDecay = Math.max(0.08, sub.decay ?? this.decay);
      const subSustain = Math.max(0.04, Math.min(1, sub.sustain ?? Math.max(0.55, this.sustain * 0.85)));
      const subRelease = Math.max(0.05, Math.min(8.0, sub.release ?? this.release));
      // subMix(0.75倍)もenvGainと同じ考え方でsubPeak自体に折り込み、
      // subOscをsubEnvへ直結する（ノードを1個節約、出力は数式上同一）。
      const SUB_MIX = 0.75;
      const subPeak = this.subGainVal * velocity * SUB_MIX;

      subOsc = ctx.createOscillator(); nodesCreated++;
      const subEnv = ctx.createGain(); nodesCreated++;
      subOsc.type = subOscType;
      subOsc.frequency.setValueAtTime(freq, now);
      subOsc.detune.setValueAtTime((Math.random() - 0.5) * 0.75, now);
      subEnv.gain.setValueAtTime(0.0001, now);
      subEnv.gain.exponentialRampToValueAtTime(Math.max(0.0001, subPeak), now + subAttack);
      subEnv.gain.linearRampToValueAtTime(Math.max(0.0001, subPeak * subSustain), now + subAttack + subDecay);
      const subReleaseStart = now + subAttack + subDecay + 0.05;
      subEnv.gain.setValueAtTime(Math.max(0.0001, subPeak * subSustain), subReleaseStart);
      subEnv.gain.exponentialRampToValueAtTime(0.0001, subReleaseStart + subRelease);
      subOsc.connect(subEnv);

      subGainNodes = [subEnv];
      let subOutput = subEnv;
      for (const def of this._subFilters) {
        const filter = ctx.createBiquadFilter(); nodesCreated++;
        filter.type = def.type || 'lowpass';
        filter.frequency.value = def.frequency || 2000;
        filter.Q.value = def.Q || def.q || 0.7;
        subOutput.connect(filter);
        subOutput = filter;
        subGainNodes.push(filter);
      }
      if (sub.drive && sub.drive >= 0.02) {
        const shaper = ctx.createWaveShaper(); nodesCreated++;
        shaper.curve = makeSaturationCurve(sub.drive);
        shaper.oversample = '2x';
        subOutput.connect(shaper);
        subOutput = shaper;
        subGainNodes.push(shaper);
      }
      subOutput.connect(this.nativeDest);
      subOsc.start(now);
      subOsc.stop(subReleaseStart + subRelease + 0.1);
    }

    // ── このノートのボイスをアクティブ追跡配列に登録 ──────────────────────
    // 注: 共有LFO（this._sharedLfo）はここに含めない（stop/disconnectの
    // 対象にしてはいけない — 他の全ノートの変調源を道連れに止めてしまう）。
    const voiceEntry = {
      oscs:  subOsc ? [osc1, osc2, subOsc] : [osc1, osc2],
      gains: [...allGainNodes, ...subGainNodes],
    };
    this._activeVoices.push(voiceEntry);

    // ── パフォーマンスカウンター更新（加算のみ、ほぼ無コスト） ────────────
    const perf = window._omniPerf;
    perf.notesTriggered++;
    perf.nodesCreated += nodesCreated;
    perf.currentVoices = this._activeVoices.length;
    if (perf.currentVoices > perf.maxConcurrentVoices) perf.maxConcurrentVoices = perf.currentVoices;

    // ── 自然終了時に追跡配列から除去 ─────────────────────────────────────
    // v1.5.25: 重大なリーク修正。従来はここで envGain と lfoDepth の
    // 2つしかdisconnect()していなかった。mix2・フィルター（allGainNodesの
    // 残り）は「voice stealで間引かれた場合」の後片付け（_stealOldestVoice
    // のsetTimeoutコールバック）でしか正しくdisconnectされておらず、
    // 上限に達せず自然に鳴り終えたノートではフィルター等が永久に
    // 接続されたまま残っていた。BiquadFilterNodeは入力が無音でも
    // 出力先（nativeDest）へ経路が繋がっている限り毎レンダークォンタム
    // 処理され続けるため、演奏時間が長くなるほどこの「孤児フィルター」が
    // 積み重なり、オーディオスレッドの負荷がじわじわ増えていく——
    // このバグはv1.4時代のオリジナル実装から存在しており、AUDIO
    // PERFORMANCE MODEの新旧いずれにも（HIGH QUALITY/LOW POWER両方に）
    // 影響していた。voice stealパスと同じく allGainNodes 全体を
    // disconnectするよう修正した（音・エンベロープ・演奏感には一切影響
    // しない——既に鳴り終わった無音ノードの後片付けを完全にするだけ）。
    osc1.onended = () => {
      if (voiceEntry._stolen) return; // voice steal側で既に全ノード後片付け済み
      // 自然終了ケース: mix2・フィルター類（allGainNodesの残り）も含めて
      // 完全にdisconnectする。
      for (const node of allGainNodes) { try { node.disconnect(); } catch(e){} }
      try { osc1.disconnect(); } catch(e){}
      try { osc2.disconnect(); } catch(e){}
      window._omniPerf.nodesDestroyed += allGainNodes.length;
      const idx = this._activeVoices.indexOf(voiceEntry);
      if (idx !== -1) {
        this._activeVoices.splice(idx, 1);
        window._omniPerf.currentVoices = this._activeVoices.length;
      }
    };
    if (subOsc) {
      subOsc.onended = () => {
        if (voiceEntry._stolen) return; // voice steal側で既に全ノード後片付け済み
        for (const node of subGainNodes) { try { node.disconnect(); } catch(e){} }
        try { subOsc.disconnect(); } catch(e){}
        window._omniPerf.nodesDestroyed += subGainNodes.length;
      };
    }
  }

  releaseAll() {}
  dispose() {
    this._disposePool();
    // ボイス切替時にupdateVoice()から呼ばれる。共有LFO（update()で生成）を
    // 確実に停止・切断しないと、切り替えるたびに孤立したLFOが鳴り続けて
    // 蓄積してしまう。
    if (this._sharedLfo) {
      try { this._sharedLfo.stop(); this._sharedLfo.disconnect(); } catch(e){}
      this._sharedLfo = null;
    }
  }
}


// メインボイスとサブボイスを分離して設計
// サブボイスの種類:
//   'tremolo'   … Tremolo Pulse (omni1専用: AM tremolo)
//   'strings'   … Synth Strings (ゆっくりアタック、長いサスティーン)
//   'strings8'  … Synth Strings Octave Unison (1オクターブ下を重ねる)
//   'pad'       … Mellow Synth Pad (organ専用: 柔らかいパッド)
