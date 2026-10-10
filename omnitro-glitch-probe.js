// omnitro-glitch-probe.js  (v1.5.40・計測専用)
//
// 出力波形そのものに「段差（クリック）」があるかを調べるための受動プローブ。
// 出力ノードを持たない（音は一切出さない・音声経路を変えない）。
//   入力は1つ（2ch）: ch0 = instBus（コンプレッサー前）, ch1 = masterOut（コンプ・リミッター通過後）。
//   ※ v1.5.40 は入力を2つ持つ構成で初期化に失敗したため、録音用ワークレット(実績あり)と同じ
//     「ChannelMerger → 入力1つのワークレット」構成に変更した（v1.5.41）。
//
// 128サンプル(1レンダー量子)ごとに、各入力について次の3値だけを計算する:
//   peak = 最大振幅
//   d1   = 隣り合うサンプルの差の最大値（|x[n]-x[n-1]|、量子の境目も連続して計算）
//   d2   = 2次差分の最大値（|x[n]-2x[n-1]+x[n-2]|）。帯域制限された普通の波形では小さく、
//          段差・ゼロ化・ジャンプがあると急に大きくなる（クリックの指標）。
// 直近 RING 量子(約5.5秒)分をリングに保持し、メインスレッドからの 'dump' 要求で返す。
// また d2 が移動平均の大きな倍数かつ絶対値でも大きいとき 'flag' を即時通知する（件数は制限）。
//
// 注意（検出できる範囲）: これはWeb Audioグラフ内の信号を見ている。グラフより後段
// （ブラウザの出力バッファ、OS、DAC、物理経路）で起きる欠損は、この信号には現れない。
//
// 通常のファイルとして配信する（Safariのblob:URL addModule不安定対策。capture-worklet と同じ方針）。

class OmnitroGlitchProbe extends AudioWorkletProcessor {
  constructor() {
    super();
    this.RING = 2048;                                  // 2048量子 ≒ 5.5秒 @48kHz
    this.frames = new Float64Array(this.RING);         // 各量子の先頭フレーム番号
    this.stats = new Float32Array(this.RING * 6);      // [pre: peak,d1,d2][post: peak,d1,d2]
    this.w = 0;                                        // 書き込み位置
    this.n = 0;                                        // 書いた量子数（上限RING）
    this.p1 = [0, 0];  this.p2 = [0, 0];               // 入力ごとの直前2サンプル（量子境界をまたぐ）
    this.ema = [1e-4, 1e-4];                           // d2の移動平均
    this.lastFlagFrame = [-1e9, -1e9];
    this.flagsThisSec = 0; this.secFrame = 0;
    this.enabled = true;
    this.port.onmessage = (e) => {
      const m = e.data || {};
      if (m.cmd === 'dump') {
        const k = Math.min(this.n, m.count || this.RING);
        const fr = new Float64Array(k), st = new Float32Array(k * 6);
        for (let j = 0; j < k; j++) {
          const idx = (this.w - k + j + this.RING * 2) % this.RING;
          fr[j] = this.frames[idx];
          for (let s = 0; s < 6; s++) st[j * 6 + s] = this.stats[idx * 6 + s];
        }
        this.port.postMessage({ type: 'dump', id: m.id, sampleRate, frames: fr, stats: st }, [fr.buffer, st.buffer]);
      } else if (m.cmd === 'enable') { this.enabled = !!m.on; }
    };
  }

  process(inputs) {
    if (!this.enabled) return true;
    const base = this.w * 6;
    this.frames[this.w] = currentFrame;
    const inp = inputs[0];
    for (let k = 0; k < 2; k++) {
      const ch = inp && inp.length > k ? inp[k] : null;   // ch0 = コンプ前(instBus), ch1 = 出力後(masterOut)
      let peak = 0, d1 = 0, d2 = 0;
      let x1 = this.p1[k], x2 = this.p2[k];               // x1 = x[n-1], x2 = x[n-2]
      if (ch) {
        for (let i = 0; i < ch.length; i++) {
          const x = ch[i];
          const ax = x < 0 ? -x : x; if (ax > peak) peak = ax;
          const dd1 = x - x1; const ad1 = dd1 < 0 ? -dd1 : dd1; if (ad1 > d1) d1 = ad1;
          const dd2 = x - 2 * x1 + x2; const ad2 = dd2 < 0 ? -dd2 : dd2; if (ad2 > d2) d2 = ad2;
          x2 = x1; x1 = x;
        }
      }
      this.p1[k] = x1; this.p2[k] = x2;
      this.stats[base + k * 3] = peak;
      this.stats[base + k * 3 + 1] = d1;
      this.stats[base + k * 3 + 2] = d2;

      // 即時フラグ: 直近60量子(約0.17秒)のd2最大値の1.7倍超 かつ 絶対値0.02超。
      // （Pythonシミュレーションで調整: 通常演奏の誤検出0件/秒、出力バッファ欠損(無音挿入)3〜70msを78〜100%検出。
      //   旧方式の「移動平均の12倍」は矩形波のエッジで常時誤検出するため廃止）
      let bmax = 0;
      for (let j = 1; j <= 60 && j < this.n; j++) {
        const v = this.stats[((this.w - j + this.RING) % this.RING) * 6 + k * 3 + 2];
        if (v > bmax) bmax = v;
      }
      if (this.n >= 60 && d2 > 0.02 && d2 > bmax * 1.7 && currentFrame - this.lastFlagFrame[k] > sampleRate * 0.02) {
        if (currentFrame - this.secFrame > sampleRate) { this.secFrame = currentFrame; this.flagsThisSec = 0; }
        if (this.flagsThisSec < 40) {
          this.flagsThisSec++;
          this.lastFlagFrame[k] = currentFrame;
          this.port.postMessage({ type: 'flag', input: k, frame: currentFrame, sampleRate, peak, d1, d2, ema: bmax });
        }
      }
    }
    this.w = (this.w + 1) % this.RING;
    if (this.n < this.RING) this.n++;
    return true;
  }
}
registerProcessor('omnitro-glitch-probe', OmnitroGlitchProbe);
