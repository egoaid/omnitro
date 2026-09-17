const VOICE_DEFS = {
  omni1: {
    // Main: Mellow Pulse — 柔らかく丸いパルス波。低めのカットオフで温かみを強調
    // Sub:  Tremolo Pulse — AM変調されたパルス。揺れが音色の個性
    label: 'OMNI 1',
    main: {
      osc: 'square',
      attack: 0.022, decay: 0.10, sustain: 0.92, release: 4.0, volume: -10,
      filters: [
        { type: 'highpass', frequency: 80,  Q: 0.5 },
        { type: 'lowpass',  frequency: 2200, Q: 0.65 },  // より丸く・暗め
      ],
      drive: 0.008,
      vibratoRate: 5.3,
      vibratoDepth: 0.0026,
    },
    sub: {
      type: 'tremolo',
      maxPolyphony: 5,
      volumeOffset: 3,            // メインより少し大きく出してトレモロを感じさせる
      vibratoRate: 5.8,           // メインとわずかにずらしてビート感を強化
      filters: [{ type: 'lowpass', frequency: 2000, Q: 0.6 }],
      drive: 0.008,
    },
  },
  omni2: {
    // Main: Mellow Pulse — omni1より少し明るめ。カットオフを上げて輪郭を出す
    // Sub:  Synth Strings — ゆっくり立ち上がるサウトゥース。弦楽器のアンサンブル感
    label: 'OMNI 2',
    main: {
      osc: 'square',
      attack: 0.022, decay: 0.10, sustain: 0.92, release: 4.0, volume: -10,
      filters: [
        { type: 'highpass', frequency: 90,  Q: 0.55 },
        { type: 'lowpass',  frequency: 3000, Q: 0.70 },  // omni1より明るめ
      ],
      drive: 0.010,
      vibratoRate: 5.3,
      vibratoDepth: 0.0022,
    },
    sub: {
      type: 'strings',
      maxPolyphony: 5,
      osc: 'sawtooth',
      attack: 1.1,                // ゆっくり立ち上がるストリングス
      decay: 0.4,
      sustain: 0.72,
      release: 3.2,
      volumeOffset: 0,            // omni1 tremoloより存在感を出す
      filters: [{ type: 'lowpass', frequency: 2400, Q: 0.65 }],
      drive: 0.008,
    },
  },
  harp: {
    label: 'HARP',
    main: {
      osc: 'triangle',
      attack: 0.008, decay: 0.6, sustain: 0.32, release: 4.5, volume: -10,
      filters: [
        { type: 'highpass', frequency: 120, Q: 0.55 },
        { type: 'lowpass', frequency: 3800, Q: 0.55 },
      ],
      drive: 0.005,
    },
    sub:  { type: 'strings', maxPolyphony: 5, osc: 'sawtooth', attack: 0.9, decay: 0.35, sustain: 0.65, release: 3.5, volumeOffset: -3, filters: [{ type: 'lowpass', frequency: 3200, Q: 0.55 }], drive: 0.005 },
  },
  casio: {
    label: 'CASIO',
    main: {
      osc: 'square',
      attack: 0.008, decay: 0.18, sustain: 0.55, release: 1.6, volume: -10,
      filters: [
        { type: 'highpass', frequency: 200, Q: 0.5 },
        { type: 'lowpass', frequency: 1800, Q: 1.2 },
      ],
      drive: 0.02,
      vibratoRate: 0,
      vibratoDepth: 0,
    },
    sub:  { type: 'strings', maxPolyphony: 5, osc: 'square', attack: 0.01, decay: 0.12, sustain: 0.45, release: 1.2, volumeOffset: -6, filters: [{ type: 'lowpass', frequency: 1200, Q: 0.8 }], drive: 0.01 },
  },
  synth: {
    label: 'SYNTH',
    main: {
      osc: 'sawtooth',
      attack: 0.015, decay: 0.25, sustain: 0.82, release: 2.8, volume: -10,
      filters: [
        { type: 'highpass', frequency: 60, Q: 0.5 },
        { type: 'lowpass', frequency: 1600, Q: 2.2 },
      ],
      drive: 0.015,
      vibratoRate: 4.8,
      vibratoDepth: 0.0015,
    },
    sub:  { type: 'strings8', maxPolyphony: 5, osc: 'sawtooth', attack: 0.08, decay: 0.2, sustain: 0.75, release: 2.5, volumeOffset: -2, filters: [{ type: 'lowpass', frequency: 1200, Q: 1.5 }], drive: 0.01 },
  },
  flute: {
    label: 'FLUTE',
    main: {
      osc: 'sine',
      attack: 0.055, decay: 0.12, sustain: 0.88, release: 3.2, volume: -10,
      filters: [
        { type: 'highpass', frequency: 280, Q: 0.6 },
        { type: 'lowpass', frequency: 5500, Q: 0.5 },
      ],
      drive: 0,
      vibratoRate: 5.8,
      vibratoDepth: 0.006,
    },
    sub:  { type: 'strings', maxPolyphony: 5, osc: 'triangle', attack: 1.2, decay: 0.3, sustain: 0.72, release: 3.0, volumeOffset: -5, filters: [{ type: 'lowpass', frequency: 4000, Q: 0.5 }], drive: 0 },
  },
  guitar: {
    label: 'GUITAR',
    main: {
      osc: 'sawtooth',
      attack: 0.008, decay: 0.55, sustain: 0.28, release: 2.8, volume: -10,
      filters: [
        { type: 'highpass', frequency: 90, Q: 0.55 },
        { type: 'lowpass', frequency: 3300, Q: 0.6 },
      ],
      drive: 0.01,
    },
    sub:  { type: 'strings8', maxPolyphony: 5, osc: 'sawtooth', attack: 0.65, decay: 0.25, sustain: 0.62, release: 3.2, volumeOffset: -3, filters: [{ type: 'lowpass', frequency: 3000, Q: 0.55 }], drive: 0.005 },
  },
  'FM piano': {
    label: 'FM PIANO',
    main: {
      osc: 'fmsine',
      attack: 0.008, decay: 0.65, sustain: 0.55, release: 3.6, volume: -10,
      filters: [
        { type: 'highpass', frequency: 110, Q: 0.55 },
        { type: 'lowpass', frequency: 3800, Q: 0.55 },
      ],
      drive: 0.005,
    },
    sub:  { type: 'pad', maxPolyphony: 5, osc: 'triangle', attack: 1.15, decay: 0.4, sustain: 0.70, release: 2.8, volumeOffset: -2, filters: [{ type: 'lowpass', frequency: 2600, Q: 0.55 }], drive: 0 },
  },
  organ: {
    label: 'ORGAN',
    main: {
      osc: 'square',
      attack: 0.012, decay: 0.0, sustain: 1.0, release: 1.8, volume: -10,
      filters: [
        { type: 'highpass', frequency: 110, Q: 0.55 },
        { type: 'lowpass', frequency: 3200, Q: 0.55 },
      ],
      drive: 0.005,
      chorus: { frequency: 3.3, delayTime: 3.1, depth: 0.28, wet: 0.12 },
    },
    sub:  { type: 'strings8', maxPolyphony: 5, osc: 'triangle', attack: 0.55, decay: 0.28, sustain: 0.68, release: 2.8, volumeOffset: -3, filters: [{ type: 'lowpass', frequency: 2800, Q: 0.55 }], drive: 0 },
  },
  vibes: {
    label: 'VIBES',
    main: {
      osc: 'sine',
      attack: 0.008, decay: 1.4, sustain: 0.40, release: 4.5, volume: -10,
      filters: [
        { type: 'highpass', frequency: 130, Q: 0.55 },
        { type: 'lowpass', frequency: 3800, Q: 0.55 },
      ],
      drive: 0,
    },
    sub:  { type: 'strings', maxPolyphony: 5, osc: 'sawtooth', attack: 1.0, decay: 0.4, sustain: 0.65, release: 3.5, volumeOffset: -3, filters: [{ type: 'lowpass', frequency: 3000, Q: 0.55 }], drive: 0 },
  },
};

// 各シンセノードを保持
let tremoloLfo = null;
let tremoloGain = null;
let chorusNode = null;
let subNodes = [];
let voiceColorNodes = [];

function disposeSubNodes() {
  subNodes.forEach(n => { try { n.dispose(); } catch(e){} });
  subNodes = [];
  if (tremoloLfo) { try { tremoloLfo.stop(); tremoloLfo.dispose(); } catch(e){} tremoloLfo = null; }
  if (tremoloGain) { try { tremoloGain.dispose(); } catch(e){} tremoloGain = null; }
  if (chorusNode) { try { chorusNode.dispose(); } catch(e){} chorusNode = null; }
}

function disposeVoiceColorNodes() {
  voiceColorNodes.forEach(n => { try { n.dispose(); } catch(e){} });
  voiceColorNodes = [];
}

function createToneColorChain(profile, dest) {
  const nodes = [];
  const filters = Array.isArray(profile?.filters) ? profile.filters : (profile?.filters ? [profile.filters] : []);

  filters.forEach(def => {
    const filter = new Tone.Filter({
      type: def.type || 'lowpass',
      frequency: def.frequency || 2000,
      Q: def.Q || def.q || 0.7,
      rolloff: def.rolloff || -12,
    });
    nodes.push(filter);
  });

  if (profile?.drive && profile.drive > 0) {
    nodes.push(new Tone.Distortion({ distortion: profile.drive, oversample: '2x' }));
  }

  if (profile?.chorus) {
    const c = new Tone.Chorus(profile.chorus);
    c.start();
    nodes.push(c);
  }

  if (nodes.length === 0) return dest;

  voiceColorNodes.push(...nodes);
  nodes.reduce((prev, node) => {
    if (prev) prev.connect(node);
    return node;
  }, null);
  // dest がネイティブ AudioNode の場合、Tone.js の .connect() ではなく
  // ネイティブの .connect() で接続する（Tone.js → native GainNode の接続を確実にする）
  const lastNode = nodes[nodes.length - 1];
  if (dest instanceof AudioNode) {
    // Tone.js ノードのネイティブ出力ノードを取得して接続
    const nativeOut = lastNode.output instanceof AudioNode
      ? lastNode.output
      : (lastNode._gainNode instanceof AudioNode ? lastNode._gainNode : null);
    if (nativeOut) {
      nativeOut.connect(dest);
    } else {
      lastNode.connect(dest);
    }
  } else {
    lastNode.connect(dest);
  }
  return nodes[0];
}

function normalizeSubDef(subDef) {
  if (!subDef) return { type: 'strings', maxPolyphony: 5 };
  if (typeof subDef === 'string') return { type: subDef, maxPolyphony: 5 };
  return { maxPolyphony: 5, volumeOffset: 0, ...subDef };
}

function scaleEnvelope(spec) {
  return {
    attack: spec.attack ?? 0.02,
    decay: spec.decay ?? 0.1,
    sustain: Math.max(0.04, Math.min(1, (spec.sustain ?? 0.6) * getSustainEnvelopeScale())),
    release: Math.max(0.03, Math.min(8, (spec.release ?? 1.5) * getReleaseEnvelopeScale())),
  };
}

function buildSubVoice(subDef, dest, mainVolDb) {
  const spec = normalizeSubDef(subDef);
  const subType = spec.type;
  const subVol = mainVolDb + (spec.volumeOffset ?? 0);

  if (subType === 'tremolo') {
    const tGain = new Tone.Gain(0.8);
    const chainDest = createToneColorChain(spec, dest);
    // chainDest がネイティブ GainNode の場合はネイティブ接続を使う
    if (chainDest instanceof AudioNode) {
      const tGainNative = tGain.output instanceof AudioNode ? tGain.output
        : (tGain._gainNode instanceof AudioNode ? tGain._gainNode : null);
      if (tGainNative) tGainNative.connect(chainDest);
      else tGain.connect(chainDest);
    } else {
      tGain.connect(chainDest);
    }
    const lfo = new Tone.LFO({ frequency: spec.vibratoRate || 5.5, min: 0.0, max: 1.0, type: 'sine' });
    lfo.connect(tGain.gain);
    lfo.start();
    const poly = new Tone.PolySynth(Tone.Synth, {
      maxPolyphony: spec.maxPolyphony ?? 5,
      oscillator: { type: spec.osc || 'sine' },
      envelope: scaleEnvelope(spec),
      detune: state.tuneCents || 0,
      volume: subVol + 2,
    }).connect(tGain);
    poly._omniBaseVolumeDb = poly.volume.value;
    tremoloLfo = lfo; tremoloGain = tGain;
    subNodes.push(poly, tGain);
    return poly;
  }

  if (subType === 'strings') {
    const poly = new Tone.PolySynth(Tone.Synth, {
      maxPolyphony: spec.maxPolyphony ?? 5,
      oscillator: { type: spec.osc || 'sawtooth' },
      envelope: scaleEnvelope(spec),
      detune: state.tuneCents || 0,
      volume: subVol - 1,
    });
    poly._omniBaseVolumeDb = poly.volume.value;
    poly.connect(createToneColorChain(spec, dest));
    subNodes.push(poly);
    return poly;
  }

  if (subType === 'strings8') {
    const poly = new Tone.PolySynth(Tone.Synth, {
      maxPolyphony: spec.maxPolyphony ?? 5,
      oscillator: { type: spec.osc || 'sawtooth' },
      envelope: scaleEnvelope(spec),
      detune: state.tuneCents || 0,
      volume: subVol - 3,
    });
    poly._omniBaseVolumeDb = poly.volume.value;
    poly.connect(createToneColorChain(spec, dest));
    subNodes.push(poly);
    return poly;
  }

  if (subType === 'pad') {
    const poly = new Tone.PolySynth(Tone.Synth, {
      maxPolyphony: spec.maxPolyphony ?? 5,
      oscillator: { type: spec.osc || 'triangle' },
      envelope: scaleEnvelope(spec),
      detune: state.tuneCents || 0,
      volume: subVol - 2,
    });
    poly._omniBaseVolumeDb = poly.volume.value;
    poly.connect(createToneColorChain(spec, dest));
    subNodes.push(poly);
    return poly;
  }

  return null;
}

function updateVoice(voiceName) {
  const def = VOICE_DEFS[voiceName] || VOICE_DEFS['omni1'];
  const m = def.main;

  if (chordSynth) { chordSynth.releaseAll(); chordSynth.dispose(); }
  if (strumSynth) { strumSynth.releaseAll(); strumSynth.dispose(); }
  if (subSynth && subSynth.releaseAll) subSynth.releaseAll();
  disposeSubNodes();
  disposeVoiceColorNodes();

  // Gainノードが未作成（ensureAudio前）の場合はスキップ
  if (!chordGain) return;

  // ① コード専用 → chordGain (max 8音)
  chordSynth = new Tone.PolySynth(Tone.Synth, {
    maxPolyphony: 8,
    oscillator: { type: m.osc },
    envelope: scaleEnvelope(m),
    detune: state.tuneCents || 0,
    volume: m.volume,
  }).connect(createToneColorChain(m, chordGain));

  // ② ストラム専用: Web Audio APIネイティブノードプール
  // strumTremoloGain経由でトレモロ効果を適用
  strumSynth = new NativeStrumSynth(strumTremoloGain, m);

  // ③ サブボイスは NativeStrumSynth 内部で主音に重ねる
  subSynth = null;
  syncStrumplateVolumes();
}




