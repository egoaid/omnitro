// ─── NATIVE STRUM SYNTH ──────────────────────────────────────────────────────
// OM-84/OM-108の音響物理を再現:
//   Voice1: FM変調（LFOでピッチを±30セント変調）→ 揺らぎのある温かみ
//   Voice2: ストレート方形波（一切揺らぎなし）
//   2つを同時発音 → うなり（ビート現象）= コーラス/フェイジング効果
//
// AM変調（振幅変調）はOrganのみ → RotarySpkr効果
// ストラムのトレモロはこのビート現象で実現するのが正解

// LFO周波数: 約5.5Hz、振幅: ±30セント(=約0.003の周波数比)
const VIBRATO_RATE  = 5.5;   // Hz
const VIBRATO_DEPTH = 0.003; // ±30セント

function makeSaturationCurve(amount) {
  const k = Math.max(1, amount * 10);
  const curve = new Float32Array(44100);
  for (let i = 0; i < curve.length; i++) {
    const x = i * 2 / curve.length - 1;
    curve[i] = ((1 + k) * x) / (1 + k * Math.abs(x));
  }
  return curve;
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

    setTimeout(() => {
      const stopAt = this.ctx.currentTime;
      for (const voice of voicesToDestroy) {
        for (const osc of voice.oscs) {
          try { osc.stop(stopAt); } catch(e){}
          try { osc.disconnect();  } catch(e){}
        }
        for (const node of voice.gains) {
          try { node.disconnect(); } catch(e){}
        }
      }
    }, 100);
  }

  triggerAttackRelease(noteStr, velocity = 0.6) {
    const ctx  = this.ctx;
    const now  = ctx.currentTime;
    const freq = Tone.Frequency(noteStr).toFrequency() * tuneRatio();
    const peak = this.gainVal * velocity;

    // クリックノイズ防止: attack最低8ms保証 + exponentialRampで滑らかな立ち上がり
    const safeAttack = Math.max(0.008, this.attack);

    // ── ADSR エンベロープ用のGainNode（2ボイス共有） ──
    const safePeak = Math.max(0.0001, peak);
    const envGain = ctx.createGain();
    envGain.gain.setValueAtTime(0.0001, now);
    envGain.gain.exponentialRampToValueAtTime(safePeak, now + safeAttack);
    envGain.gain.linearRampToValueAtTime(Math.max(0.0001, safePeak * this.sustain), now + safeAttack + this.decay);
    const releaseStart = now + safeAttack + this.decay + 0.05;
    envGain.gain.setValueAtTime(Math.max(0.0001, safePeak * this.sustain), releaseStart);
    envGain.gain.exponentialRampToValueAtTime(0.0001, releaseStart + this.release);

    // ── Voice1: FM変調ボイス（ヴィブラート） ──
    const osc1  = ctx.createOscillator();
    const mix1  = ctx.createGain();
    osc1.type   = this.oscType;
    osc1.frequency.setValueAtTime(freq, now);
    osc1.detune.setValueAtTime((Math.random() - 0.5) * 1.8, now);
    mix1.gain.value = 0.68;

    const lfo      = ctx.createOscillator();
    const lfoDepth = ctx.createGain();
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
    const osc2  = ctx.createOscillator();
    const mix2  = ctx.createGain();
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
    const filters = Array.isArray(this.color.filters) ? this.color.filters : (this.color.filters ? [this.color.filters] : []);
    filters.forEach(def => {
      const filter = ctx.createBiquadFilter();
      filter.type = def.type || 'lowpass';
      filter.frequency.value = def.frequency || 2000;
      filter.Q.value = def.Q || def.q || 0.7;
      output.connect(filter);
      output = filter;
      allGainNodes.push(filter);
    });

    if (this.color.drive && this.color.drive >= 0.02) {
      const shaper = ctx.createWaveShaper();
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

    const subOsc = ctx.createOscillator();
    const subMix = ctx.createGain();
    const subEnv = ctx.createGain();
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
    const subFilters = Array.isArray(sub.filters) ? sub.filters : (sub.filters ? [sub.filters] : []);
    subFilters.forEach(def => {
      const filter = ctx.createBiquadFilter();
      filter.type = def.type || 'lowpass';
      filter.frequency.value = def.frequency || 2000;
      filter.Q.value = def.Q || def.q || 0.7;
      subOutput.connect(filter);
      subOutput = filter;
      subGainNodes.push(filter);
    });
    if (sub.drive && sub.drive >= 0.02) {
      const shaper = ctx.createWaveShaper();
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

    // ── 自然終了時に追跡配列から除去 ─────────────────────────────────────
    osc1.onended = () => {
      try { mix1.disconnect(); lfoDepth.disconnect(); envGain.disconnect(); } catch(e){}
      const idx = this._activeVoices.indexOf(voiceEntry);
      if (idx !== -1) this._activeVoices.splice(idx, 1);
    };
    subOsc.onended = () => {
      try { subMix.disconnect(); subEnv.disconnect(); } catch(e){}
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

