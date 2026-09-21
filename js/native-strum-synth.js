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
const MAX_ACTIVE_VOICES = 20;
// voice steal時のフェード時間（クリック音を防ぎつつ素早く間引く）
const VOICE_STEAL_FADE = 0.012;

// ── 軽量パフォーマンスカウンター ────────────────────────────────────────────
// console.logを撒かず、診断オーバーレイ（js/perf-diagnostics.js）が任意の
// タイミングでポーリングして読み取れるようにするための単純なカウンタ集合。
// 加算のみでコストは無視できるレベル。診断オーバーレイを一度も開かなくても
// このカウンタ自体のオーバーヘッドは実質ゼロ。
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
  }

  // ── 真のパニック停止 ─────────────────────────────────────────────────────
  // 全アクティブボイスの OscillatorNode を即時 stop() し、
  // 関連する GainNode / フィルター等を disconnect() して音を物理的に消す。
  panic() {
    const now = this.ctx.currentTime;

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

  triggerAttackRelease(noteStr, velocity = 0.6) {
    // ── 同時発音数の安全上限チェック（通常演奏では発火しない） ──────────────
    if (this._activeVoices.length >= MAX_ACTIVE_VOICES) {
      this._stealOldestVoice();
    }

    const ctx  = this.ctx;
    const now  = ctx.currentTime;
    const freq = noteToFrequency(noteStr) * tuneRatio();
    const peak = this.gainVal * velocity;

    // クリックノイズ防止: attack最低8ms保証 + exponentialRampで滑らかな立ち上がり
    const safeAttack = Math.max(0.008, this.attack);

    let nodesCreated = 0;

    // ── ADSR エンベロープ用のGainNode（2ボイス共有） ──
    const safePeak = Math.max(0.0001, peak);
    const envGain = ctx.createGain(); nodesCreated++;
    envGain.gain.setValueAtTime(0.0001, now);
    envGain.gain.exponentialRampToValueAtTime(safePeak, now + safeAttack);
    envGain.gain.linearRampToValueAtTime(Math.max(0.0001, safePeak * this.sustain), now + safeAttack + this.decay);
    const releaseStart = now + safeAttack + this.decay + 0.05;
    envGain.gain.setValueAtTime(Math.max(0.0001, safePeak * this.sustain), releaseStart);
    envGain.gain.exponentialRampToValueAtTime(0.0001, releaseStart + this.release);

    // ── Voice1: FM変調ボイス（ヴィブラート） ──
    const osc1  = ctx.createOscillator(); nodesCreated++;
    const mix1  = ctx.createGain(); nodesCreated++;
    osc1.type   = this.oscType;
    osc1.frequency.setValueAtTime(freq, now);
    osc1.detune.setValueAtTime((Math.random() - 0.5) * 1.8, now);
    mix1.gain.value = 0.68;

    const lfo      = ctx.createOscillator(); nodesCreated++;
    const lfoDepth = ctx.createGain(); nodesCreated++;
    lfo.type = 'sine';
    lfo.frequency.value = (this.color.vibratoRate != null ? this.color.vibratoRate : VIBRATO_RATE);
    lfoDepth.gain.value = freq * (this.color.vibratoDepth != null ? this.color.vibratoDepth : VIBRATO_DEPTH);
    lfo.connect(lfoDepth);
    lfoDepth.connect(osc1.frequency);
    lfo.start(now);
    lfo.stop(releaseStart + this.release + 0.1);

    osc1.connect(mix1);
    mix1.connect(envGain);
    osc1.start(now);
    osc1.stop(releaseStart + this.release + 0.1);

    // ── Voice2: ストレートボイス（方形波、揺らぎなし） ──
    const osc2  = ctx.createOscillator(); nodesCreated++;
    const mix2  = ctx.createGain(); nodesCreated++;
    osc2.type   = 'square';
    osc2.frequency.setValueAtTime(freq, now);
    osc2.detune.setValueAtTime((Math.random() - 0.5) * 0.9, now);
    mix2.gain.value = 0.04;

    osc2.connect(mix2);
    mix2.connect(envGain);
    osc2.start(now);
    osc2.stop(releaseStart + this.release + 0.1);

    let output = envGain;
    const allGainNodes = [envGain, mix1, mix2, lfoDepth];
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
    const sub = this.subColor || {};
    const subOscType = sub.osc || this.oscType;
    const subAttack = Math.max(0.008, sub.attack ?? Math.max(0.02, this.attack * 1.25));
    const subDecay = Math.max(0.08, sub.decay ?? this.decay);
    const subSustain = Math.max(0.04, Math.min(1, sub.sustain ?? Math.max(0.55, this.sustain * 0.85)));
    const subRelease = Math.max(0.05, Math.min(8.0, sub.release ?? this.release));
    const subPeak = this.subGainVal * velocity;

    const subOsc = ctx.createOscillator(); nodesCreated++;
    const subMix = ctx.createGain(); nodesCreated++;
    const subEnv = ctx.createGain(); nodesCreated++;
    subOsc.type = subOscType;
    subOsc.frequency.setValueAtTime(freq, now);
    subOsc.detune.setValueAtTime((Math.random() - 0.5) * 0.75, now);
    subMix.gain.value = 0.75;
    subEnv.gain.setValueAtTime(0.0001, now);
    subEnv.gain.exponentialRampToValueAtTime(Math.max(0.0001, subPeak), now + subAttack);
    subEnv.gain.linearRampToValueAtTime(Math.max(0.0001, subPeak * subSustain), now + subAttack + subDecay);
    const subReleaseStart = now + subAttack + subDecay + 0.05;
    subEnv.gain.setValueAtTime(Math.max(0.0001, subPeak * subSustain), subReleaseStart);
    subEnv.gain.exponentialRampToValueAtTime(0.0001, subReleaseStart + subRelease);
    subOsc.connect(subMix);
    subMix.connect(subEnv);

    const subGainNodes = [subEnv, subMix];
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

    // ── このノートのボイスをアクティブ追跡配列に登録 ──────────────────────
    const voiceEntry = {
      oscs:  [osc1, lfo, osc2, subOsc],
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
    osc1.onended = () => {
      try { mix1.disconnect(); lfoDepth.disconnect(); envGain.disconnect(); } catch(e){}
      window._omniPerf.nodesDestroyed += 3;
      const idx = this._activeVoices.indexOf(voiceEntry);
      if (idx !== -1) {
        this._activeVoices.splice(idx, 1);
        window._omniPerf.currentVoices = this._activeVoices.length;
      }
    };
    subOsc.onended = () => {
      try { subMix.disconnect(); subEnv.disconnect(); } catch(e){}
      window._omniPerf.nodesDestroyed += 2;
    };
  }

  releaseAll() {}
  dispose()    {}
}


// メインボイスとサブボイスを分離して設計
// サブボイスの種類:
//   'tremolo'   … Tremolo Pulse (omni1専用: AM tremolo)
//   'strings'   … Synth Strings (ゆっくりアタック、長いサスティーン)
//   'strings8'  … Synth Strings Octave Unison (1オクターブ下を重ねる)
//   'pad'       … Mellow Synth Pad (organ専用: 柔らかいパッド)
