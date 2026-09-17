// ─── ARRANGEMENT: INTRO / FILL / ENDING ────────────────────────────────────────
//
// 実際のドラマーが曲の頭・フィル・エンディングでその場で演奏するような
// 展開を、単純なランダム配置ではなく「音楽的に妥当なテンプレート」を
// 複数用意し、そこからランダムに選択＋ベロシティ/タイミングを微調整
// （ヒューマナイズ）することで、毎回少しずつ違う自然な演奏に聞こえるように
// 生成する。
//
// 生成したパターンは既存の groove フォーマット（RHYTHM_PATTERNS の1エントリと
// 同じ shape: groove_kick/groove_snare/...）で返すため、既存のシーケンサー
// （normalizeGroovePattern・Tone.Sequence）をそのまま流用できる。
// パターンの差し替えは録音安全性のためにすでに用意されている
// swapRhythmPatternLive()（Tone.Transportを止めずにシーケンスだけ差し替える）
// を使う。これにより、INTRO/FILL/ENDINGの追加が既存のリズム再生・録音の
// タイミング挙動に一切影響しないようにしている。
//
// 使用できるドラムチャンネルは kick/snare/hat/hiop/rim/cowbl/clap/tamb/shkr の
// 9系統（専用のタムチャンネルは存在しない）。フィルではタムの代わりに
// snare（レギュラー+ゴースト）・rim（リムショット）・kick を組み合わせて
// タム回し的な質感を作る。

// ── 汎用ヘルパー ──────────────────────────────────────────────────────────────
function _arrRand(min, max) { return min + Math.random() * (max - min); }
function _arrRandInt(min, max) { return Math.round(_arrRand(min, max)); }
function _arrPick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function _arrChance(p) { return Math.random() < p; }

function _arrEmptyGroove() {
  return {
    groove_kick: [], groove_snare: [], groove_hat: [], groove_hiop: [],
    groove_rim: [], groove_cowbl: [], groove_clap: [], groove_tamb: [], groove_shkr: [],
    swing: 0, beats: 4,
  };
}

// イベント配列に軽いランダム揺らぎを加える。テンプレートの骨格は同じでも、
// 毎回わずかにベロシティ・タイミングが変わり、単調な繰り返しに聞こえないようにする。
function _arrHumanize(events, velJitter, offsetJitterMs) {
  return events.map(e => ({
    ...e,
    vel: Math.max(0.05, Math.min(1.0, e.vel + _arrRand(-velJitter, velJitter))),
    offset: Math.round((e.offset || 0) + _arrRand(-offsetJitterMs, offsetJitterMs)),
  }));
}

function _arrHumanizeGroove(g) {
  g.groove_kick  = _arrHumanize(g.groove_kick,  0.05, 6);
  g.groove_snare = _arrHumanize(g.groove_snare, 0.06, 6);
  g.groove_hat   = _arrHumanize(g.groove_hat,   0.05, 5);
  g.groove_hiop  = _arrHumanize(g.groove_hiop,  0.05, 5);
  g.groove_rim   = _arrHumanize(g.groove_rim,   0.06, 6);
  g.groove_cowbl = _arrHumanize(g.groove_cowbl, 0.05, 5);
  g.groove_clap  = _arrHumanize(g.groove_clap,  0.05, 5);
  return g;
}

// ─── INTRO 生成 ─────────────────────────────────────────────────────────────
// 1小節（16ステップ）。8種類の基本型 × アクセント楽器のランダム選択などを
// 組み合わせることで、体感で20通り以上の違いが感じられるようにしている。
function generateIntroPattern() {
  const g = _arrEmptyGroove();
  const shape = _arrPick(['count', 'buildup', 'pickup', 'cowbellCount',
                          'sixteenthBuild', 'tomRunPickup', 'openHatSwell', 'syncoKickPickup']);
  const accent = _arrPick(['cowbl', 'clap', 'hiop']);

  if (shape === 'count') {
    // 静かな4分打ちのカウントイン → 最後に軽いピックアップ
    for (let s = 0; s <= 12; s += 4) {
      g.groove_hat.push({ step: s, vel: 0.32 + s * 0.01, offset: 0, prob: 1.0 });
    }
    g.groove_kick.push({ step: 0, vel: 0.55, offset: 0, prob: 1.0 });
    if (_arrChance(0.7)) g.groove_snare.push({ step: 14, vel: 0.5, offset: 4, prob: 1.0 });
    g['groove_' + accent].push({ step: 15, vel: 0.5, offset: 0, prob: 0.8 });

  } else if (shape === 'buildup') {
    // ハット8分が徐々に強くなり、後半でキック/リムが加わってアクセントへ
    for (let s = 0; s < 16; s += 2) {
      const t = s / 14;
      g.groove_hat.push({ step: s, vel: 0.28 + t * 0.35, offset: _arrRandInt(-4, 4), prob: 1.0 });
    }
    g.groove_kick.push({ step: 0, vel: 0.7, offset: 0, prob: 1.0 });
    g.groove_kick.push({ step: 8, vel: 0.6, offset: 0, prob: 0.85 });
    if (_arrChance(0.6)) g.groove_rim.push({ step: 10, vel: 0.4, offset: 0, prob: 0.6 });
    if (_arrChance(0.6)) g.groove_rim.push({ step: 12, vel: 0.5, offset: 0, prob: 0.7 });
    g.groove_snare.push({ step: 14, vel: 0.65, offset: 0, prob: 0.9 });
    g.groove_snare.push({ step: 15, vel: 0.85, offset: 0, prob: 1.0 });
    if (_arrChance(0.5)) g['groove_' + accent].push({ step: 15, vel: 0.5, offset: 0, prob: 1.0 });

  } else if (shape === 'pickup') {
    // スネアロールで畳み掛けてから開始
    const rollStart = _arrPick([8, 10, 12]);
    let vel = 0.25;
    for (let s = rollStart; s < 16; s++) {
      vel += (0.85 - 0.25) / (16 - rollStart);
      const ghost = s < 14;
      g.groove_snare.push({ step: s, vel: Math.min(0.9, vel), offset: _arrRandInt(-3, 3), prob: ghost ? 0.85 : 1.0, ghost });
    }
    g.groove_kick.push({ step: 0, vel: 0.6, offset: 0, prob: 1.0 });

  } else if (shape === 'cowbellCount') {
    // カウベル主体のカウントイン（ラテン風の入り方）
    for (let s = 0; s <= 12; s += 4) {
      g.groove_cowbl.push({ step: s, vel: 0.4 + s * 0.01, offset: 0, prob: 1.0 });
    }
    g.groove_kick.push({ step: 0, vel: 0.6, offset: 0, prob: 1.0 });
    g.groove_kick.push({ step: 8, vel: 0.5, offset: 0, prob: 0.7 });
    if (_arrChance(0.6)) g.groove_rim.push({ step: 6, vel: 0.35, offset: 0, prob: 0.6 });
    if (_arrChance(0.6)) g.groove_rim.push({ step: 14, vel: 0.4, offset: 0, prob: 0.6 });
    g.groove_snare.push({ step: 15, vel: 0.75, offset: 0, prob: 1.0 });

  } else if (shape === 'sixteenthBuild') {
    // 16分ハットで密に埋めてから一気に開ける（buildupよりも忙しい入り）
    for (let s = 0; s < 16; s++) {
      const t = s / 15;
      if (_arrChance(0.55 + t * 0.4)) {
        g.groove_hat.push({ step: s, vel: 0.22 + t * 0.45, offset: _arrRandInt(-3, 3), prob: 1.0 });
      }
    }
    g.groove_kick.push({ step: 0, vel: 0.7, offset: 0, prob: 1.0 });
    g.groove_kick.push({ step: 6, vel: 0.55, offset: 0, prob: _arrChance(0.6) ? 1.0 : 0 });
    g.groove_snare.push({ step: 15, vel: 0.9, offset: 0, prob: 1.0 });
    g['groove_' + accent].push({ step: 15, vel: 0.55, offset: 0, prob: 0.9 });

  } else if (shape === 'tomRunPickup') {
    // キック・リム・スネアの往復でタム回し風のピックアップ
    const seq = [
      { s: 6,  ch: 'kick',  v: 0.5 }, { s: 8,  ch: 'rim',  v: 0.5 },
      { s: 9,  ch: 'rim',   v: 0.55 }, { s: 10, ch: 'snare', v: 0.6 },
      { s: 11, ch: 'rim',   v: 0.6 }, { s: 12, ch: 'kick',  v: 0.65 },
      { s: 13, ch: 'snare', v: 0.7 }, { s: 14, ch: 'rim',  v: 0.75 },
      { s: 15, ch: 'snare', v: 0.95 },
    ];
    seq.forEach(p => g['groove_' + p.ch].push({ step: p.s, vel: p.v, offset: _arrRandInt(-4, 4), prob: 1.0 }));
    g.groove_kick.push({ step: 0, vel: 0.55, offset: 0, prob: 1.0 });

  } else if (shape === 'openHatSwell') {
    // クローズハットからオープンハットへ滑らかに膨らむ
    for (let s = 0; s < 12; s += 2) g.groove_hat.push({ step: s, vel: 0.3 + s * 0.02, offset: 0, prob: 1.0 });
    g.groove_kick.push({ step: 0, vel: 0.65, offset: 0, prob: 1.0 });
    g.groove_kick.push({ step: 8, vel: 0.55, offset: 0, prob: 0.8 });
    g.groove_hiop.push({ step: 12, vel: 0.5, offset: 0, prob: 1.0 });
    g.groove_hiop.push({ step: 14, vel: 0.75, offset: 0, prob: 1.0 });
    g.groove_snare.push({ step: 15, vel: 0.85, offset: 0, prob: 1.0 });

  } else { // syncoKickPickup: シンコペーションしたキック/リムでの静かな入り
    const positions = [0, 3, 6, 9, 11, 14];
    positions.forEach((s, i) => {
      const ch = i % 2 === 0 ? 'kick' : 'rim';
      g['groove_' + ch].push({ step: s, vel: 0.4 + i * 0.08, offset: _arrRandInt(-4, 4), prob: 1.0 });
    });
    g.groove_snare.push({ step: 15, vel: 0.8, offset: 0, prob: 1.0 });
  }

  return _arrHumanizeGroove(g);
}

// ─── FILL 生成 ──────────────────────────────────────────────────────────────
// 1小節（16ステップ）。8種類の基本型 × アクセント楽器/密度のランダム選択で
// 体感20通り以上のバリエーションを出す。前半は現在のグルーヴの雰囲気を
// 保ちつつ、後半でフィルらしい畳み掛けを入れる構成を基本にしている。
function generateFillPattern() {
  const g = _arrEmptyGroove();
  const shape = _arrPick(['snareRoll', 'altKickSnareRim', 'syncoBuild', 'halfBarBreak',
                          'doubleKickAccent', 'rimClimb', 'tripletFeel', 'spaceAndSlam']);
  const accent = _arrPick(['cowbl', 'clap', 'hiop']);

  if (shape === 'snareRoll') {
    // 前半は普通のグルーヴを維持し、後半（8-15）でスネアロールを畳み掛ける
    for (let s = 0; s < 8; s += 2) g.groove_hat.push({ step: s, vel: 0.4, offset: 0, prob: 0.9 });
    g.groove_kick.push({ step: 0, vel: 0.8, offset: 0, prob: 1.0 });
    if (_arrChance(0.5)) g.groove_kick.push({ step: 6, vel: 0.5, offset: 0, prob: 1.0 });
    const rollStart = _arrPick([8, 9, 10]);
    let vel = 0.3;
    for (let s = rollStart; s <= 15; s++) {
      vel += (0.95 - 0.3) / (16 - rollStart);
      g.groove_snare.push({ step: s, vel: Math.min(1.0, vel), offset: _arrRandInt(-4, 4), prob: 1.0, ghost: s < 13 });
    }

  } else if (shape === 'altKickSnareRim') {
    // 前半は通常どおり、後半（12-15）でキック・スネア・リムを細かく掛け合う
    // （タムの代用としてリムショットを使い、タム回しに近い質感を出す）
    for (let s = 0; s < 12; s += 2) g.groove_hat.push({ step: s, vel: 0.4, offset: 0, prob: 0.85 });
    g.groove_kick.push({ step: 0, vel: 0.8, offset: 0, prob: 1.0 });
    g.groove_snare.push({ step: 4, vel: 0.7, offset: 0, prob: 1.0 });
    const combos = [
      [{ ch: 'kick',  v: 0.7 }, { ch: 'rim', v: 0.6 }],
      [{ ch: 'snare', v: 0.75 }],
      [{ ch: 'rim',   v: 0.65 }, { ch: 'kick', v: 0.6 }],
      [{ ch: 'snare', v: 0.9 }, { ch: 'kick', v: 0.85 }, { ch: accent, v: 0.5 }],
    ];
    [12, 13, 14, 15].forEach((s, i) => {
      combos[i].forEach(hit => {
        g['groove_' + hit.ch].push({ step: s, vel: hit.v, offset: _arrRandInt(-4, 4), prob: 1.0 });
      });
    });

  } else if (shape === 'syncoBuild') {
    // 全体を通してシンコペーションが徐々に密になっていくフィル
    const density = [0.30,0.15,0.40,0.20,0.50,0.25,0.55,0.30,0.60,0.35,0.65,0.40,0.75,0.50,0.85,0.60];
    for (let s = 0; s < 16; s++) {
      if (_arrChance(density[s])) {
        const ch = _arrPick(['snare', 'rim', 'kick']);
        g['groove_' + ch].push({ step: s, vel: 0.4 + density[s] * 0.5, offset: _arrRandInt(-5, 5), prob: 1.0, ghost: density[s] < 0.4 });
      }
    }
    g.groove_snare.push({ step: 15, vel: 0.95, offset: 0, prob: 1.0 });
    g.groove_kick.push({ step: 15, vel: 0.85, offset: 0, prob: 1.0 });

  } else if (shape === 'halfBarBreak') {
    // 後半でブレイク的に細かく崩してラストで着地
    for (let s = 0; s < 8; s += 2) g.groove_hat.push({ step: s, vel: 0.4, offset: 0, prob: 0.85 });
    g.groove_kick.push({ step: 0, vel: 0.8, offset: 0, prob: 1.0 });
    const pat = [
      { s: 8,  ch: 'snare', v: 0.6 }, { s: 9,  ch: 'rim',   v: 0.5 },
      { s: 10, ch: 'rim',   v: 0.55 }, { s: 11, ch: 'snare', v: 0.65 },
      { s: 12, ch: 'kick',  v: 0.7 }, { s: 12, ch: 'rim',   v: 0.5 },
      { s: 13, ch: 'snare', v: 0.75 }, { s: 14, ch: 'snare', v: 0.85 },
      { s: 15, ch: 'snare', v: 1.0 },
    ];
    pat.forEach(p => g['groove_' + p.ch].push({ step: p.s, vel: p.v, offset: _arrRandInt(-4, 4), prob: 1.0 }));
    g.groove_kick.push({ step: 15, vel: 0.9, offset: 0, prob: 1.0 });
    if (_arrChance(0.6)) g['groove_' + accent].push({ step: 15, vel: 0.5, offset: 0, prob: 1.0 });

  } else if (shape === 'doubleKickAccent') {
    // キックの連打（フラム風）を軸にした、シンプルだが力強いフィル
    for (let s = 0; s < 8; s += 2) g.groove_hat.push({ step: s, vel: 0.4, offset: 0, prob: 0.85 });
    g.groove_kick.push({ step: 0, vel: 0.8, offset: 0, prob: 1.0 });
    [8, 9, 10, 11].forEach(s => g.groove_kick.push({ step: s, vel: 0.55 + (s - 8) * 0.08, offset: _arrRandInt(-3, 3), prob: 0.9 }));
    g.groove_snare.push({ step: 12, vel: 0.7, offset: 0, prob: 1.0 });
    g.groove_snare.push({ step: 14, vel: 0.8, offset: 0, prob: 1.0 });
    g.groove_kick.push({ step: 15, vel: 1.0, offset: 0, prob: 1.0 });
    g.groove_snare.push({ step: 15, vel: 0.9, offset: 0, prob: 1.0 });

  } else if (shape === 'rimClimb') {
    // リムショットが上昇していくような密度で駆け上がるフィル（タム回しの代替）
    for (let s = 0; s < 6; s += 2) g.groove_hat.push({ step: s, vel: 0.4, offset: 0, prob: 0.85 });
    g.groove_kick.push({ step: 0, vel: 0.8, offset: 0, prob: 1.0 });
    let rv = 0.35;
    for (let s = 6; s <= 15; s++) {
      rv += (1.0 - 0.35) / (15 - 6);
      const ch = (s === 15) ? 'snare' : (s % 3 === 0 ? 'kick' : 'rim');
      g['groove_' + ch].push({ step: s, vel: Math.min(1.0, rv), offset: _arrRandInt(-4, 4), prob: 1.0 });
    }

  } else if (shape === 'tripletFeel') {
    // 3連符的なうねりをoffsetで近似したフィル（後半にまとめて配置）
    const triSteps = [8, 9.33, 10.66, 12, 13.33, 14.66];
    triSteps.forEach((ts, i) => {
      const s = Math.round(ts);
      const offsetMs = Math.round((ts - s) * 30); // 16分グリッドからのズレをoffsetで表現
      const ch = i % 2 === 0 ? 'snare' : 'rim';
      g['groove_' + ch].push({ step: Math.max(0, Math.min(15, s)), vel: 0.5 + i * 0.08, offset: offsetMs, prob: 1.0 });
    });
    g.groove_kick.push({ step: 0, vel: 0.8, offset: 0, prob: 1.0 });
    g.groove_kick.push({ step: 15, vel: 1.0, offset: 0, prob: 1.0 });
    g.groove_snare.push({ step: 15, vel: 0.9, offset: 0, prob: 1.0 });

  } else { // spaceAndSlam: 前半を思い切って空けて、後半に一気に叩き込む
    g.groove_kick.push({ step: 0, vel: 0.8, offset: 0, prob: 1.0 });
    if (_arrChance(0.5)) g.groove_hat.push({ step: 4, vel: 0.3, offset: 0, prob: 0.6 });
    [11, 12, 13, 14].forEach((s, i) => {
      g.groove_snare.push({ step: s, vel: 0.5 + i * 0.13, offset: _arrRandInt(-3, 3), prob: 1.0, ghost: i === 0 });
    });
    g.groove_kick.push({ step: 15, vel: 1.0, offset: 0, prob: 1.0 });
    g.groove_snare.push({ step: 15, vel: 1.0, offset: 0, prob: 1.0 });
    g['groove_' + accent].push({ step: 15, vel: 0.6, offset: 0, prob: 1.0 });
  }

  return _arrHumanizeGroove(g);
}

// ─── ENDING 生成 ────────────────────────────────────────────────────────────
// 1小節（16ステップ）。5種類の基本型 × 最終アクセントの楽器編成の
// ランダム選択で、体感20通り以上のバリエーションを出す。
function generateEndingPattern() {
  const g = _arrEmptyGroove();
  const shape = _arrPick(['finalHit', 'ritardando', 'bigBuildFinal', 'stutterStop', 'crashSwell']);
  // 最終アクセントの楽器編成もランダム化（毎回少し違う「締め」に聞こえるように）
  const finalKit = _arrPick([
    ['kick', 'snare', 'cowbl', 'hiop'],
    ['kick', 'snare', 'clap', 'hiop'],
    ['kick', 'snare', 'cowbl', 'clap'],
    ['kick', 'snare', 'hiop'],
  ]);

  if (shape === 'finalHit') {
    for (let s = 0; s < 8; s += 2) g.groove_hat.push({ step: s, vel: 0.45, offset: 0, prob: 0.9 });
    g.groove_kick.push({ step: 0, vel: 0.85, offset: 0, prob: 1.0 });
    g.groove_snare.push({ step: 4, vel: 0.8, offset: 0, prob: 1.0 });
    g.groove_kick.push({ step: 8, vel: 0.7, offset: 0, prob: 0.8 });
    if (_arrChance(0.6)) g.groove_snare.push({ step: 10, vel: 0.6, offset: 0, prob: 1.0 });
    [12, 13, 14].forEach((s, i) => {
      g.groove_snare.push({ step: s, vel: 0.6 + i * 0.12, offset: _arrRandInt(-3, 3), prob: 1.0, ghost: i === 0 });
    });

  } else if (shape === 'ritardando') {
    // だんだん間隔が空いていくイメージ
    g.groove_hat.push({ step: 0, vel: 0.5, offset: 0, prob: 1.0 });
    g.groove_kick.push({ step: 0, vel: 0.85, offset: 0, prob: 1.0 });
    g.groove_snare.push({ step: 2, vel: 0.55, offset: 0, prob: 1.0 });
    g.groove_hat.push({ step: 4, vel: 0.5, offset: 0, prob: 1.0 });
    g.groove_snare.push({ step: 6, vel: 0.6, offset: 0, prob: 1.0 });
    g.groove_kick.push({ step: 8, vel: 0.75, offset: 0, prob: 1.0 });
    g.groove_snare.push({ step: 11, vel: 0.7, offset: 0, prob: 1.0 });

  } else if (shape === 'bigBuildFinal') {
    // 小節全体を通してだんだん密になっていくクレッシェンド
    for (let s = 0; s < 16; s++) {
      const t = s / 15;
      if (_arrChance(0.25 + t * 0.6)) {
        const ch = _arrPick(['hat', 'snare', 'kick']);
        g['groove_' + ch].push({ step: s, vel: 0.3 + t * 0.55, offset: _arrRandInt(-4, 4), prob: 1.0, ghost: t < 0.4 });
      }
    }
    g.groove_kick.push({ step: 0, vel: 0.85, offset: 0, prob: 1.0 });

  } else if (shape === 'stutterStop') {
    // 短いスタッター（つっかえ）を挟んでから最後にビシッと止まる
    g.groove_kick.push({ step: 0, vel: 0.85, offset: 0, prob: 1.0 });
    g.groove_snare.push({ step: 4, vel: 0.8, offset: 0, prob: 1.0 });
    g.groove_kick.push({ step: 8, vel: 0.75, offset: 0, prob: 1.0 });
    [9, 10].forEach(s => g.groove_rim.push({ step: s, vel: 0.5, offset: _arrRandInt(-3, 3), prob: 0.9 }));
    // 一瞬の間（11-12は空白）を作ってから畳み掛ける
    [13, 14].forEach((s, i) => {
      g.groove_snare.push({ step: s, vel: 0.7 + i * 0.15, offset: _arrRandInt(-3, 3), prob: 1.0 });
    });

  } else { // crashSwell: オープンハットの膨らみからフィナーレへ
    g.groove_kick.push({ step: 0, vel: 0.85, offset: 0, prob: 1.0 });
    g.groove_snare.push({ step: 4, vel: 0.75, offset: 0, prob: 1.0 });
    g.groove_kick.push({ step: 8, vel: 0.7, offset: 0, prob: 0.85 });
    g.groove_hiop.push({ step: 10, vel: 0.5, offset: 0, prob: 1.0 });
    g.groove_hiop.push({ step: 12, vel: 0.7, offset: 0, prob: 1.0 });
    g.groove_snare.push({ step: 13, vel: 0.75, offset: 0, prob: 1.0 });
    g.groove_snare.push({ step: 14, vel: 0.85, offset: 0, prob: 1.0 });
  }

  // 最終アクセント：ランダムに選んだ楽器編成を同時に鳴らして締める
  finalKit.forEach(ch => {
    const vel = ch === 'kick' || ch === 'snare' ? 1.0 : (ch === 'hiop' ? 0.9 : 0.7);
    g['groove_' + ch].push({ step: 15, vel, offset: 0, prob: 1.0 });
  });

  return _arrHumanizeGroove(g);
}

// ─── オーケストレーション（開始/停止/フィル発動の制御） ─────────────────────────
const arrangementState = {
  introEnabled:  false,
  fillEnabled:   true,
  endingEnabled: false,
  mode: 'stopped',       // 'stopped' | 'intro' | 'main' | 'fill' | 'ending'
  fillScheduled: false,
};

// 現在の「本編」パターンを取得する（RHYTHM EDITORで編集中/ロード中の内容）
function _arrCurrentMainPattern() {
  return RHYTHM_PATTERNS['user__editor']
      || RHYTHM_PATTERNS[document.getElementById('rhythm-select').value]
      || RHYTHM_PATTERNS['lofi01'];
}

// 3画面（トップ/RHYTHM EDITOR/KIT EDITOR）のRHYTHM関連ボタン表示を同期する
function _arrSyncButtonsUI(playing, transitioning) {
  const mainBtn = document.getElementById('play-btn');
  if (mainBtn) {
    mainBtn.textContent = playing ? (transitioning ? '…' : 'STOP') : 'RHYTHM';
    mainBtn.classList.toggle('playing', !!playing);
  }
  const reditorBtn = document.getElementById('reditor-play-btn');
  if (reditorBtn) {
    reditorBtn.textContent = playing ? ('■ ' + (transitioning ? '…' : 'STOP')) : '▶ PLAY';
    reditorBtn.style.borderColor = playing ? 'var(--accent2)' : 'var(--accent3)';
    reditorBtn.style.color = playing ? 'var(--accent2)' : 'var(--accent3)';
  }
  const kitBtn = document.getElementById('kit-play-btn');
  if (kitBtn) {
    kitBtn.textContent = playing ? '■ STOP' : '▶ PLAY';
    kitBtn.style.background = playing ? '#0a2a10' : '#0a1810';
  }
  const fillBtn = document.getElementById('fill-btn');
  if (fillBtn) fillBtn.style.display = (playing && arrangementState.fillEnabled) ? 'flex' : 'none';
  const fillBtnReditor = document.getElementById('fill-btn-reditor');
  if (fillBtnReditor) fillBtnReditor.style.display = (playing && arrangementState.fillEnabled) ? 'inline-block' : 'none';
  const fillBtnKit = document.getElementById('fill-btn-kit');
  if (fillBtnKit) fillBtnKit.style.display = (playing && arrangementState.fillEnabled) ? 'inline-block' : 'none';

  // 再生が止まった場合は、FILL/RANDOMの実行中表示も必ず解除する
  if (!playing) {
    _setFillButtonsState('idle');
    setRandomizePendingUI(false);
  }
}

// ── FILLボタンの状態表示 ─────────────────────────────────────────────────────
// 'idle'   : 通常表示
// 'queued' : 次の小節境界への切り替えを待っている（ゆっくり明滅）
// 'active' : FILLを実際に演奏中（速い明滅＋発光）
function _setFillButtonsState(uiState) {
  ['fill-btn', 'fill-btn-reditor', 'fill-btn-kit'].forEach(id => {
    const btn = document.getElementById(id);
    if (!btn) return;
    btn.classList.remove('fill-queued', 'fill-active');
    if (uiState === 'queued') btn.classList.add('fill-queued');
    else if (uiState === 'active') btn.classList.add('fill-active');
  });
}

// ── RANDOM/HUMANIZEの実行中表示 ───────────────────────────────────────────────
// RHYTHM再生中にRHYTHM EDITORのRANDOM/HUMANIZEを使うと、次の小節境界まで
// 切り替えが待機される（詳細はpiano-roll.jsのapplyEditorPatternRTDeferred
// 参照）。その待機中であることを、3画面すべてのPLAYボタンを紫色に明滅
// させて示す。
function setRandomizePendingUI(pending) {
  ['play-btn', 'reditor-play-btn', 'kit-play-btn'].forEach(id => {
    const btn = document.getElementById(id);
    if (btn) btn.classList.toggle('randomize-pending', !!pending);
  });
}

async function startRhythmArrangement() {
  if (state.isPlaying) return;
  await ensureAudio();
  if (!kickSynth) initDrums();

  state.isPlaying = true;

  if (arrangementState.introEnabled) {
    arrangementState.mode = 'intro';
    startRhythm(generateIntroPattern());
    // イントロを開始してから丸1小節後にMAINへ切り替える（Transportは止めない）。
    // n=2としているのは、シーケンス開始直後にステップ0がほぼ即座に発火する
    // （それが1回目）ため、1周してきた本当の小節境界（2回目）を待つため。
    waitBars(2, () => {
      if (arrangementState.mode !== 'intro') return; // 途中で停止/別操作されていたら何もしない
      arrangementState.mode = 'main';
      swapRhythmPatternLive(_arrCurrentMainPattern());
    });
  } else {
    arrangementState.mode = 'main';
    startRhythm();
  }

  _arrSyncButtonsUI(true, false);
}

function stopRhythmArrangement() {
  if (!state.isPlaying) return;
  if (arrangementState.mode === 'ending') return; // 既にエンディング進行中

  if (arrangementState.endingEnabled) {
    arrangementState.mode = 'ending';
    _arrSyncButtonsUI(true, true);
    // ★重要★ 今鳴っている小節が終わるのを待ってからENDINGへ切り替える。
    // 以前は停止ボタンを押した瞬間に即座に切り替えていたため、小節の途中で
    // 唐突にENDINGが始まりテンポ感が崩れて聞こえる不具合があった。
    // waitBars(1, ...) で「次の小節の頭」まで待つことで、今流れている
    // MAINパターンの現在の小節を最後まで自然に鳴らしきってから
    // ENDINGへ切り替わるようにしている。
    waitBars(1, () => {
      if (arrangementState.mode !== 'ending') return; // 待機中に別操作されていたら何もしない
      swapRhythmPatternLive(generateEndingPattern());
      // ENDINGを開始してから丸1小節後に実際に停止する（理由はstartと同じくn=2）
      waitBars(2, () => {
        if (arrangementState.mode !== 'ending') return;
        _reallyStopRhythmArrangement();
      });
    });
  } else {
    _reallyStopRhythmArrangement();
  }
}

function _reallyStopRhythmArrangement() {
  arrangementState.mode = 'stopped';
  state.isPlaying = false;
  arrangementState.fillScheduled = false;
  stopRhythm();
  _arrSyncButtonsUI(false, false);
}

function toggleRhythmArrangement() {
  if (state.isPlaying) stopRhythmArrangement();
  else startRhythmArrangement();
}

// FILLを次の小節の頭から発動する。既にfill/intro/ending中、または
// FILL機能がOFFの場合は何もしない（二重発動もガードする）。
//
// ★重要★ 以前は Tone.Transport.nextSubdivision('1m')（Transportの絶対的な
// 小節グリッド基準）で次の小節境界を計算していたが、swapRhythmPatternLive()に
// よるパターン差し替え（通常の編集操作やKIT変更など、小節境界と無関係な
// タイミングで発生し得る）が起こると、実際に鳴っているシーケンスの位相が
// Transportの絶対グリッドとズレてしまい、フィルが正しいタイミングで
// 発動しない・発動してもズレて聞こえて分かりにくい、という不具合の原因に
// なっていた。waitBars() は実際に鳴っているシーケンス自身の「ステップ0」を
// 直接カウントするため、過去にどんな差し替えがあっても常に正確に発動する。
function triggerFill() {
  if (!arrangementState.fillEnabled) {
    console.log('[FILL] FILL設定がOFFのため発動しません');
    return;
  }
  if (!state.isPlaying) {
    console.log('[FILL] RHYTHM再生中でないため発動しません');
    return;
  }
  if (arrangementState.mode !== 'main') {
    console.log('[FILL] 現在MAIN以外のモード（' + arrangementState.mode + '）のため発動しません');
    return;
  }
  if (arrangementState.fillScheduled) {
    console.log('[FILL] 既にFILLが予約済みのため無視します');
    return;
  }
  arrangementState.fillScheduled = true;
  _setFillButtonsState('queued');
  console.log('[FILL] 予約しました。次の小節の頭で開始します。');

  // 現在鳴っている小節が終わるのを待ってからFILLへ切り替える
  waitBars(1, () => {
    if (!state.isPlaying || arrangementState.mode !== 'main') {
      console.log('[FILL] 小節境界到達時に状態が変わっていたためキャンセルしました');
      arrangementState.fillScheduled = false;
      _setFillButtonsState('idle');
      return;
    }
    arrangementState.mode = 'fill';
    _setFillButtonsState('active');
    console.log('[FILL] 開始しました。');
    swapRhythmPatternLive(generateFillPattern());

    // FILLを開始してから丸1小節後にMAINへ復帰する
    waitBars(2, (time) => {
      arrangementState.fillScheduled = false;
      if (arrangementState.mode !== 'fill') return; // 途中で停止されていたら何もしない
      arrangementState.mode = 'main';
      _setFillButtonsState('idle');
      console.log('[FILL] 終了、MAINへ復帰しました。');
      swapRhythmPatternLive(_arrCurrentMainPattern());
      // フィルからの着地アクセント（クラッシュ相当）を1発添える
      if (hiopSynth && time != null) hiopSynth.trigger(time, 0.9);
    });
  });
}

// ─── キーボードショートカット ─────────────────────────────────────────────────
// Space: RHYTHM開始/停止（RHYTHMボタンと同じ動作）
// B: FILL発動（FILLボタンと同じ動作）
// テキスト入力中（パターン名入力欄など）には反応しないようにする。
function setupArrangementKeyboard() {
  document.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    const tag = (e.target && e.target.tagName) || '';
    if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target && e.target.isContentEditable)) return;

    if (e.code === 'Space' || e.key === ' ') {
      e.preventDefault();
      toggleRhythmArrangement();
    } else if (e.key === 'b' || e.key === 'B') {
      triggerFill();
    } else if (e.key === 'c' || e.key === 'C') {
      // RHYTHM EDITORのRANDOMボタンと同じ動作。ライブ演奏中に曲のリズムを
      // その場で変化させるためのショートカット（RHYTHM EDITOR画面を
      // 開いていなくても動作する）。
      if (typeof randomizeEditorPattern === 'function') randomizeEditorPattern();
    }
  });
}

// ─── SETTINGS UI 配線（INTRO/FILL/ENDINGトグル + FILLボタン） ──────────────────
function setupArrangementUI() {
  const byId = id => document.getElementById(id);

  const wireToggle = (elId, stateKey) => {
    const tog = byId(elId);
    if (!tog) return;
    arrangementState[stateKey] = tog.classList.contains('on');
    tog.addEventListener('click', () => {
      arrangementState[stateKey] = tog.classList.contains('on');
      _arrSyncButtonsUI(state.isPlaying, arrangementState.mode === 'ending' || arrangementState.mode === 'intro');
    });
  };
  wireToggle('tog-intro-enable',  'introEnabled');
  wireToggle('tog-fill-enable',   'fillEnabled');
  wireToggle('tog-ending-enable', 'endingEnabled');

  ['fill-btn', 'fill-btn-reditor', 'fill-btn-kit'].forEach(id => {
    const btn = byId(id);
    if (btn) {
      btn.addEventListener('click', () => triggerFill());
      btn.style.display = 'none'; // 再生中のみ表示（_arrSyncButtonsUIで制御）
    }
  });

  // メイン画面のRHYTHMボタン・RHYTHM EDITOR・KIT EDITORの再生ボタンは、
  // それぞれのセットアップ関数側で startRhythmArrangement/stopRhythmArrangement/
  // toggleRhythmArrangement を呼ぶように変更済み（rhythm-ui.js / rhythm-editor.js /
  // kit-editor.js を参照）。ここでは設定トグルとFILLボタン、キーボードのみを配線する。
  setupArrangementKeyboard();
}
