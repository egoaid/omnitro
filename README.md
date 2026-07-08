# omnitro（オムニトロ）

![omnitro](./icons/og-image.png)

**コードボタン × ストラムプレートで弾く、ブラウザ演奏アプリ。**
インストール不要、ブラウザだけで演奏できます。PWA対応でホーム画面に追加すればアプリのように使えます。

▶ **公開ページ**: https://egoaid.github.io/omnitro/

---

## 目次

- [特徴](#特徴)
- [使い方](#使い方)
- [既知の制限](#既知の制限)
- [既知の不具合](#既知の不具合)
- [PWAとしてインストール](#pwaとしてインストール)
- [ファイル構成](#ファイル構成)
- [技術スタック](#技術スタック)
- [ライセンス](#ライセンス)
- [Features (English)](#features-english)
- [License (English)](#license-english)

---

## 特徴

- **全108コード** — 12ルート × 9タイプ（MAJ / MIN / 7 / MAJ7 / MIN7 / DIM / AUG / SUS4 / ADD9）
- **ストラムプレート** — 指でなぞって弾く、独自の音配列ロジックによるアルペジオ演奏
- **10種類のボイス** — OMNI1, OMNI2, HARP, CHEAP, SYNTH, FLUTE, GUITAR, FM PIANO, ORGAN, VIBES
- **リズムマシン** — 58種類の内蔵パターン × 9種類のドラムキット、専用のRHYTHM EDITOR / KIT EDITORで自作・保存も可能
- **録音 & MIX STUDIO** — 演奏（OMNI）・ドラム・マイク（VOCAL）を個別ステムで同時録音し、プリセット付きのミキサーで書き出し
- **PCキーボード演奏** — マウス操作に加え、キーボードでもコードボタンを演奏可能
- **MIDI対応** — MIDIキーボードでの演奏に対応。「MIDI STRUM MODE」ONで、鍵盤演奏を現在選択中のコードの音だけに強制マッピングし、ストラムプレートをそのまま鍵盤で弾ける（※Safari／iPhone・iPadは非対応。後述）
- **PWA対応** — ホーム画面に追加してアプリのように利用可能（オフライン対応）
- **日本語 / English** — アプリ内マニュアルは日英切り替え対応

アプリ内の「📖 MANUAL」ボタンから、詳しい取扱説明書（日本語/English）を開けます。

---

## 使い方

1. 左側のコードボタンでコードを選ぶ（複数ボタン同時押しで複雑なコードにも対応）
2. 右側のストラムプレートを指でなぞって演奏
3. SETTINGSからボイス・リズム・録音などを設定

詳細はアプリ内マニュアルを参照してください。

---

## 既知の制限

- **Safari（iPhone・iPad・Macのすべて）ではMIDIキーボードが使えません。** Web MIDI APIにAppleが対応していないためです。iOS/iPadOSでは、Chrome・Firefoxなど他のブラウザアプリも内部エンジンはSafariと同じ（WebKit）ため、同様にMIDIキーボードは認識されません。MIDIキーボードを使いたい場合は、Windows／macOS／AndroidのChrome・Edge・Firefox等をご利用ください。
- PCキーボード演奏・マウス／タッチでのコード演奏・ストラムプレートなど、MIDI以外の機能はSafari／iOSでも問題なく動作します。

---

## 既知の不具合

### 🔴 ボーカル録音がSafari/iOSでモノラル（左チャンネルのみ）になる

**症状:** Safari（macOS）またはiOS上の任意のブラウザ（iOSの全ブラウザはWebKitエンジン必須）でマイク録音を行うと、録音されたボーカルトラックが左チャンネルにのみ記録され、右チャンネルが無音になる。

**原因:** マイク入力（`getUserMedia`）はMac・iPhoneいずれのハードウェアでも本質的にモノラル。現在の実装は`MediaStreamAudioSourceNode`を処理チェーンに接続する際のブラウザの自動モノラル→ステレオ・アップミックスに依存している。Chrome/Chromium系はこのアップミックスを正しく行うが、Safari/WebKitでは行われず、結果として左チャンネルのみの出力になる。

**確認環境:** macOS Safari（Mac mini M4 Pro）／ iOS Safari（iPhone SE）

**回避策:** 未実装。マイク信号を録音チェーンに入れる前に、`ChannelMergerNode`で明示的にステレオ複製する対応が必要。

### 🔴 iOS、特に旧世代端末（iPhone SE等）でマルチトラック間の同期ズレ

**症状:** 録音時、omni/drum/vocalの各ステムが互いに同期ズレを起こすことがある。iPhone SEで顕著に確認済み。デスクトップ（Mac mini M4 Pro）では未確認。

**原因:** 現在のアーキテクチャは各ステム（`omni.wav`, `drum.wav`, `vocal.wav`, `mix.wav`）を**4つの独立した`MediaRecorder`インスタンス**で録音しており、それぞれが個別のエンコーダ・内部クロックを持ち、ほぼ同時だがサンプル精度ではないタイミング（`setTimeout`＋逐次`.start()`呼び出し）で開始される。この構造はメインスレッドの混雑に本質的に脆弱で、録音開始時のCPU/GC負荷が高いほど、4つのレコーダーの実際の開始タイミングの乖離が大きくなる。低スペック端末（旧世代iPhone）ほど影響を受けやすいが、これは**純粋なハードウェア限界というより構造的な問題**であり、負荷次第ではどの端末でも理論上発生しうる。

**新しいハードウェアについて:** 新しいiPhoneへの移行はこの問題の発生頻度・深刻度を軽減すると期待されるが、**根本解決の保証にはならない**。4レコーダー構成は端末の速度によらず構造的に脆弱性を残す。

**対応予定:** 単一録音経路アーキテクチャへの移行を計画中。1つの`MediaRecorder`（またはAudioWorklet）が単一クロック上で全チャンネルをインターリーブして記録し、ステムごとの分離は並行する独立レコーダー群ではなく、録音後のオフライン処理で行う設計に変更する。既存の`omnitro-v1.4.html`への統合前に、別ファイルでプロトタイプを構築・検証する予定。

---

## PWAとしてインストール

- **Android / デスクトップ Chrome**: アドレスバーの「インストール」アイコン、またはメニューから「アプリをインストール」
- **iOS Safari**: 共有ボタン →「ホーム画面に追加」

一度読み込めば、Service Workerによりオフラインでも起動できます。

---

## ファイル構成

```
.
├── index.html              # アプリ本体
├── manifest.json           # PWAマニフェスト
├── sw.js                   # Service Worker（オフライン対応）
├── icons/
│   ├── icon-192.png            # アプリアイコン
│   ├── icon-512.png            # アプリアイコン
│   ├── icon-maskable-512.png   # Android向けマスカブルアイコン
│   ├── favicon-32.png          # ファビコン
│   └── og-image.png            # SNSシェア用OGP画像
├── LICENSE                 # ライセンス条文
└── README.md                # このファイル
```

---

## 技術スタック

- **Web Audio API**（ネイティブ）— ストラムプレート音源・ドラム合成・エフェクト処理
- **[Tone.js](https://tonejs.github.io/) v14.8.49** — コード保持音・スケジューリング
- **Web MIDI API** — MIDIキーボード入力
- 依存パッケージのビルド不要、単一HTMLファイルで完結

---

## ライセンス

本アプリ（コード・音色／音源・素材一式）の著作権は作者（Takeshi Kawamoto）に帰属し、**All Rights Reserved**（独自ライセンス）です。詳細は [`LICENSE`](./LICENSE) を参照してください。

要点：

- ❌ 本アプリ自体の複製・改変・再配布・販売は、**非営利であっても禁止**
- ❌ 本アプリの音色（ボイス）をサンプリングし、音源・サンプルパック等として配布・販売することも禁止
- ✅ 本アプリを使って制作した楽曲などの**成果物の商用利用は自由**

© 2026 Takeshi Kawamoto. All rights reserved.

---

## Features (English)

**omnitro** is a browser-based instrument played with chord buttons and a strumplate — no install required. It's PWA-ready, so you can add it to your home screen and use it like a native app.

- **108 chords** — 12 roots × 9 types (MAJ / MIN / 7 / MAJ7 / MIN7 / DIM / AUG / SUS4 / ADD9)
- **Strumplate** — run your finger across it for a cascading arpeggio, using a distinctive note-layout logic
- **10 voices** — OMNI1, OMNI2, HARP, CHEAP, SYNTH, FLUTE, GUITAR, FM PIANO, ORGAN, VIBES
- **Rhythm machine** — 58 built-in patterns × 9 drum kits, with a full Rhythm Editor / Kit Editor for creating and saving your own
- **Recording & Mix Studio** — record instrument (OMNI), drums, and mic (VOCAL) as separate stems simultaneously, then mix down with presets and export
- **PC keyboard play** — play chord buttons from your keyboard, not just the mouse
- **MIDI support** — play from a MIDI keyboard; turn on "MIDI STRUM MODE" to force every note into the currently selected chord's strumplate layout, effectively playing the strumplate from your MIDI keyboard (*not supported on Safari/iPhone/iPad — see below*)
- **PWA-ready** — installable, works offline after first load
- **Japanese / English** — the in-app manual switches between both languages

Open the in-app manual anytime from the "📖 MANUAL" button in Settings.

### Known limitations

- **MIDI keyboards don't work on Safari (iPhone, iPad, or Mac).** Apple has not implemented the Web MIDI API in WebKit. Since every browser on iOS/iPadOS — including Chrome and Firefox — is required to use WebKit under the hood, no browser on iPhone/iPad can access a MIDI keyboard. To use a MIDI keyboard, use Chrome, Edge, or Firefox on Windows, macOS, or Android.
- Everything else — PC keyboard play, mouse/touch chord play, the strumplate, recording, etc. — works fine on Safari/iOS.

### Known issues

#### 🔴 Vocal recording is mono-only on Safari / iOS (left channel only)

**Symptom:** When recording vocals via microphone on Safari (macOS) or any browser on iOS (all iOS browsers use WebKit), the recorded vocal track is captured only in the left channel. The right channel remains silent.

**Cause:** Microphone input (`getUserMedia`) is inherently mono on both Mac and iPhone hardware. The current implementation relies on the browser's automatic mono-to-stereo upmixing when connecting `MediaStreamAudioSourceNode` through the processing chain. Chrome/Chromium performs this upmix correctly; Safari/WebKit does not, resulting in left-channel-only output.

**Confirmed on:** macOS Safari (Mac mini M4 Pro), iOS Safari (iPhone SE)

**Workaround:** Not yet implemented. Requires explicit stereo duplication via `ChannelMergerNode` before the mic signal enters the recording chain.

#### 🔴 Multi-track sync drift on iOS, especially older devices (e.g. iPhone SE)

**Symptom:** When recording, the omni/drum/vocal stems can drift out of sync with each other. Confirmed severe on iPhone SE; not observed on desktop (Mac mini M4 Pro).

**Cause:** The current architecture records each stem (`omni.wav`, `drum.wav`, `vocal.wav`, `mix.wav`) via **four independent `MediaRecorder` instances**, each with its own encoder and internal clock, started in near-simultaneous but not sample-accurate succession (`setTimeout` + sequential `.start()` calls). This is inherently vulnerable to main-thread congestion — the more CPU/GC pressure at recording start, the more the four recorders' actual start times diverge. Lower-powered devices (older iPhones) are more susceptible, but this is a **structural issue, not purely a hardware limitation** — sync could theoretically drift on any device under load.

**On newer hardware:** Upgrading to a newer iPhone is expected to reduce the frequency/severity of this issue (less main-thread contention), but is **not a guaranteed fix** — the four-recorder architecture remains structurally susceptible regardless of device speed.

**Planned fix:** Migrate to a single-recording-path architecture — one `MediaRecorder` (or AudioWorklet) captures all channels interleaved on a shared clock, with per-stem separation performed offline (post-recording) rather than via parallel independent recorders. A prototype will be built and validated in a separate file before merging into `omnitro-v1.4.html`.

### Running it

Just open `index.html` in a browser, or host all the files listed above together (e.g. via GitHub Pages) for the installable PWA experience.

### Tech stack

- Native **Web Audio API** for the strumplate synth, drum synthesis, and effects
- **[Tone.js](https://tonejs.github.io/) v14.8.49** for held-chord voices and scheduling
- **Web MIDI API** for MIDI keyboard input
- Single HTML file, no build step required

---

## License (English)

This app (code, voices/sounds, and all assets) is copyrighted by the author (Takeshi Kawamoto). **All rights reserved** — see [`LICENSE`](./LICENSE) for the full terms.

Summary:

- ❌ Copying, modifying, redistributing, or selling the app itself is prohibited, **even non-commercially**
- ❌ Sampling or extracting this app's voices/sounds to distribute or sell (e.g. as a sound library or sample pack) is also prohibited
- ✅ Songs and other works you create using this app are **yours to use freely, including commercially**

© 2026 Takeshi Kawamoto. All rights reserved.
