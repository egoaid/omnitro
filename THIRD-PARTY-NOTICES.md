# Third-Party Notices / サードパーティ通知

omnitro（オムニトロ）は、以下のオープンソース／オープンライセンスの部品を **改変せずに** 利用しています。
これらは各ライセンスのもとで提供されており、omnitro 本体の [LICENSE](./LICENSE)（独自ライセンス）の対象ではありません。

omnitro uses the following openly licensed components **unmodified**. They remain under their own licenses and are
not covered by omnitro's own [LICENSE](./LICENSE).

| Component | Version | How it is used | License |
|---|---|---|---|
| [Tone.js](https://tonejs.github.io/) | 14.8.49 | Loaded at runtime from cdnjs (`https://cdnjs.cloudflare.com/ajax/libs/tone/14.8.49/Tone.js`); not copied into this repository | MIT — © 2014-2020 Yotam Mann |
| standardized-audio-context | bundled inside Tone.js | Tone.js's internal Web Audio wrapper (not loaded separately by omnitro) | MIT — © Christoph Guttandin |
| tslib | bundled inside Tone.js | Runtime helpers bundled in Tone.js (not loaded separately by omnitro) | 0BSD — © Microsoft Corp. |
| Orbitron (Google Fonts) | served by Google Fonts | UI font, loaded from `fonts.googleapis.com` | SIL Open Font License 1.1 |
| Share Tech Mono (Google Fonts) | served by Google Fonts | UI font, loaded from `fonts.googleapis.com` | SIL Open Font License 1.1 |

All instrument and drum sounds in omnitro are synthesized in code at runtime; no audio samples from third parties are used.
omnitro のボイス・ドラム音はすべて実行時にコードで合成しており、第三者の音声サンプルは使用していません。

---

## Tone.js — MIT License

MIT License

Copyright (c) 2014-2020 Yotam Mann

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

---

## Notes

- The full license texts of the bundled packages (standardized-audio-context, tslib) are available in their respective
  repositories and in the Tone.js distribution.
- The OFL fonts are not bundled in this repository; they are served directly by Google Fonts. See
  <https://fonts.google.com/specimen/Orbitron> and <https://fonts.google.com/specimen/Share+Tech+Mono>.
