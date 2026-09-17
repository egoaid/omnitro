// ─── GROOVE SEQUENCER ────────────────────────────────────────────────────────
//
// イベントベースのグルーブシーケンサー。
// 各ドラムヒットは以下のプロパティを持つイベントオブジェクトで表現:
//
//   step    {number}  0-15のステップ番号
//   vel     {number}  ベロシティ 0.0〜1.0
//   offset  {number}  マイクロタイミングオフセット（ミリ秒）正=遅れ 負=早め
//   prob    {number}  発音確率 0.0〜1.0 (1.0=必ず鳴る)
//   ghost   {boolean} true=ゴースト（velをさらに下げる）
//
// 例:
//   { step:4, vel:0.85, offset:+12, prob:1.0 }   // 遅れて強いスネア
//   { step:2, vel:0.18, offset:-3,  prob:0.75, ghost:true } // 確率的ゴーストハット
//
// 旧バイナリフォーマット（hats:[1,0,1,...]）は binaryToGroove() で自動変換。

// ── バイナリ→グルーブイベント変換 ─────────────────────────────────────────────
// 旧パターンとの後方互換
function binaryToGroove(arr, defaultVel, defaultOffset) {
  if (!arr) return [];
  const events = [];
  for (let i = 0; i < arr.length; i++) {
    const v = arr[i];
    if (!v) continue;
    if (v === 3) {
      // ghost snare
      events.push({ step: i, vel: defaultVel * 0.22, offset: defaultOffset || 0, prob: 1.0, ghost: true });
    } else {
      events.push({ step: i, vel: v === 1 ? defaultVel : defaultVel * 0.5, offset: defaultOffset || 0, prob: 1.0 });
    }
  }
  return events;
}

// ── パターンをGrooveフォーマットに正規化 ───────────────────────────────────────
// groove.* プロパティがあればそのまま使い、なければ binaryToGroove で変換する
function normalizeGroovePattern(pattern) {
  const steps = pattern.pattern ? pattern.pattern.length : 16;
  // kick/snare
  let kickEvts   = pattern.groove_kick   || [];
  let snareEvts  = pattern.groove_snare  || [];
  if (!pattern.groove_kick && pattern.pattern) {
    const kickBin  = pattern.pattern.map(v => v === 1 ? 1 : 0);
    const snareBin = pattern.pattern.map(v => (v === 2 || v === 3) ? v : 0);
    kickEvts  = binaryToGroove(kickBin,  0.85, 0);
    snareEvts = binaryToGroove(snareBin, 0.80, 0);
  }
  return {
    steps,
    swing:   pattern.swing   || 0,
    kick:    kickEvts,
    snare:   snareEvts,
    hat:     pattern.groove_hat   || binaryToGroove(pattern.hats,  0.55, 0),
    hiop:    pattern.groove_hiop  || binaryToGroove(pattern.hiop,  0.60, 0),
    rim:     pattern.groove_rim   || binaryToGroove(pattern.rim,   0.65, 0),
    cowbl:   pattern.groove_cowbl || binaryToGroove(pattern.cowbl, 0.60, 0),
    clap:    pattern.groove_clap  || binaryToGroove(pattern.clap,  0.75, 0),
    tamb:    pattern.groove_tamb  || binaryToGroove(pattern.tamb,  0.65, 0),
    shkr:    pattern.groove_shkr  || binaryToGroove(pattern.shkr,  0.65, 0),
  };
}

// ── イベントを時間にスケジュール ────────────────────────────────────────────────
// Tone.js の AudioContext 内で offset を秒に変換してスケジュール
function scheduleEvent(synth, triggerFn, baseTime, offsetMs, vel) {
  if (!synth) return;
  const t = Math.max(baseTime, baseTime + offsetMs / 1000);
  triggerFn(synth, t, vel);
}

// ── バー境界通知システム ──────────────────────────────────────────────────────
// INTRO/FILL/ENDING（arrangement.js）が「今まさに小節の頭に来た」ことを
// 正確に検知するための仕組み。
//
// 以前は Tone.Transport.nextSubdivision('1m') のような Transport の絶対的な
// 小節グリッドを基準にしていたが、swapRhythmPatternLive() によるパターン
// 差し替え（通常の編集・KIT変更・録音中の反映など、小節境界とは無関係な
// 任意のタイミングで起こり得る）は Tone.Transport 自体には触れないため、
// 差し替え後の新しいシーケンスの「ステップ0」は Transport の絶対グリッドとは
// 位相がズレる。このズレたグリッドを基準にENDING/FILLの発動タイミングを
// 計算していたため、「止めた瞬間に始まる」「発動してもタイミングが合わず
// 分かりにくい」という不具合が起きていた。
//
// 対策として、実際に鳴っているシーケンス自身が「ステップ0」に到達する
// たびにカウンタを進める方式に変更した。これにより、過去にどんな差し替えが
// あったとしても、常に「今実際に聞こえている小節の頭」を基準にできる。
let _barCounter = 0;
let _barWaiters = [];

function _barTick(time) {
  _barCounter++;
  if (_barWaiters.length) {
    const waiters = _barWaiters;
    _barWaiters = [];
    for (const w of waiters) {
      w.n--;
      if (w.n <= 0) w.cb(time); else _barWaiters.push(w);
    }
  }
}

// 現在鳴っているシーケンスが n 回「ステップ0」に到達したら cb を呼ぶ。
// シーケンスは .start() 直後にステップ0がほぼ即座に発火する（開始した
// その瞬間が1拍目のため）。そのため「開始してから丸1小節後」を待ちたい
// 場合は n=2 を指定する（1回目=開始直後の即時発火、2回目=1周してきた
// 本当の小節境界）。すでに再生中のシーケンスに対して「次の小節の頭」を
// 待ちたい場合は n=1 でよい。
function waitBars(n, cb) {
  _barWaiters.push({ n, cb });
}

// ── メインシーケンサー ──────────────────────────────────────────────────────────
function startRhythm(patternOverride) {
  if (rhythmLoop) { rhythmLoop.dispose(); }

  // ── パターン解決の優先順位 ───────────────────────────────────────────────
  // 以前は隠しセレクト rhythm-select の値を user__editor より優先していたが、
  // rhythm-select は旧18パターン（chill1〜groove3）のオプションしか持たず、
  // 現在実際に使われているプリセット（lofi01等）やユーザー編集中のパターンに
  // 切り替わっても値が更新されない（初期値 'chill1' に固定されたまま）。
  // そのため引数なしで startRhythm() を呼ぶと常に chill1 にリセットされて
  // しまうバグがあった（KIT EDITOR画面・トップ画面での再生時など）。
  // user__editor は編集・プリセットロードのたびに必ず同期される「現在の
  // パターン」の正としてすでに機能しているため、これを優先する。
  const rawPattern = patternOverride
    || RHYTHM_PATTERNS['user__editor']
    || RHYTHM_PATTERNS[document.getElementById('rhythm-select').value]
    || RHYTHM_PATTERNS['lofi01'];

  const groove = normalizeGroovePattern(rawPattern);
  const steps  = groove.steps;
  rhythmStep   = 0;

  Tone.Transport.bpm.value = state.tempo;

  // Tone.js のグローバルSwingは使わず、各イベントの offset で独自実装する
  // （Tone.Transport.swing は全ステップ一律にかかるため、ヒットごとに
  //   異なるオフセットを持つグルーブシーケンサーとは干渉する）
  Tone.Transport.swing = 0;

  // ── ステップ時間を秒で取得 ─────────────────────────────────────────────────
  // 16n = 60 / BPM / 4 秒
  function sixteenthSec() {
    return 60 / Tone.Transport.bpm.value / 4;
  }

  // ── チャンネルのイベントリストをstepIdxでインデックス化 ───────────────────
  function buildIndex(evtList) {
    const idx = {};
    for (const e of evtList) {
      if (!idx[e.step]) idx[e.step] = [];
      idx[e.step].push(e);
    }
    return idx;
  }

  const idx = {
    kick:  buildIndex(groove.kick),
    snare: buildIndex(groove.snare),
    hat:   buildIndex(groove.hat),
    hiop:  buildIndex(groove.hiop),
    rim:   buildIndex(groove.rim),
    cowbl: buildIndex(groove.cowbl),
    clap:  buildIndex(groove.clap),
    tamb:  buildIndex(groove.tamb),
    shkr:  buildIndex(groove.shkr),
  };

  // ── triggerFn per channel ─────────────────────────────────────────────────
  const triggers = {
    kick:  (s, t, v) => { if (kickSynth)  kickSynth.trigger(t, v); },
    snare: (s, t, v) => { if (snareSynth) snareSynth.trigger(t, v); },
    hat:   (s, t, v) => { if (hatSynth)   hatSynth.trigger(t, v); },
    hiop:  (s, t, v) => { if (hiopSynth)  hiopSynth.trigger(t, v); },
    rim:   (s, t, v) => { if (rimSynth)   rimSynth.trigger(t, v); },
    cowbl: (s, t, v) => { if (cowblSynth) cowblSynth.trigger(t, v); },
    clap:  (s, t, v) => { if (clapSynth)  clapSynth.trigger(t, v); },
    tamb:  (s, t, v) => { if (tambSynth)  tambSynth.trigger(t, v); },
    shkr:  (s, t, v) => { if (shkrSynth)  shkrSynth.trigger(t, v); },
  };

  // ── Sequence callback ─────────────────────────────────────────────────────
  rhythmLoop = new Tone.Sequence((time, step) => {
    const si = step % steps;
    if (si === 0) {
      // 小節の頭に来た瞬間、waitBars() 経由の待機コールバック（RANDOM/HUMANIZE/
      // FILL/INTRO/ENDING等によるパターン差し替え）が同期的に発火することがある。
      // その場合、差し替え後の新しいシーケンスが「今この瞬間」から鳴り始めるため、
      // このまま処理を続けて旧パターンのステップ0も鳴らしてしまうと、
      // 新旧2つのパターンの音が同時に重なって「連打」のように聞こえてしまう
      // 不具合があった。差し替えが起きたかどうかをグローバル変数 rhythmLoop の
      // 参照が変わったかで検知し、変わっていればこの回の発音はスキップする
      // （新しいシーケンス側がこの瞬間の音を担当するため）。
      const beforeSwap = rhythmLoop;
      _barTick(time);
      if (rhythmLoop !== beforeSwap) return;
    }

    for (const ch of ['kick','snare','hat','hiop','rim','cowbl','clap','tamb','shkr']) {
      const evts = idx[ch][si];
      if (!evts) continue;
      for (const e of evts) {
        if (e.prob < 1.0 && Math.random() > e.prob) continue;
        const vel = e.ghost ? Math.max(0.05, (e.vel || 0.5) * 0.4) : (e.vel || 0.5);
        const offsetSec = (e.offset || 0) / 1000;
        const t = Math.max(time, time + offsetSec);
        triggers[ch](null, t, vel);
      }
    }

    // ── グリッド点灯（UIスレッドに橋渡し） ──────────────────────────────────
    Tone.getDraw().schedule(() => {
      gridHighlightStep(si);
    }, time);

  }, [...Array(steps).keys()], '16n');

  rhythmLoop.start(0);
  Tone.Transport.start();
}

// gridHighlightStep と stopRhythm は pianorollエンジン側に定義済み
// （prActiveStep を更新して prDrawImpl() を呼ぶ方式）
// prActiveStep / prDraw は後で pianorollエンジン内に定義される（hoistingで参照可）
let prActiveStep = -1;
let prDraw = () => {}; // placeholder — pianorollエンジン初期化後に上書き

function stopRhythm() {
  if (rhythmLoop) { rhythmLoop.stop(); }
  Tone.Transport.stop();
  prActiveStep = -1;
  if (prCtx) prDrawImpl();
  // 停止時は待機中のバー境界コールバックも破棄する（次回再生に持ち越さない）
  _barWaiters = [];
  // 待機中だったRANDOM/HUMANIZEの予約も孤児化してしまうため、
  // カウンタと表示状態を明示的にリセットする
  if (typeof _randomizePendingCount !== 'undefined') _randomizePendingCount = 0;
  if (typeof setRandomizePendingUI === 'function') setRandomizePendingUI(false);
}

// ── 録音中のライブパターン差し替え ────────────────────────────────────────────
// 通常時（録音していない時）はパターン変更のたびに stopRhythm()+startRhythm() で
// Tone.Transport ごと再起動している。しかし録音中は Tone.Transport.stop()/start()
// を呼びたくない（録音バッファのタイミング基準を継続させたいという設計判断が
// コード内コメントに残っている）。
//
// この関数は Tone.Transport には一切触れず、鳴っている Tone.Sequence
// （rhythmLoop）だけを新しいパターンで作り直して即座に差し替える。
// パターンは差し替えた瞬間から新しい1拍目で鳴り始める（Transport自体は
// 止めずに進み続けるので、録音全体の絶対時間基準はズレない）。
//
// これにより、録音中に RHYTHM EDITOR で RANDOM や手動編集を行っても、
// ピアノロールの見た目だけでなく実際の音にも即座に反映されるようになる。
function swapRhythmPatternLive(patternOverride) {
  if (!rhythmLoop) return; // まだ再生していない場合は何もしない（次回startRhythmで反映される）

  // startRhythm() と同じ理由で user__editor を優先する（詳細はそちらのコメント参照）
  const rawPattern = patternOverride
    || RHYTHM_PATTERNS['user__editor']
    || RHYTHM_PATTERNS[document.getElementById('rhythm-select').value]
    || RHYTHM_PATTERNS['lofi01'];

  const groove = normalizeGroovePattern(rawPattern);
  const steps  = groove.steps;

  function buildIndex(evtList) {
    const idx = {};
    for (const e of evtList) {
      if (!idx[e.step]) idx[e.step] = [];
      idx[e.step].push(e);
    }
    return idx;
  }

  const idx = {
    kick:  buildIndex(groove.kick),
    snare: buildIndex(groove.snare),
    hat:   buildIndex(groove.hat),
    hiop:  buildIndex(groove.hiop),
    rim:   buildIndex(groove.rim),
    cowbl: buildIndex(groove.cowbl),
    clap:  buildIndex(groove.clap),
    tamb:  buildIndex(groove.tamb),
    shkr:  buildIndex(groove.shkr),
  };

  const triggers = {
    kick:  (s, t, v) => { if (kickSynth)  kickSynth.trigger(t, v); },
    snare: (s, t, v) => { if (snareSynth) snareSynth.trigger(t, v); },
    hat:   (s, t, v) => { if (hatSynth)   hatSynth.trigger(t, v); },
    hiop:  (s, t, v) => { if (hiopSynth)  hiopSynth.trigger(t, v); },
    rim:   (s, t, v) => { if (rimSynth)   rimSynth.trigger(t, v); },
    cowbl: (s, t, v) => { if (cowblSynth) cowblSynth.trigger(t, v); },
    clap:  (s, t, v) => { if (clapSynth)  clapSynth.trigger(t, v); },
    tamb:  (s, t, v) => { if (tambSynth)  tambSynth.trigger(t, v); },
    shkr:  (s, t, v) => { if (shkrSynth)  shkrSynth.trigger(t, v); },
  };

  const newLoop = new Tone.Sequence((time, step) => {
    const si = step % steps;
    if (si === 0) {
      // startRhythm() 側と同じ理由（詳細はそちらのコメント参照）で、
      // このタイミングでさらに別の差し替えが起きた場合は発音をスキップする
      const beforeSwap = rhythmLoop;
      _barTick(time);
      if (rhythmLoop !== beforeSwap) return;
    }

    for (const ch of ['kick','snare','hat','hiop','rim','cowbl','clap','tamb','shkr']) {
      const evts = idx[ch][si];
      if (!evts) continue;
      for (const e of evts) {
        if (e.prob < 1.0 && Math.random() > e.prob) continue;
        const vel = e.ghost ? Math.max(0.05, (e.vel || 0.5) * 0.4) : (e.vel || 0.5);
        const offsetSec = (e.offset || 0) / 1000;
        const t = Math.max(time, time + offsetSec);
        triggers[ch](null, t, vel);
      }
    }

    Tone.getDraw().schedule(() => {
      gridHighlightStep(si);
    }, time);

  }, [...Array(steps).keys()], '16n');

  // 古いSequenceを先に破棄してから新しいものを開始する。
  // Tone.Transport.start()/stop() は一切呼ばない。
  const oldLoop = rhythmLoop;
  rhythmLoop = newLoop;
  oldLoop.dispose();
  newLoop.start();

  console.log('[RHYTHM-DEBUG] swapRhythmPatternLive: Transportを止めずにパターンを差し替えました (recording=' + (typeof recState !== 'undefined' ? recState.active : 'unknown') + ', isPlaying=' + state.isPlaying + ')');
}


