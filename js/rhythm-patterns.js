// ─── RHYTHM ENGINE ────────────────────────────────────────────────────────────
// カシオトーン風レトロリズムパターン（8〜12ステップ、シンプルでチープ）
// pattern: kick/snare配列 (1=kick, 2=snare, 0=rest)
// hats: hihat配列 (1=on, 0=off)
// カシオトーン実機風リズムパターン（8分音符×16ステップ / 3拍子は9ステップ）
// 1=キック  2=スネア  0=休符  / hats: 1=ハット
const RHYTHM_PATTERNS = {

  // ════════════════════════════════════════════════════════
  // GROOVE FORMAT PATTERNS (groove_*) — 全パターンをgrooveフォーマットで定義
  // ════════════════════════════════════════════════════════

  // ── CHILL / LOFI ────────────────────────────────────────────────────────────

  // 1. LAZY AFTERNOON — ゆったり後ノリ。スネアが遅れる
  'chill1': {
    groove_kick:  [{step:0,vel:0.88,offset:0,prob:1},{step:3,vel:0.48,offset:14,prob:0.75},{step:8,vel:0.82,offset:5,prob:1},{step:11,vel:0.42,offset:18,prob:0.68}],
    groove_snare: [{step:4,vel:0.78,offset:22,prob:1},{step:6,vel:0.13,offset:8,prob:0.5,ghost:true},{step:12,vel:0.72,offset:28,prob:1},{step:14,vel:0.11,offset:-4,prob:0.42,ghost:true}],
    groove_hat:   [{step:0,vel:0.55,offset:0,prob:1},{step:2,vel:0.32,offset:5,prob:0.9},{step:4,vel:0.48,offset:10,prob:1},{step:6,vel:0.24,offset:15,prob:0.8},{step:8,vel:0.52,offset:3,prob:1},{step:10,vel:0.28,offset:8,prob:0.85},{step:12,vel:0.54,offset:12,prob:1},{step:14,vel:0.18,offset:20,prob:0.7}],
    groove_hiop:  [{step:7,vel:0.46,offset:25,prob:0.62},{step:15,vel:0.42,offset:30,prob:0.52}],
    groove_rim:   [{step:5,vel:0.38,offset:10,prob:0.6}],
    groove_cowbl: [{step:2,vel:0.28,offset:5,prob:0.55},{step:10,vel:0.25,offset:8,prob:0.50}],
    groove_clap:  [{step:4,vel:0.40,offset:35,prob:0.72},{step:12,vel:0.36,offset:40,prob:0.68}],
    swing:0.50, beats:4,
  },

  // 2. MIDNIGHT WALK — ハーフタイム。空白が多く重い
  'chill2': {
    groove_kick:  [{step:0,vel:0.90,offset:0,prob:1},{step:8,vel:0.84,offset:6,prob:1},{step:11,vel:0.50,offset:14,prob:0.72}],
    groove_snare: [{step:4,vel:0.72,offset:20,prob:1},{step:12,vel:0.68,offset:28,prob:1},{step:14,vel:0.14,offset:12,prob:0.45,ghost:true}],
    groove_hat:   [{step:0,vel:0.50,offset:0,prob:1},{step:4,vel:0.44,offset:8,prob:1},{step:8,vel:0.48,offset:4,prob:1},{step:12,vel:0.42,offset:10,prob:1}],
    groove_hiop:  [{step:6,vel:0.52,offset:22,prob:0.60},{step:14,vel:0.46,offset:28,prob:0.55}],
    groove_rim:   [{step:3,vel:0.40,offset:16,prob:0.58},{step:11,vel:0.36,offset:20,prob:0.52}],
    groove_cowbl: [{step:9,vel:0.30,offset:10,prob:0.58}],
    groove_clap:  [{step:4,vel:0.42,offset:30,prob:0.78},{step:12,vel:0.38,offset:36,prob:0.72}],
    swing:0.50, beats:4,
  },

  // 3. RAINY WINDOW — ゴーストが霞む霧雨感
  'chill3': {
    groove_kick:  [{step:0,vel:0.86,offset:0,prob:1},{step:3,vel:0.50,offset:12,prob:0.78},{step:8,vel:0.80,offset:4,prob:1}],
    groove_snare: [{step:4,vel:0.76,offset:18,prob:1},{step:6,vel:0.12,offset:6,prob:0.55,ghost:true},{step:9,vel:0.15,offset:10,prob:0.50,ghost:true},{step:12,vel:0.70,offset:24,prob:1},{step:14,vel:0.10,offset:4,prob:0.45,ghost:true}],
    groove_hat:   [{step:0,vel:0.52,offset:0,prob:1},{step:1,vel:0.18,offset:12,prob:0.65},{step:2,vel:0.42,offset:5,prob:0.92},{step:4,vel:0.50,offset:8,prob:1},{step:6,vel:0.28,offset:14,prob:0.78},{step:8,vel:0.50,offset:2,prob:1},{step:10,vel:0.24,offset:8,prob:0.80},{step:12,vel:0.48,offset:10,prob:1},{step:14,vel:0.20,offset:18,prob:0.70}],
    groove_hiop:  [{step:7,vel:0.44,offset:24,prob:0.60},{step:15,vel:0.40,offset:30,prob:0.52}],
    groove_rim:   [],
    groove_cowbl: [{step:5,vel:0.26,offset:8,prob:0.52},{step:13,vel:0.24,offset:12,prob:0.48}],
    groove_clap:  [{step:4,vel:0.38,offset:28,prob:0.70},{step:12,vel:0.34,offset:34,prob:0.65}],
    swing:0.48, beats:4,
  },

  // 4. SUMMER PORCH — 最もリラックス。音少なく穏やか
  'chill4': {
    groove_kick:  [{step:0,vel:0.84,offset:0,prob:1},{step:8,vel:0.78,offset:5,prob:1},{step:12,vel:0.55,offset:14,prob:0.72}],
    groove_snare: [{step:4,vel:0.74,offset:20,prob:1},{step:12,vel:0.70,offset:25,prob:1}],
    groove_hat:   [{step:1,vel:0.36,offset:10,prob:0.75},{step:4,vel:0.46,offset:8,prob:1},{step:8,vel:0.44,offset:4,prob:1},{step:13,vel:0.30,offset:14,prob:0.68}],
    groove_hiop:  [{step:7,vel:0.50,offset:28,prob:0.65},{step:15,vel:0.44,offset:35,prob:0.55}],
    groove_rim:   [{step:5,vel:0.36,offset:12,prob:0.58},{step:9,vel:0.32,offset:16,prob:0.52}],
    groove_cowbl: [{step:1,vel:0.30,offset:6,prob:0.60},{step:9,vel:0.28,offset:10,prob:0.55}],
    groove_clap:  [],
    swing:0.50, beats:4,
  },

  // 5. LATE NIGHT — 最小限。夜中の静寂
  'chill5': {
    groove_kick:  [{step:0,vel:0.86,offset:0,prob:1},{step:8,vel:0.80,offset:6,prob:1}],
    groove_snare: [{step:4,vel:0.70,offset:22,prob:1},{step:12,vel:0.66,offset:28,prob:1}],
    groove_hat:   [{step:0,vel:0.40,offset:0,prob:1},{step:4,vel:0.36,offset:8,prob:0.88},{step:8,vel:0.38,offset:4,prob:1},{step:12,vel:0.34,offset:10,prob:0.85}],
    groove_hiop:  [{step:11,vel:0.44,offset:28,prob:0.58}],
    groove_rim:   [],
    groove_cowbl: [],
    groove_clap:  [{step:4,vel:0.38,offset:32,prob:0.72},{step:12,vel:0.34,offset:38,prob:0.68}],
    swing:0.50, beats:4,
  },

  // 6. VINYL GROOVE — 裏拍重視のDJ感
  'chill6': {
    groove_kick:  [{step:0,vel:0.88,offset:0,prob:1},{step:3,vel:0.52,offset:10,prob:0.82},{step:8,vel:0.84,offset:4,prob:1},{step:14,vel:0.60,offset:8,prob:0.78}],
    groove_snare: [{step:4,vel:0.76,offset:16,prob:1},{step:6,vel:0.14,offset:6,prob:0.50,ghost:true},{step:12,vel:0.72,offset:22,prob:1}],
    groove_hat:   [{step:0,vel:0.55,offset:0,prob:1},{step:2,vel:0.35,offset:8,prob:0.85},{step:4,vel:0.50,offset:5,prob:1},{step:6,vel:0.25,offset:12,prob:0.78},{step:8,vel:0.52,offset:2,prob:1},{step:10,vel:0.28,offset:9,prob:0.82},{step:12,vel:0.50,offset:6,prob:1},{step:14,vel:0.20,offset:15,prob:0.72}],
    groove_hiop:  [{step:3,vel:0.50,offset:20,prob:0.62},{step:11,vel:0.46,offset:24,prob:0.58}],
    groove_rim:   [{step:1,vel:0.42,offset:8,prob:0.62},{step:9,vel:0.38,offset:12,prob:0.55}],
    groove_cowbl: [{step:6,vel:0.35,offset:8,prob:0.65},{step:14,vel:0.30,offset:12,prob:0.58}],
    groove_clap:  [{step:4,vel:0.44,offset:25,prob:0.75},{step:12,vel:0.40,offset:30,prob:0.70}],
    swing:0.50, beats:4,
  },

  // 7. JAZZY BRUSH — ブラシ感のあるジャジーなシャッフル
  'chill7': {
    groove_kick:  [{step:0,vel:0.82,offset:0,prob:1},{step:4,vel:0.68,offset:8,prob:0.85},{step:9,vel:0.72,offset:10,prob:0.80}],
    groove_snare: [{step:4,vel:0.74,offset:18,prob:1},{step:5,vel:0.13,offset:6,prob:0.52,ghost:true},{step:12,vel:0.70,offset:22,prob:1},{step:13,vel:0.15,offset:8,prob:0.48,ghost:true}],
    groove_hat:   [{step:0,vel:0.58,offset:0,prob:1},{step:2,vel:0.40,offset:6,prob:0.9},{step:4,vel:0.54,offset:10,prob:1},{step:6,vel:0.30,offset:14,prob:0.82},{step:8,vel:0.56,offset:4,prob:1},{step:10,vel:0.32,offset:9,prob:0.84},{step:12,vel:0.52,offset:8,prob:1},{step:14,vel:0.22,offset:16,prob:0.72}],
    groove_hiop:  [{step:7,vel:0.48,offset:26,prob:0.65},{step:15,vel:0.44,offset:32,prob:0.55}],
    groove_rim:   [{step:2,vel:0.40,offset:10,prob:0.60},{step:10,vel:0.36,offset:14,prob:0.55}],
    groove_cowbl: [{step:3,vel:0.32,offset:8,prob:0.62},{step:11,vel:0.28,offset:12,prob:0.55}],
    groove_clap:  [{step:4,vel:0.42,offset:28,prob:0.72},{step:12,vel:0.38,offset:34,prob:0.68}],
    swing:0.45, beats:4,
  },

  // 8. DUSK SHUFFLE — ゆったりシャッフル。リムが主役
  'chill8': {
    groove_kick:  [{step:0,vel:0.86,offset:0,prob:1},{step:8,vel:0.80,offset:5,prob:1},{step:11,vel:0.50,offset:16,prob:0.70}],
    groove_snare: [{step:4,vel:0.74,offset:20,prob:1},{step:12,vel:0.70,offset:26,prob:1}],
    groove_hat:   [{step:0,vel:0.52,offset:0,prob:1},{step:2,vel:0.30,offset:8,prob:0.82},{step:4,vel:0.48,offset:10,prob:1},{step:8,vel:0.50,offset:4,prob:1},{step:12,vel:0.46,offset:8,prob:1},{step:14,vel:0.22,offset:18,prob:0.72}],
    groove_hiop:  [{step:7,vel:0.50,offset:28,prob:0.65}],
    groove_rim:   [{step:1,vel:0.44,offset:8,prob:0.70},{step:5,vel:0.40,offset:12,prob:0.65},{step:9,vel:0.42,offset:10,prob:0.68},{step:13,vel:0.38,offset:14,prob:0.60}],
    groove_cowbl: [{step:6,vel:0.28,offset:6,prob:0.55},{step:14,vel:0.25,offset:10,prob:0.50}],
    groove_clap:  [],
    swing:0.48, beats:4,
  },

  // ── HIP-HOP / GROOVE ───────────────────────────────────────────────────────

  // 9. CLASSIC HIP-HOP — 2拍4拍スネア、ハット8分
  'hiphop1': {
    groove_kick:  [{step:0,vel:0.90,offset:0,prob:1},{step:2,vel:0.55,offset:8,prob:0.78},{step:8,vel:0.86,offset:4,prob:1},{step:10,vel:0.52,offset:10,prob:0.72}],
    groove_snare: [{step:4,vel:0.80,offset:15,prob:1},{step:6,vel:0.12,offset:4,prob:0.50,ghost:true},{step:12,vel:0.76,offset:18,prob:1},{step:14,vel:0.14,offset:6,prob:0.45,ghost:true}],
    groove_hat:   [{step:0,vel:0.52,offset:0,prob:1},{step:2,vel:0.38,offset:5,prob:0.90},{step:4,vel:0.50,offset:8,prob:1},{step:6,vel:0.28,offset:10,prob:0.85},{step:8,vel:0.50,offset:2,prob:1},{step:10,vel:0.30,offset:7,prob:0.88},{step:12,vel:0.48,offset:6,prob:1},{step:14,vel:0.20,offset:12,prob:0.75}],
    groove_hiop:  [{step:7,vel:0.52,offset:20,prob:0.62},{step:15,vel:0.46,offset:25,prob:0.55}],
    groove_rim:   [],
    groove_cowbl: [{step:2,vel:0.35,offset:6,prob:0.65},{step:10,vel:0.32,offset:10,prob:0.60}],
    groove_clap:  [{step:4,vel:0.55,offset:20,prob:0.88},{step:12,vel:0.52,offset:24,prob:0.85}],
    swing:0.40, beats:4,
  },

  // 10. FUNK POCKET — シンコペーション、後ノリスネア
  'hiphop2': {
    groove_kick:  [{step:0,vel:0.90,offset:0,prob:1},{step:3,vel:0.65,offset:8,prob:0.88},{step:7,vel:0.72,offset:12,prob:0.85},{step:10,vel:0.58,offset:6,prob:0.80},{step:14,vel:0.62,offset:10,prob:0.75}],
    groove_snare: [{step:4,vel:0.82,offset:14,prob:1},{step:6,vel:0.14,offset:4,prob:0.52,ghost:true},{step:12,vel:0.78,offset:18,prob:1},{step:15,vel:0.18,offset:-5,prob:0.42,ghost:true}],
    groove_hat:   [{step:0,vel:0.56,offset:0,prob:1},{step:1,vel:0.25,offset:8,prob:0.72},{step:2,vel:0.48,offset:5,prob:0.95},{step:3,vel:0.20,offset:12,prob:0.65},{step:4,vel:0.54,offset:8,prob:1},{step:5,vel:0.28,offset:4,prob:0.78},{step:6,vel:0.42,offset:10,prob:0.90},{step:7,vel:0.16,offset:16,prob:0.60},{step:8,vel:0.55,offset:2,prob:1},{step:9,vel:0.24,offset:8,prob:0.68},{step:10,vel:0.46,offset:6,prob:0.92},{step:11,vel:0.18,offset:14,prob:0.58},{step:12,vel:0.52,offset:8,prob:1},{step:13,vel:0.26,offset:5,prob:0.72},{step:14,vel:0.38,offset:12,prob:0.88},{step:15,vel:0.14,offset:20,prob:0.55}],
    groove_hiop:  [{step:3,vel:0.54,offset:20,prob:0.62},{step:11,vel:0.50,offset:25,prob:0.55}],
    groove_rim:   [{step:9,vel:0.42,offset:8,prob:0.68}],
    groove_cowbl: [{step:1,vel:0.38,offset:6,prob:0.70},{step:9,vel:0.35,offset:10,prob:0.65}],
    groove_clap:  [{step:4,vel:0.58,offset:18,prob:0.90},{step:12,vel:0.55,offset:22,prob:0.88}],
    swing:0.38, beats:4,
  },

  // 11. BOUNCE — ハット細かく跳ねる
  'hiphop3': {
    groove_kick:  [{step:0,vel:0.90,offset:0,prob:1},{step:2,vel:0.62,offset:8,prob:0.82},{step:8,vel:0.86,offset:4,prob:1},{step:13,vel:0.60,offset:10,prob:0.75}],
    groove_snare: [{step:4,vel:0.80,offset:15,prob:1},{step:12,vel:0.76,offset:20,prob:1}],
    groove_hat:   [{step:0,vel:0.55,offset:0,prob:1},{step:1,vel:0.28,offset:10,prob:0.72},{step:2,vel:0.48,offset:5,prob:0.95},{step:3,vel:0.22,offset:14,prob:0.62},{step:4,vel:0.52,offset:8,prob:1},{step:5,vel:0.25,offset:4,prob:0.75},{step:6,vel:0.44,offset:10,prob:0.90},{step:7,vel:0.18,offset:18,prob:0.58},{step:8,vel:0.54,offset:2,prob:1},{step:9,vel:0.26,offset:8,prob:0.70},{step:10,vel:0.46,offset:6,prob:0.92},{step:11,vel:0.20,offset:14,prob:0.60},{step:12,vel:0.50,offset:6,prob:1},{step:13,vel:0.24,offset:4,prob:0.72},{step:14,vel:0.40,offset:12,prob:0.86},{step:15,vel:0.15,offset:20,prob:0.55}],
    groove_hiop:  [{step:7,vel:0.50,offset:22,prob:0.65}],
    groove_rim:   [{step:6,vel:0.40,offset:8,prob:0.62}],
    groove_cowbl: [{step:5,vel:0.36,offset:8,prob:0.68},{step:13,vel:0.32,offset:12,prob:0.60}],
    groove_clap:  [{step:4,vel:0.60,offset:16,prob:0.92},{step:12,vel:0.56,offset:20,prob:0.88},{step:14,vel:0.22,offset:8,prob:0.50,ghost:true}],
    swing:0.42, beats:4,
  },

  // 12. OLD SCHOOL — スウィング感のある古典ブレイクビーツ
  'hiphop4': {
    groove_kick:  [{step:0,vel:0.90,offset:0,prob:1},{step:3,vel:0.58,offset:10,prob:0.85},{step:8,vel:0.86,offset:4,prob:1},{step:11,vel:0.52,offset:14,prob:0.78}],
    groove_snare: [{step:4,vel:0.80,offset:16,prob:1},{step:6,vel:0.14,offset:6,prob:0.52,ghost:true},{step:12,vel:0.76,offset:20,prob:1},{step:14,vel:0.16,offset:8,prob:0.45,ghost:true}],
    groove_hat:   [{step:0,vel:0.54,offset:0,prob:1},{step:2,vel:0.36,offset:6,prob:0.90},{step:4,vel:0.50,offset:8,prob:1},{step:6,vel:0.26,offset:12,prob:0.82},{step:8,vel:0.52,offset:2,prob:1},{step:10,vel:0.28,offset:8,prob:0.85},{step:12,vel:0.48,offset:6,prob:1},{step:14,vel:0.19,offset:14,prob:0.72}],
    groove_hiop:  [{step:7,vel:0.52,offset:22,prob:0.65},{step:15,vel:0.46,offset:28,prob:0.55}],
    groove_rim:   [{step:2,vel:0.44,offset:8,prob:0.65},{step:10,vel:0.40,offset:12,prob:0.58}],
    groove_cowbl: [{step:0,vel:0.40,offset:4,prob:0.72},{step:4,vel:0.36,offset:8,prob:0.65},{step:8,vel:0.38,offset:6,prob:0.70},{step:12,vel:0.34,offset:10,prob:0.62}],
    groove_clap:  [{step:4,vel:0.56,offset:18,prob:0.88},{step:12,vel:0.52,offset:22,prob:0.85}],
    swing:0.45, beats:4,
  },

  // ── WORLD ─────────────────────────────────────────────────────────────────

  // 13. BOSSA CHILL — ボサノバシンコペーション
  'world1': {
    groove_kick:  [{step:0,vel:0.86,offset:0,prob:1},{step:3,vel:0.55,offset:10,prob:0.80},{step:8,vel:0.82,offset:4,prob:1},{step:13,vel:0.50,offset:12,prob:0.72}],
    groove_snare: [{step:4,vel:0.74,offset:18,prob:1},{step:12,vel:0.70,offset:22,prob:1}],
    groove_hat:   [{step:1,vel:0.45,offset:8,prob:0.88},{step:3,vel:0.38,offset:12,prob:0.80},{step:5,vel:0.42,offset:8,prob:0.85},{step:7,vel:0.35,offset:14,prob:0.75},{step:9,vel:0.44,offset:6,prob:0.88},{step:11,vel:0.36,offset:12,prob:0.78},{step:13,vel:0.42,offset:8,prob:0.85},{step:15,vel:0.32,offset:16,prob:0.72}],
    groove_hiop:  [{step:6,vel:0.50,offset:20,prob:0.65},{step:14,vel:0.46,offset:25,prob:0.58}],
    groove_rim:   [{step:2,vel:0.50,offset:8,prob:0.75},{step:6,vel:0.46,offset:12,prob:0.70},{step:10,vel:0.48,offset:8,prob:0.72},{step:14,vel:0.44,offset:14,prob:0.65}],
    groove_cowbl: [{step:0,vel:0.40,offset:4,prob:0.80},{step:4,vel:0.36,offset:8,prob:0.75},{step:8,vel:0.38,offset:6,prob:0.78},{step:12,vel:0.34,offset:10,prob:0.70}],
    groove_clap:  [],
    swing:0.30, beats:4,
  },

  // 14. WALTZ DREAM — 3拍子ゆったりワルツ
  'world2': {
    groove_kick:  [{step:0,vel:0.88,offset:0,prob:1},{step:3,vel:0.60,offset:8,prob:0.75},{step:6,vel:0.55,offset:10,prob:0.70}],
    groove_snare: [{step:3,vel:0.72,offset:16,prob:1},{step:6,vel:0.68,offset:20,prob:0.85}],
    groove_hat:   [{step:0,vel:0.52,offset:0,prob:1},{step:1,vel:0.30,offset:10,prob:0.72},{step:2,vel:0.42,offset:6,prob:0.88},{step:3,vel:0.48,offset:8,prob:1},{step:4,vel:0.28,offset:12,prob:0.68},{step:5,vel:0.38,offset:8,prob:0.82},{step:6,vel:0.46,offset:4,prob:1},{step:7,vel:0.25,offset:14,prob:0.65},{step:8,vel:0.36,offset:10,prob:0.78}],
    groove_hiop:  [{step:5,vel:0.48,offset:22,prob:0.60}],
    groove_rim:   [{step:2,vel:0.42,offset:10,prob:0.65},{step:5,vel:0.38,offset:14,prob:0.58}],
    groove_cowbl: [{step:3,vel:0.34,offset:8,prob:0.62}],
    groove_clap:  [],
    swing:0, beats:3,
  },

  // 15. COWBELL GROOVE — カウベルが主役のラテン
  'world3': {
    groove_kick:  [{step:0,vel:0.88,offset:0,prob:1},{step:3,vel:0.55,offset:10,prob:0.78},{step:8,vel:0.84,offset:4,prob:1},{step:11,vel:0.52,offset:14,prob:0.72}],
    groove_snare: [{step:4,vel:0.76,offset:16,prob:1},{step:12,vel:0.72,offset:20,prob:1}],
    groove_hat:   [{step:0,vel:0.50,offset:0,prob:1},{step:2,vel:0.35,offset:6,prob:0.88},{step:4,vel:0.48,offset:8,prob:1},{step:6,vel:0.28,offset:12,prob:0.80},{step:8,vel:0.50,offset:2,prob:1},{step:10,vel:0.30,offset:8,prob:0.82},{step:12,vel:0.46,offset:6,prob:1},{step:14,vel:0.20,offset:14,prob:0.72}],
    groove_hiop:  [],
    groove_rim:   [{step:2,vel:0.46,offset:8,prob:0.70},{step:6,vel:0.42,offset:12,prob:0.65},{step:10,vel:0.44,offset:10,prob:0.68},{step:14,vel:0.40,offset:14,prob:0.62}],
    groove_cowbl: [{step:0,vel:0.55,offset:4,prob:0.92},{step:2,vel:0.42,offset:8,prob:0.80},{step:4,vel:0.50,offset:6,prob:0.88},{step:6,vel:0.38,offset:12,prob:0.78},{step:8,vel:0.52,offset:4,prob:0.90},{step:10,vel:0.40,offset:8,prob:0.82},{step:12,vel:0.48,offset:6,prob:0.88},{step:14,vel:0.36,offset:12,prob:0.75}],
    groove_clap:  [{step:4,vel:0.50,offset:22,prob:0.80},{step:12,vel:0.46,offset:26,prob:0.75}],
    swing:0.25, beats:4,
  },

  // ── GROOVE (ヒューマナイズされた深いグルーブ) ──────────────────────────────

  // 16. LAZY LATE — スネア意図的に遅い。後ノリの極致
  'groove1': {
    groove_kick:  [{step:0,vel:0.88,offset:0,prob:1},{step:3,vel:0.52,offset:14,prob:0.80},{step:8,vel:0.82,offset:6,prob:1},{step:11,vel:0.45,offset:18,prob:0.70}],
    groove_snare: [{step:4,vel:0.78,offset:32,prob:1},{step:6,vel:0.14,offset:8,prob:0.55,ghost:true},{step:12,vel:0.72,offset:38,prob:1},{step:14,vel:0.12,offset:-4,prob:0.45,ghost:true}],
    groove_hat:   [{step:0,vel:0.58,offset:0,prob:1},{step:2,vel:0.36,offset:5,prob:0.90},{step:4,vel:0.50,offset:10,prob:1},{step:6,vel:0.26,offset:15,prob:0.80},{step:8,vel:0.54,offset:3,prob:1},{step:10,vel:0.30,offset:8,prob:0.85},{step:12,vel:0.56,offset:12,prob:1},{step:14,vel:0.20,offset:20,prob:0.70}],
    groove_hiop:  [{step:7,vel:0.48,offset:25,prob:0.65},{step:15,vel:0.44,offset:30,prob:0.55}],
    groove_rim:   [{step:5,vel:0.40,offset:14,prob:0.62}],
    groove_cowbl: [{step:2,vel:0.30,offset:8,prob:0.60},{step:10,vel:0.28,offset:12,prob:0.55}],
    groove_clap:  [{step:4,vel:0.42,offset:40,prob:0.75},{step:12,vel:0.38,offset:45,prob:0.70}],
    swing:0.50, beats:4,
  },

  // 17. GHOST MOVEMENT — ゴーストスネアが主役
  'groove2': {
    groove_kick:  [{step:0,vel:0.85,offset:0,prob:1},{step:9,vel:0.68,offset:10,prob:0.90}],
    groove_snare: [{step:1,vel:0.11,offset:6,prob:0.60,ghost:true},{step:3,vel:0.15,offset:10,prob:0.55,ghost:true},{step:4,vel:0.82,offset:18,prob:1},{step:6,vel:0.09,offset:-3,prob:0.65,ghost:true},{step:7,vel:0.19,offset:8,prob:0.50,ghost:true},{step:10,vel:0.13,offset:5,prob:0.60,ghost:true},{step:11,vel:0.17,offset:12,prob:0.55,ghost:true},{step:12,vel:0.78,offset:22,prob:1},{step:14,vel:0.11,offset:4,prob:0.50,ghost:true},{step:15,vel:0.21,offset:-6,prob:0.45,ghost:true}],
    groove_hat:   [{step:0,vel:0.54,offset:0,prob:1},{step:2,vel:0.40,offset:4,prob:0.90},{step:4,vel:0.48,offset:8,prob:1},{step:5,vel:0.26,offset:15,prob:0.65},{step:6,vel:0.36,offset:6,prob:0.85},{step:8,vel:0.50,offset:2,prob:1},{step:10,vel:0.33,offset:10,prob:0.80},{step:12,vel:0.46,offset:12,prob:1},{step:13,vel:0.23,offset:18,prob:0.60},{step:14,vel:0.30,offset:8,prob:0.75}],
    groove_hiop:  [{step:7,vel:0.46,offset:22,prob:0.70},{step:15,vel:0.40,offset:28,prob:0.60}],
    groove_rim:   [{step:3,vel:0.42,offset:10,prob:0.62}],
    groove_cowbl: [{step:6,vel:0.32,offset:8,prob:0.60},{step:14,vel:0.28,offset:12,prob:0.55}],
    groove_clap:  [{step:4,vel:0.45,offset:25,prob:0.78},{step:12,vel:0.42,offset:30,prob:0.72}],
    swing:0, beats:4,
  },

  // 18. TIMING DRIFT — 後半ほど全体が遅れる
  'groove3': {
    groove_kick:  [{step:0,vel:0.88,offset:0,prob:1},{step:4,vel:0.68,offset:8,prob:0.90},{step:8,vel:0.82,offset:14,prob:1},{step:12,vel:0.62,offset:22,prob:0.85}],
    groove_snare: [{step:4,vel:0.72,offset:10,prob:1},{step:6,vel:0.13,offset:5,prob:0.55,ghost:true},{step:12,vel:0.68,offset:30,prob:1},{step:14,vel:0.15,offset:20,prob:0.45,ghost:true}],
    groove_hat:   [{step:0,vel:0.56,offset:0,prob:1},{step:2,vel:0.40,offset:4,prob:0.90},{step:4,vel:0.50,offset:8,prob:1},{step:6,vel:0.33,offset:12,prob:0.85},{step:8,vel:0.48,offset:16,prob:1},{step:10,vel:0.28,offset:20,prob:0.80},{step:12,vel:0.46,offset:24,prob:1},{step:14,vel:0.23,offset:28,prob:0.75}],
    groove_hiop:  [{step:7,vel:0.50,offset:25,prob:0.70},{step:15,vel:0.46,offset:38,prob:0.60}],
    groove_rim:   [{step:10,vel:0.36,offset:22,prob:0.60}],
    groove_cowbl: [{step:4,vel:0.35,offset:12,prob:0.65},{step:12,vel:0.30,offset:28,prob:0.58}],
    groove_clap:  [{step:4,vel:0.40,offset:15,prob:0.80},{step:12,vel:0.36,offset:38,prob:0.75}],
    swing:0, beats:4,
  },

}

// ── 40 LO-FI GROOVE PRESETS (BPM80基調、YouTube Lo-Fi Girl風) ─────────────
// カテゴリ: lofi(1-12), jazz(13-18), hiphop(19-24), world(25-30), groove(31-36), special(37-40)
// 全プリセットにclap/tamb/shkrを状況に合わせて追加

Object.assign(RHYTHM_PATTERNS, {

  // ── LO-FI CHILL ──────────────────────────────────────────────────────────

  'lofi01': {
    groove_kick:  [{step:0,vel:0.85,offset:0,prob:1},{step:8,vel:0.78,offset:6,prob:1},{step:11,vel:0.42,offset:18,prob:0.65}],
    groove_snare: [{step:4,vel:0.72,offset:28,prob:1},{step:12,vel:0.68,offset:32,prob:1},{step:6,vel:0.12,offset:8,prob:0.45,ghost:true}],
    groove_hat:   [{step:0,vel:0.48,offset:0,prob:1},{step:2,vel:0.28,offset:8,prob:0.85},{step:4,vel:0.44,offset:12,prob:1},{step:6,vel:0.22,offset:16,prob:0.78},{step:8,vel:0.46,offset:4,prob:1},{step:10,vel:0.26,offset:10,prob:0.82},{step:12,vel:0.44,offset:8,prob:1},{step:14,vel:0.18,offset:20,prob:0.70}],
    groove_hiop:  [{step:7,vel:0.44,offset:26,prob:0.60},{step:15,vel:0.40,offset:32,prob:0.52}],
    groove_rim:   [{step:5,vel:0.36,offset:12,prob:0.58}],
    groove_cowbl: [],
    groove_clap:  [{step:4,vel:0.38,offset:40,prob:0.72},{step:12,vel:0.34,offset:44,prob:0.68}],
    groove_tamb:  [{step:2,vel:0.32,offset:8,prob:0.55},{step:10,vel:0.30,offset:12,prob:0.50}],
    groove_shkr:  [],
    swing:0.50, beats:4,
  },

  'lofi02': {
    groove_kick:  [{step:0,vel:0.88,offset:0,prob:1},{step:8,vel:0.82,offset:5,prob:1}],
    groove_snare: [{step:4,vel:0.75,offset:24,prob:1},{step:12,vel:0.70,offset:30,prob:1}],
    groove_hat:   [{step:0,vel:0.52,offset:0,prob:1},{step:4,vel:0.46,offset:10,prob:1},{step:8,vel:0.50,offset:4,prob:1},{step:12,vel:0.44,offset:12,prob:1}],
    groove_hiop:  [{step:6,vel:0.50,offset:22,prob:0.62},{step:14,vel:0.46,offset:28,prob:0.55}],
    groove_rim:   [{step:3,vel:0.38,offset:16,prob:0.55},{step:11,vel:0.35,offset:20,prob:0.50}],
    groove_cowbl: [],
    groove_clap:  [{step:4,vel:0.42,offset:35,prob:0.78},{step:12,vel:0.38,offset:40,prob:0.72}],
    groove_tamb:  [{step:6,vel:0.35,offset:10,prob:0.60},{step:14,vel:0.32,offset:14,prob:0.55}],
    groove_shkr:  [],
    swing:0.48, beats:4,
  },

  'lofi03': {
    groove_kick:  [{step:0,vel:0.86,offset:0,prob:1},{step:3,vel:0.48,offset:14,prob:0.72},{step:8,vel:0.80,offset:5,prob:1}],
    groove_snare: [{step:4,vel:0.74,offset:20,prob:1},{step:12,vel:0.70,offset:26,prob:1},{step:14,vel:0.10,offset:4,prob:0.42,ghost:true}],
    groove_hat:   [{step:0,vel:0.50,offset:0,prob:1},{step:2,vel:0.30,offset:6,prob:0.88},{step:4,vel:0.46,offset:10,prob:1},{step:6,vel:0.22,offset:14,prob:0.75},{step:8,vel:0.48,offset:3,prob:1},{step:10,vel:0.25,offset:8,prob:0.82},{step:12,vel:0.46,offset:10,prob:1},{step:14,vel:0.16,offset:18,prob:0.68}],
    groove_hiop:  [{step:7,vel:0.48,offset:24,prob:0.62}],
    groove_rim:   [],
    groove_cowbl: [{step:2,vel:0.26,offset:6,prob:0.52},{step:10,vel:0.24,offset:10,prob:0.48}],
    groove_clap:  [{step:4,vel:0.36,offset:30,prob:0.70},{step:12,vel:0.33,offset:36,prob:0.65}],
    groove_tamb:  [{step:0,vel:0.28,offset:4,prob:0.58},{step:4,vel:0.30,offset:8,prob:0.60},{step:8,vel:0.28,offset:5,prob:0.56},{step:12,vel:0.26,offset:10,prob:0.52}],
    groove_shkr:  [],
    swing:0.50, beats:4,
  },

  'lofi04': {
    groove_kick:  [{step:0,vel:0.84,offset:0,prob:1},{step:8,vel:0.78,offset:6,prob:1},{step:12,vel:0.52,offset:14,prob:0.70}],
    groove_snare: [{step:4,vel:0.72,offset:22,prob:1},{step:12,vel:0.68,offset:28,prob:1}],
    groove_hat:   [{step:1,vel:0.32,offset:10,prob:0.72},{step:4,vel:0.44,offset:8,prob:1},{step:8,vel:0.42,offset:5,prob:1},{step:13,vel:0.28,offset:14,prob:0.65}],
    groove_hiop:  [{step:7,vel:0.48,offset:28,prob:0.65},{step:15,vel:0.44,offset:35,prob:0.55}],
    groove_rim:   [{step:5,vel:0.34,offset:12,prob:0.56}],
    groove_cowbl: [],
    groove_clap:  [],
    groove_tamb:  [{step:2,vel:0.34,offset:6,prob:0.62},{step:6,vel:0.30,offset:10,prob:0.55},{step:10,vel:0.32,offset:8,prob:0.58},{step:14,vel:0.28,offset:12,prob:0.50}],
    groove_shkr:  [],
    swing:0.50, beats:4,
  },

  'lofi05': {
    groove_kick:  [{step:0,vel:0.86,offset:0,prob:1},{step:8,vel:0.80,offset:6,prob:1}],
    groove_snare: [{step:4,vel:0.70,offset:24,prob:1},{step:12,vel:0.66,offset:30,prob:1}],
    groove_hat:   [{step:0,vel:0.42,offset:0,prob:1},{step:4,vel:0.38,offset:8,prob:0.88},{step:8,vel:0.40,offset:4,prob:1},{step:12,vel:0.36,offset:10,prob:0.85}],
    groove_hiop:  [{step:11,vel:0.44,offset:28,prob:0.58}],
    groove_rim:   [],
    groove_cowbl: [],
    groove_clap:  [{step:4,vel:0.36,offset:35,prob:0.72},{step:12,vel:0.33,offset:40,prob:0.68}],
    groove_tamb:  [{step:2,vel:0.30,offset:8,prob:0.55},{step:6,vel:0.28,offset:12,prob:0.50},{step:10,vel:0.30,offset:8,prob:0.52},{step:14,vel:0.26,offset:14,prob:0.48}],
    groove_shkr:  [],
    swing:0.50, beats:4,
  },

  'lofi06': {
    groove_kick:  [{step:0,vel:0.88,offset:0,prob:1},{step:3,vel:0.50,offset:10,prob:0.80},{step:8,vel:0.84,offset:4,prob:1},{step:14,vel:0.58,offset:8,prob:0.76}],
    groove_snare: [{step:4,vel:0.74,offset:18,prob:1},{step:12,vel:0.70,offset:24,prob:1},{step:6,vel:0.12,offset:6,prob:0.48,ghost:true}],
    groove_hat:   [{step:0,vel:0.52,offset:0,prob:1},{step:2,vel:0.32,offset:8,prob:0.85},{step:4,vel:0.48,offset:5,prob:1},{step:6,vel:0.24,offset:12,prob:0.78},{step:8,vel:0.50,offset:2,prob:1},{step:10,vel:0.26,offset:9,prob:0.80},{step:12,vel:0.48,offset:6,prob:1},{step:14,vel:0.18,offset:15,prob:0.70}],
    groove_hiop:  [{step:3,vel:0.48,offset:20,prob:0.60},{step:11,vel:0.44,offset:25,prob:0.55}],
    groove_rim:   [{step:1,vel:0.38,offset:8,prob:0.60}],
    groove_cowbl: [],
    groove_clap:  [{step:4,vel:0.40,offset:28,prob:0.75},{step:12,vel:0.37,offset:33,prob:0.70}],
    groove_tamb:  [{step:8,vel:0.32,offset:10,prob:0.58}],
    groove_shkr:  [{step:2,vel:0.28,offset:6,prob:0.52},{step:10,vel:0.26,offset:10,prob:0.48}],
    swing:0.50, beats:4,
  },

  'lofi07': {
    groove_kick:  [{step:0,vel:0.82,offset:0,prob:1},{step:4,vel:0.65,offset:8,prob:0.82},{step:9,vel:0.70,offset:10,prob:0.78}],
    groove_snare: [{step:4,vel:0.72,offset:20,prob:1},{step:12,vel:0.68,offset:24,prob:1},{step:5,vel:0.12,offset:6,prob:0.50,ghost:true}],
    groove_hat:   [{step:0,vel:0.55,offset:0,prob:1},{step:2,vel:0.38,offset:6,prob:0.90},{step:4,vel:0.52,offset:10,prob:1},{step:6,vel:0.28,offset:14,prob:0.80},{step:8,vel:0.54,offset:4,prob:1},{step:10,vel:0.30,offset:9,prob:0.82},{step:12,vel:0.50,offset:8,prob:1},{step:14,vel:0.20,offset:16,prob:0.70}],
    groove_hiop:  [{step:7,vel:0.46,offset:26,prob:0.62}],
    groove_rim:   [{step:2,vel:0.38,offset:10,prob:0.58}],
    groove_cowbl: [],
    groove_clap:  [{step:4,vel:0.40,offset:30,prob:0.72},{step:12,vel:0.37,offset:36,prob:0.68}],
    groove_tamb:  [{step:1,vel:0.30,offset:6,prob:0.55},{step:5,vel:0.28,offset:10,prob:0.50},{step:9,vel:0.30,offset:8,prob:0.52},{step:13,vel:0.26,offset:12,prob:0.48}],
    groove_shkr:  [],
    swing:0.45, beats:4,
  },

  'lofi08': {
    groove_kick:  [{step:0,vel:0.86,offset:0,prob:1},{step:8,vel:0.80,offset:5,prob:1},{step:11,vel:0.48,offset:16,prob:0.68}],
    groove_snare: [{step:4,vel:0.72,offset:22,prob:1},{step:12,vel:0.68,offset:28,prob:1}],
    groove_hat:   [{step:0,vel:0.50,offset:0,prob:1},{step:2,vel:0.28,offset:8,prob:0.80},{step:4,vel:0.46,offset:10,prob:1},{step:8,vel:0.48,offset:4,prob:1},{step:12,vel:0.44,offset:8,prob:1},{step:14,vel:0.20,offset:18,prob:0.70}],
    groove_hiop:  [{step:7,vel:0.48,offset:28,prob:0.62}],
    groove_rim:   [{step:1,vel:0.42,offset:8,prob:0.68},{step:5,vel:0.38,offset:12,prob:0.62},{step:9,vel:0.40,offset:10,prob:0.65},{step:13,vel:0.36,offset:14,prob:0.58}],
    groove_cowbl: [],
    groove_clap:  [],
    groove_tamb:  [{step:4,vel:0.35,offset:12,prob:0.65},{step:12,vel:0.32,offset:16,prob:0.60}],
    groove_shkr:  [{step:2,vel:0.26,offset:8,prob:0.50},{step:6,vel:0.24,offset:12,prob:0.46},{step:10,vel:0.26,offset:8,prob:0.48},{step:14,vel:0.22,offset:14,prob:0.44}],
    swing:0.48, beats:4,
  },

  'lofi09': {
    groove_kick:  [{step:0,vel:0.90,offset:0,prob:1},{step:8,vel:0.84,offset:6,prob:1},{step:11,vel:0.48,offset:14,prob:0.70}],
    groove_snare: [{step:4,vel:0.76,offset:26,prob:1},{step:12,vel:0.72,offset:30,prob:1}],
    groove_hat:   [{step:0,vel:0.50,offset:0,prob:1},{step:2,vel:0.30,offset:6,prob:0.85},{step:4,vel:0.46,offset:10,prob:1},{step:6,vel:0.22,offset:14,prob:0.76},{step:8,vel:0.48,offset:3,prob:1},{step:10,vel:0.24,offset:8,prob:0.80},{step:12,vel:0.46,offset:8,prob:1},{step:14,vel:0.17,offset:18,prob:0.68}],
    groove_hiop:  [{step:7,vel:0.46,offset:24,prob:0.60},{step:15,vel:0.42,offset:30,prob:0.52}],
    groove_rim:   [],
    groove_cowbl: [],
    groove_clap:  [{step:4,vel:0.38,offset:34,prob:0.75},{step:12,vel:0.35,offset:38,prob:0.70}],
    groove_tamb:  [{step:0,vel:0.30,offset:4,prob:0.55},{step:8,vel:0.28,offset:6,prob:0.52}],
    groove_shkr:  [{step:4,vel:0.24,offset:8,prob:0.48},{step:12,vel:0.22,offset:12,prob:0.44}],
    swing:0.50, beats:4,
  },

  'lofi10': {
    groove_kick:  [{step:0,vel:0.85,offset:0,prob:1},{step:6,vel:0.55,offset:10,prob:0.75},{step:8,vel:0.82,offset:4,prob:1}],
    groove_snare: [{step:4,vel:0.73,offset:22,prob:1},{step:12,vel:0.69,offset:28,prob:1}],
    groove_hat:   [{step:0,vel:0.48,offset:0,prob:1},{step:4,vel:0.44,offset:8,prob:1},{step:8,vel:0.46,offset:4,prob:1},{step:12,vel:0.42,offset:10,prob:1}],
    groove_hiop:  [{step:6,vel:0.50,offset:22,prob:0.62}],
    groove_rim:   [{step:2,vel:0.36,offset:10,prob:0.60},{step:10,vel:0.34,offset:14,prob:0.55}],
    groove_cowbl: [],
    groove_clap:  [{step:4,vel:0.40,offset:32,prob:0.73},{step:12,vel:0.37,offset:38,prob:0.68}],
    groove_tamb:  [{step:2,vel:0.32,offset:8,prob:0.58},{step:10,vel:0.30,offset:10,prob:0.54}],
    groove_shkr:  [],
    swing:0.48, beats:4,
  },

  'lofi11': {
    groove_kick:  [{step:0,vel:0.87,offset:0,prob:1},{step:8,vel:0.81,offset:5,prob:1}],
    groove_snare: [{step:4,vel:0.73,offset:20,prob:1},{step:12,vel:0.69,offset:26,prob:1},{step:14,vel:0.11,offset:8,prob:0.44,ghost:true}],
    groove_hat:   [{step:0,vel:0.50,offset:0,prob:1},{step:2,vel:0.30,offset:7,prob:0.86},{step:4,vel:0.47,offset:10,prob:1},{step:6,vel:0.23,offset:15,prob:0.76},{step:8,vel:0.49,offset:4,prob:1},{step:10,vel:0.25,offset:9,prob:0.80},{step:12,vel:0.47,offset:8,prob:1},{step:14,vel:0.18,offset:18,prob:0.70}],
    groove_hiop:  [{step:15,vel:0.44,offset:30,prob:0.55}],
    groove_rim:   [{step:6,vel:0.36,offset:12,prob:0.58}],
    groove_cowbl: [],
    groove_clap:  [{step:4,vel:0.39,offset:32,prob:0.74},{step:12,vel:0.36,offset:36,prob:0.70}],
    groove_tamb:  [{step:2,vel:0.28,offset:6,prob:0.52},{step:6,vel:0.26,offset:10,prob:0.48},{step:10,vel:0.28,offset:8,prob:0.50},{step:14,vel:0.24,offset:12,prob:0.46}],
    groove_shkr:  [],
    swing:0.50, beats:4,
  },

  'lofi12': {
    groove_kick:  [{step:0,vel:0.84,offset:0,prob:1},{step:8,vel:0.78,offset:6,prob:1},{step:13,vel:0.50,offset:12,prob:0.68}],
    groove_snare: [{step:4,vel:0.71,offset:24,prob:1},{step:12,vel:0.67,offset:28,prob:1}],
    groove_hat:   [{step:0,vel:0.48,offset:0,prob:1},{step:4,vel:0.44,offset:8,prob:0.90},{step:8,vel:0.46,offset:4,prob:1},{step:12,vel:0.42,offset:10,prob:0.88}],
    groove_hiop:  [{step:7,vel:0.46,offset:26,prob:0.60}],
    groove_rim:   [{step:1,vel:0.38,offset:8,prob:0.65}],
    groove_cowbl: [],
    groove_clap:  [],
    groove_tamb:  [{step:4,vel:0.36,offset:10,prob:0.65},{step:8,vel:0.33,offset:8,prob:0.60},{step:12,vel:0.34,offset:12,prob:0.62}],
    groove_shkr:  [{step:2,vel:0.24,offset:8,prob:0.50},{step:6,vel:0.22,offset:12,prob:0.46},{step:10,vel:0.24,offset:8,prob:0.48},{step:14,vel:0.20,offset:14,prob:0.42}],
    swing:0.48, beats:4,
  },

  // ── JAZZ CHILL ─────────────────────────────────────────────────────────────

  'jazz01': {
    groove_kick:  [{step:0,vel:0.85,offset:0,prob:1},{step:4,vel:0.62,offset:8,prob:0.80},{step:9,vel:0.70,offset:10,prob:0.75}],
    groove_snare: [{step:4,vel:0.72,offset:18,prob:1},{step:12,vel:0.68,offset:22,prob:1},{step:5,vel:0.12,offset:6,prob:0.50,ghost:true}],
    groove_hat:   [{step:0,vel:0.55,offset:0,prob:1},{step:2,vel:0.38,offset:6,prob:0.90},{step:4,vel:0.52,offset:10,prob:1},{step:6,vel:0.28,offset:14,prob:0.80},{step:8,vel:0.54,offset:4,prob:1},{step:10,vel:0.30,offset:9,prob:0.82},{step:12,vel:0.50,offset:8,prob:1},{step:14,vel:0.20,offset:16,prob:0.70}],
    groove_hiop:  [{step:7,vel:0.48,offset:26,prob:0.65}],
    groove_rim:   [{step:2,vel:0.40,offset:10,prob:0.62},{step:10,vel:0.36,offset:14,prob:0.55}],
    groove_cowbl: [],
    groove_clap:  [],
    groove_tamb:  [{step:4,vel:0.34,offset:12,prob:0.62},{step:12,vel:0.31,offset:16,prob:0.58}],
    groove_shkr:  [],
    swing:0.45, beats:4,
  },

  'jazz02': {
    groove_kick:  [{step:0,vel:0.82,offset:0,prob:1},{step:6,vel:0.60,offset:8,prob:0.72},{step:8,vel:0.78,offset:4,prob:1}],
    groove_snare: [{step:4,vel:0.70,offset:20,prob:1},{step:6,vel:0.13,offset:6,prob:0.52,ghost:true},{step:12,vel:0.66,offset:24,prob:1},{step:14,vel:0.12,offset:4,prob:0.48,ghost:true}],
    groove_hat:   [{step:0,vel:0.52,offset:0,prob:1},{step:2,vel:0.36,offset:7,prob:0.88},{step:4,vel:0.50,offset:10,prob:1},{step:6,vel:0.26,offset:14,prob:0.78},{step:8,vel:0.52,offset:3,prob:1},{step:10,vel:0.28,offset:8,prob:0.84},{step:12,vel:0.48,offset:8,prob:1},{step:14,vel:0.19,offset:17,prob:0.70}],
    groove_hiop:  [{step:9,vel:0.46,offset:24,prob:0.60}],
    groove_rim:   [{step:3,vel:0.38,offset:10,prob:0.58}],
    groove_cowbl: [],
    groove_clap:  [],
    groove_tamb:  [{step:2,vel:0.30,offset:8,prob:0.55},{step:10,vel:0.28,offset:12,prob:0.50}],
    groove_shkr:  [],
    swing:0.42, beats:4,
  },

  'jazz03': {
    groove_kick:  [{step:0,vel:0.84,offset:0,prob:1},{step:3,vel:0.52,offset:12,prob:0.75},{step:8,vel:0.80,offset:4,prob:1}],
    groove_snare: [{step:4,vel:0.72,offset:16,prob:1},{step:12,vel:0.68,offset:20,prob:1}],
    groove_hat:   [{step:0,vel:0.58,offset:0,prob:1},{step:2,vel:0.40,offset:6,prob:0.90},{step:4,vel:0.54,offset:10,prob:1},{step:6,vel:0.30,offset:14,prob:0.82},{step:8,vel:0.56,offset:4,prob:1},{step:10,vel:0.32,offset:9,prob:0.84},{step:12,vel:0.52,offset:8,prob:1},{step:14,vel:0.22,offset:16,prob:0.72}],
    groove_hiop:  [{step:7,vel:0.50,offset:26,prob:0.65},{step:15,vel:0.46,offset:32,prob:0.55}],
    groove_rim:   [{step:5,vel:0.40,offset:10,prob:0.65},{step:9,vel:0.38,offset:14,prob:0.58}],
    groove_cowbl: [],
    groove_clap:  [],
    groove_tamb:  [{step:0,vel:0.28,offset:4,prob:0.52},{step:4,vel:0.30,offset:8,prob:0.55},{step:8,vel:0.28,offset:5,prob:0.50},{step:12,vel:0.26,offset:10,prob:0.48}],
    groove_shkr:  [],
    swing:0.45, beats:4,
  },

  'jazz04': {
    groove_kick:  [{step:0,vel:0.85,offset:0,prob:1},{step:9,vel:0.65,offset:10,prob:0.82}],
    groove_snare: [{step:4,vel:0.75,offset:22,prob:1},{step:12,vel:0.71,offset:26,prob:1},{step:6,vel:0.13,offset:6,prob:0.52,ghost:true}],
    groove_hat:   [{step:0,vel:0.55,offset:0,prob:1},{step:2,vel:0.38,offset:6,prob:0.88},{step:4,vel:0.52,offset:10,prob:1},{step:6,vel:0.28,offset:14,prob:0.80},{step:8,vel:0.53,offset:4,prob:1},{step:10,vel:0.30,offset:9,prob:0.82},{step:12,vel:0.50,offset:8,prob:1},{step:14,vel:0.20,offset:16,prob:0.70}],
    groove_hiop:  [{step:11,vel:0.48,offset:24,prob:0.62}],
    groove_rim:   [{step:2,vel:0.40,offset:8,prob:0.62}],
    groove_cowbl: [],
    groove_clap:  [],
    groove_tamb:  [{step:6,vel:0.32,offset:10,prob:0.58},{step:14,vel:0.30,offset:14,prob:0.54}],
    groove_shkr:  [],
    swing:0.42, beats:4,
  },

  'jazz05': {
    groove_kick:  [{step:0,vel:0.82,offset:0,prob:1},{step:5,vel:0.56,offset:10,prob:0.72},{step:8,vel:0.78,offset:5,prob:1}],
    groove_snare: [{step:4,vel:0.70,offset:18,prob:1},{step:12,vel:0.66,offset:22,prob:1}],
    groove_hat:   [{step:0,vel:0.54,offset:0,prob:1},{step:2,vel:0.36,offset:6,prob:0.88},{step:4,vel:0.50,offset:10,prob:1},{step:6,vel:0.26,offset:14,prob:0.78},{step:8,vel:0.52,offset:3,prob:1},{step:10,vel:0.28,offset:8,prob:0.82},{step:12,vel:0.48,offset:8,prob:1},{step:14,vel:0.18,offset:17,prob:0.70}],
    groove_hiop:  [{step:7,vel:0.48,offset:26,prob:0.65}],
    groove_rim:   [{step:3,vel:0.38,offset:10,prob:0.60},{step:11,vel:0.35,offset:14,prob:0.54}],
    groove_cowbl: [{step:6,vel:0.28,offset:8,prob:0.58}],
    groove_clap:  [],
    groove_tamb:  [{step:2,vel:0.30,offset:8,prob:0.56},{step:10,vel:0.28,offset:12,prob:0.52}],
    groove_shkr:  [],
    swing:0.45, beats:4,
  },

  'jazz06': {
    groove_kick:  [{step:0,vel:0.84,offset:0,prob:1},{step:8,vel:0.78,offset:5,prob:1},{step:11,vel:0.46,offset:14,prob:0.68}],
    groove_snare: [{step:4,vel:0.72,offset:20,prob:1},{step:6,vel:0.12,offset:6,prob:0.50,ghost:true},{step:12,vel:0.68,offset:24,prob:1}],
    groove_hat:   [{step:0,vel:0.52,offset:0,prob:1},{step:2,vel:0.34,offset:7,prob:0.86},{step:4,vel:0.50,offset:10,prob:1},{step:6,vel:0.25,offset:14,prob:0.78},{step:8,vel:0.50,offset:4,prob:1},{step:10,vel:0.27,offset:9,prob:0.80},{step:12,vel:0.48,offset:8,prob:1},{step:14,vel:0.17,offset:17,prob:0.68}],
    groove_hiop:  [{step:7,vel:0.48,offset:25,prob:0.62},{step:15,vel:0.44,offset:30,prob:0.54}],
    groove_rim:   [{step:1,vel:0.38,offset:8,prob:0.62},{step:9,vel:0.35,offset:12,prob:0.55}],
    groove_cowbl: [],
    groove_clap:  [],
    groove_tamb:  [{step:4,vel:0.32,offset:10,prob:0.60},{step:12,vel:0.30,offset:14,prob:0.56}],
    groove_shkr:  [],
    swing:0.42, beats:4,
  },

  // ── HIP-HOP LO-FI ─────────────────────────────────────────────────────────

  'hh01': {
    groove_kick:  [{step:0,vel:0.90,offset:0,prob:1},{step:2,vel:0.54,offset:8,prob:0.75},{step:8,vel:0.86,offset:4,prob:1},{step:10,vel:0.50,offset:10,prob:0.70}],
    groove_snare: [{step:4,vel:0.80,offset:16,prob:1},{step:12,vel:0.76,offset:20,prob:1},{step:6,vel:0.12,offset:4,prob:0.48,ghost:true}],
    groove_hat:   [{step:0,vel:0.52,offset:0,prob:1},{step:2,vel:0.36,offset:5,prob:0.88},{step:4,vel:0.50,offset:8,prob:1},{step:6,vel:0.26,offset:10,prob:0.82},{step:8,vel:0.50,offset:2,prob:1},{step:10,vel:0.28,offset:7,prob:0.85},{step:12,vel:0.48,offset:6,prob:1},{step:14,vel:0.18,offset:12,prob:0.72}],
    groove_hiop:  [{step:7,vel:0.50,offset:20,prob:0.60},{step:15,vel:0.46,offset:25,prob:0.52}],
    groove_rim:   [],
    groove_cowbl: [{step:2,vel:0.32,offset:6,prob:0.62}],
    groove_clap:  [{step:4,vel:0.52,offset:22,prob:0.88},{step:12,vel:0.50,offset:26,prob:0.85}],
    groove_tamb:  [{step:2,vel:0.30,offset:6,prob:0.55},{step:10,vel:0.28,offset:10,prob:0.50}],
    groove_shkr:  [],
    swing:0.40, beats:4,
  },

  'hh02': {
    groove_kick:  [{step:0,vel:0.90,offset:0,prob:1},{step:3,vel:0.62,offset:8,prob:0.85},{step:7,vel:0.70,offset:12,prob:0.82},{step:10,vel:0.56,offset:6,prob:0.78}],
    groove_snare: [{step:4,vel:0.82,offset:14,prob:1},{step:12,vel:0.78,offset:18,prob:1},{step:15,vel:0.16,offset:-5,prob:0.40,ghost:true}],
    groove_hat:   [{step:0,vel:0.55,offset:0,prob:1},{step:1,vel:0.24,offset:8,prob:0.70},{step:2,vel:0.48,offset:5,prob:0.92},{step:4,vel:0.54,offset:8,prob:1},{step:6,vel:0.28,offset:10,prob:0.80},{step:8,vel:0.55,offset:2,prob:1},{step:10,vel:0.26,offset:8,prob:0.82},{step:12,vel:0.52,offset:6,prob:1},{step:14,vel:0.18,offset:14,prob:0.72}],
    groove_hiop:  [{step:3,vel:0.52,offset:20,prob:0.60}],
    groove_rim:   [{step:9,vel:0.40,offset:8,prob:0.65}],
    groove_cowbl: [{step:1,vel:0.36,offset:6,prob:0.68}],
    groove_clap:  [{step:4,vel:0.56,offset:18,prob:0.90},{step:12,vel:0.54,offset:22,prob:0.88}],
    groove_tamb:  [],
    groove_shkr:  [{step:0,vel:0.26,offset:4,prob:0.50},{step:4,vel:0.24,offset:8,prob:0.48},{step:8,vel:0.26,offset:5,prob:0.50},{step:12,vel:0.22,offset:10,prob:0.46}],
    swing:0.38, beats:4,
  },

  'hh03': {
    groove_kick:  [{step:0,vel:0.90,offset:0,prob:1},{step:2,vel:0.60,offset:8,prob:0.80},{step:8,vel:0.86,offset:4,prob:1},{step:13,vel:0.58,offset:10,prob:0.72}],
    groove_snare: [{step:4,vel:0.80,offset:15,prob:1},{step:12,vel:0.76,offset:20,prob:1}],
    groove_hat:   [{step:0,vel:0.54,offset:0,prob:1},{step:1,vel:0.26,offset:10,prob:0.70},{step:2,vel:0.48,offset:5,prob:0.92},{step:4,vel:0.52,offset:8,prob:1},{step:6,vel:0.24,offset:10,prob:0.82},{step:8,vel:0.54,offset:2,prob:1},{step:10,vel:0.28,offset:8,prob:0.84},{step:12,vel:0.50,offset:6,prob:1},{step:14,vel:0.16,offset:14,prob:0.70}],
    groove_hiop:  [{step:7,vel:0.50,offset:22,prob:0.62}],
    groove_rim:   [{step:6,vel:0.38,offset:8,prob:0.60}],
    groove_cowbl: [],
    groove_clap:  [{step:4,vel:0.58,offset:16,prob:0.92},{step:12,vel:0.56,offset:20,prob:0.88},{step:14,vel:0.20,offset:8,prob:0.48,ghost:true}],
    groove_tamb:  [{step:6,vel:0.28,offset:8,prob:0.52},{step:14,vel:0.26,offset:12,prob:0.48}],
    groove_shkr:  [],
    swing:0.42, beats:4,
  },

  'hh04': {
    groove_kick:  [{step:0,vel:0.90,offset:0,prob:1},{step:3,vel:0.56,offset:10,prob:0.82},{step:8,vel:0.86,offset:4,prob:1},{step:11,vel:0.50,offset:14,prob:0.75}],
    groove_snare: [{step:4,vel:0.80,offset:16,prob:1},{step:12,vel:0.76,offset:20,prob:1},{step:6,vel:0.13,offset:6,prob:0.50,ghost:true}],
    groove_hat:   [{step:0,vel:0.52,offset:0,prob:1},{step:2,vel:0.34,offset:6,prob:0.88},{step:4,vel:0.50,offset:8,prob:1},{step:6,vel:0.24,offset:12,prob:0.80},{step:8,vel:0.52,offset:2,prob:1},{step:10,vel:0.26,offset:8,prob:0.83},{step:12,vel:0.48,offset:6,prob:1},{step:14,vel:0.17,offset:14,prob:0.70}],
    groove_hiop:  [{step:7,vel:0.50,offset:22,prob:0.62}],
    groove_rim:   [{step:2,vel:0.42,offset:8,prob:0.63}],
    groove_cowbl: [{step:0,vel:0.38,offset:4,prob:0.70},{step:8,vel:0.36,offset:6,prob:0.65}],
    groove_clap:  [{step:4,vel:0.54,offset:18,prob:0.88},{step:12,vel:0.52,offset:22,prob:0.85}],
    groove_tamb:  [{step:2,vel:0.28,offset:8,prob:0.52},{step:10,vel:0.26,offset:12,prob:0.48}],
    groove_shkr:  [],
    swing:0.45, beats:4,
  },

  'hh05': {
    groove_kick:  [{step:0,vel:0.90,offset:0,prob:1},{step:3,vel:0.55,offset:10,prob:0.84},{step:8,vel:0.85,offset:5,prob:1},{step:11,vel:0.48,offset:14,prob:0.76}],
    groove_snare: [{step:4,vel:0.78,offset:16,prob:1},{step:6,vel:0.13,offset:5,prob:0.50,ghost:true},{step:12,vel:0.74,offset:22,prob:1},{step:14,vel:0.14,offset:7,prob:0.44,ghost:true}],
    groove_hat:   [{step:0,vel:0.52,offset:0,prob:1},{step:2,vel:0.34,offset:6,prob:0.90},{step:4,vel:0.50,offset:8,prob:1},{step:6,vel:0.24,offset:12,prob:0.82},{step:8,vel:0.52,offset:2,prob:1},{step:10,vel:0.26,offset:8,prob:0.84},{step:12,vel:0.48,offset:6,prob:1},{step:14,vel:0.17,offset:14,prob:0.72}],
    groove_hiop:  [{step:7,vel:0.48,offset:22,prob:0.63}],
    groove_rim:   [{step:2,vel:0.40,offset:8,prob:0.63}],
    groove_cowbl: [],
    groove_clap:  [{step:4,vel:0.55,offset:18,prob:0.90},{step:12,vel:0.53,offset:22,prob:0.87}],
    groove_tamb:  [{step:4,vel:0.30,offset:10,prob:0.56},{step:12,vel:0.28,offset:14,prob:0.52}],
    groove_shkr:  [{step:2,vel:0.22,offset:8,prob:0.48},{step:6,vel:0.20,offset:12,prob:0.44},{step:10,vel:0.22,offset:8,prob:0.46},{step:14,vel:0.18,offset:14,prob:0.42}],
    swing:0.40, beats:4,
  },

  'hh06': {
    groove_kick:  [{step:0,vel:0.88,offset:0,prob:1},{step:8,vel:0.84,offset:4,prob:1},{step:14,vel:0.58,offset:8,prob:0.76}],
    groove_snare: [{step:4,vel:0.78,offset:18,prob:1},{step:6,vel:0.13,offset:5,prob:0.50,ghost:true},{step:12,vel:0.74,offset:22,prob:1}],
    groove_hat:   [{step:0,vel:0.54,offset:0,prob:1},{step:2,vel:0.36,offset:6,prob:0.90},{step:4,vel:0.52,offset:8,prob:1},{step:6,vel:0.26,offset:12,prob:0.80},{step:8,vel:0.52,offset:2,prob:1},{step:10,vel:0.28,offset:8,prob:0.84},{step:12,vel:0.50,offset:6,prob:1},{step:14,vel:0.19,offset:14,prob:0.72}],
    groove_hiop:  [{step:3,vel:0.50,offset:20,prob:0.60},{step:11,vel:0.46,offset:25,prob:0.55}],
    groove_rim:   [{step:1,vel:0.40,offset:8,prob:0.64},{step:9,vel:0.37,offset:12,prob:0.57}],
    groove_cowbl: [],
    groove_clap:  [{step:4,vel:0.55,offset:20,prob:0.90},{step:12,vel:0.52,offset:24,prob:0.87}],
    groove_tamb:  [],
    groove_shkr:  [{step:0,vel:0.24,offset:4,prob:0.52},{step:4,vel:0.22,offset:8,prob:0.48},{step:8,vel:0.24,offset:5,prob:0.50},{step:12,vel:0.20,offset:10,prob:0.46}],
    swing:0.38, beats:4,
  },

  // ── WORLD / BOSSA ─────────────────────────────────────────────────────────

  'world01': {
    groove_kick:  [{step:0,vel:0.86,offset:0,prob:1},{step:3,vel:0.53,offset:10,prob:0.78},{step:8,vel:0.82,offset:4,prob:1},{step:13,vel:0.48,offset:12,prob:0.70}],
    groove_snare: [{step:4,vel:0.74,offset:18,prob:1},{step:12,vel:0.70,offset:22,prob:1}],
    groove_hat:   [{step:1,vel:0.44,offset:8,prob:0.88},{step:3,vel:0.36,offset:12,prob:0.78},{step:5,vel:0.42,offset:8,prob:0.85},{step:7,vel:0.33,offset:14,prob:0.74},{step:9,vel:0.43,offset:6,prob:0.86},{step:11,vel:0.35,offset:12,prob:0.76},{step:13,vel:0.41,offset:8,prob:0.84},{step:15,vel:0.30,offset:16,prob:0.70}],
    groove_hiop:  [{step:6,vel:0.48,offset:20,prob:0.62}],
    groove_rim:   [{step:2,vel:0.48,offset:8,prob:0.72},{step:6,vel:0.44,offset:12,prob:0.68},{step:10,vel:0.46,offset:8,prob:0.70},{step:14,vel:0.42,offset:14,prob:0.64}],
    groove_cowbl: [{step:0,vel:0.38,offset:4,prob:0.78},{step:4,vel:0.34,offset:8,prob:0.72},{step:8,vel:0.36,offset:6,prob:0.75},{step:12,vel:0.32,offset:10,prob:0.68}],
    groove_clap:  [],
    groove_tamb:  [{step:4,vel:0.36,offset:12,prob:0.68},{step:8,vel:0.33,offset:8,prob:0.62},{step:12,vel:0.34,offset:14,prob:0.65}],
    groove_shkr:  [{step:1,vel:0.28,offset:6,prob:0.55},{step:5,vel:0.26,offset:10,prob:0.50},{step:9,vel:0.28,offset:8,prob:0.52},{step:13,vel:0.24,offset:12,prob:0.48}],
    swing:0.30, beats:4,
  },

  'world02': {
    groove_kick:  [{step:0,vel:0.88,offset:0,prob:1},{step:3,vel:0.58,offset:8,prob:0.72},{step:6,vel:0.54,offset:10,prob:0.68}],
    groove_snare: [{step:3,vel:0.72,offset:16,prob:1},{step:6,vel:0.68,offset:20,prob:0.85}],
    groove_hat:   [{step:0,vel:0.52,offset:0,prob:1},{step:1,vel:0.28,offset:10,prob:0.70},{step:2,vel:0.42,offset:6,prob:0.86},{step:3,vel:0.48,offset:8,prob:1},{step:4,vel:0.26,offset:12,prob:0.66},{step:5,vel:0.38,offset:8,prob:0.80},{step:6,vel:0.46,offset:4,prob:1},{step:7,vel:0.23,offset:14,prob:0.63},{step:8,vel:0.35,offset:10,prob:0.76}],
    groove_hiop:  [{step:5,vel:0.46,offset:22,prob:0.58}],
    groove_rim:   [{step:2,vel:0.40,offset:10,prob:0.63}],
    groove_cowbl: [{step:3,vel:0.32,offset:8,prob:0.60}],
    groove_clap:  [],
    groove_tamb:  [{step:1,vel:0.32,offset:6,prob:0.60},{step:4,vel:0.30,offset:10,prob:0.56},{step:7,vel:0.28,offset:8,prob:0.52}],
    groove_shkr:  [{step:0,vel:0.26,offset:4,prob:0.55},{step:3,vel:0.24,offset:8,prob:0.50},{step:6,vel:0.25,offset:6,prob:0.52}],
    swing:0, beats:3,
  },

  'world03': {
    groove_kick:  [{step:0,vel:0.88,offset:0,prob:1},{step:3,vel:0.53,offset:10,prob:0.76},{step:8,vel:0.84,offset:4,prob:1},{step:11,vel:0.50,offset:14,prob:0.70}],
    groove_snare: [{step:4,vel:0.76,offset:16,prob:1},{step:12,vel:0.72,offset:20,prob:1}],
    groove_hat:   [{step:0,vel:0.50,offset:0,prob:1},{step:2,vel:0.32,offset:6,prob:0.86},{step:4,vel:0.48,offset:8,prob:1},{step:6,vel:0.26,offset:12,prob:0.78},{step:8,vel:0.50,offset:2,prob:1},{step:10,vel:0.28,offset:8,prob:0.80},{step:12,vel:0.46,offset:6,prob:1},{step:14,vel:0.18,offset:14,prob:0.70}],
    groove_hiop:  [],
    groove_rim:   [{step:2,vel:0.44,offset:8,prob:0.68},{step:6,vel:0.40,offset:12,prob:0.63},{step:10,vel:0.42,offset:10,prob:0.65},{step:14,vel:0.38,offset:14,prob:0.60}],
    groove_cowbl: [{step:0,vel:0.52,offset:4,prob:0.90},{step:2,vel:0.40,offset:8,prob:0.78},{step:4,vel:0.48,offset:6,prob:0.86},{step:6,vel:0.36,offset:12,prob:0.74},{step:8,vel:0.50,offset:4,prob:0.88},{step:10,vel:0.38,offset:8,prob:0.80},{step:12,vel:0.46,offset:6,prob:0.86},{step:14,vel:0.34,offset:12,prob:0.73}],
    groove_clap:  [{step:4,vel:0.48,offset:22,prob:0.78},{step:12,vel:0.45,offset:26,prob:0.74}],
    groove_tamb:  [{step:2,vel:0.34,offset:8,prob:0.65},{step:6,vel:0.31,offset:12,prob:0.60},{step:10,vel:0.33,offset:10,prob:0.62},{step:14,vel:0.29,offset:14,prob:0.56}],
    groove_shkr:  [],
    swing:0.25, beats:4,
  },

  'world04': {
    groove_kick:  [{step:0,vel:0.86,offset:0,prob:1},{step:4,vel:0.60,offset:8,prob:0.78},{step:8,vel:0.82,offset:4,prob:1},{step:12,vel:0.56,offset:10,prob:0.74}],
    groove_snare: [{step:4,vel:0.72,offset:18,prob:1},{step:12,vel:0.68,offset:22,prob:1}],
    groove_hat:   [{step:0,vel:0.48,offset:0,prob:1},{step:2,vel:0.30,offset:6,prob:0.84},{step:4,vel:0.46,offset:8,prob:1},{step:6,vel:0.24,offset:12,prob:0.76},{step:8,vel:0.48,offset:2,prob:1},{step:10,vel:0.26,offset:8,prob:0.80},{step:12,vel:0.44,offset:6,prob:1},{step:14,vel:0.16,offset:14,prob:0.68}],
    groove_hiop:  [{step:6,vel:0.46,offset:22,prob:0.62}],
    groove_rim:   [{step:1,vel:0.42,offset:8,prob:0.68},{step:5,vel:0.38,offset:12,prob:0.63},{step:9,vel:0.40,offset:10,prob:0.65},{step:13,vel:0.36,offset:14,prob:0.60}],
    groove_cowbl: [{step:2,vel:0.36,offset:6,prob:0.72},{step:6,vel:0.32,offset:10,prob:0.65},{step:10,vel:0.34,offset:8,prob:0.68},{step:14,vel:0.30,offset:12,prob:0.62}],
    groove_clap:  [],
    groove_tamb:  [{step:0,vel:0.32,offset:4,prob:0.60},{step:4,vel:0.30,offset:8,prob:0.56},{step:8,vel:0.30,offset:5,prob:0.58},{step:12,vel:0.28,offset:10,prob:0.54}],
    groove_shkr:  [{step:2,vel:0.24,offset:6,prob:0.52},{step:6,vel:0.22,offset:10,prob:0.48},{step:10,vel:0.23,offset:8,prob:0.50},{step:14,vel:0.20,offset:12,prob:0.44}],
    swing:0.28, beats:4,
  },

  'world05': {
    groove_kick:  [{step:0,vel:0.88,offset:0,prob:1},{step:6,vel:0.58,offset:10,prob:0.74},{step:8,vel:0.84,offset:4,prob:1}],
    groove_snare: [{step:4,vel:0.74,offset:18,prob:1},{step:12,vel:0.70,offset:22,prob:1}],
    groove_hat:   [{step:0,vel:0.50,offset:0,prob:1},{step:2,vel:0.32,offset:7,prob:0.86},{step:4,vel:0.48,offset:10,prob:1},{step:6,vel:0.26,offset:14,prob:0.78},{step:8,vel:0.50,offset:4,prob:1},{step:10,vel:0.28,offset:9,prob:0.82},{step:12,vel:0.46,offset:8,prob:1},{step:14,vel:0.19,offset:16,prob:0.70}],
    groove_hiop:  [{step:3,vel:0.48,offset:22,prob:0.62},{step:11,vel:0.44,offset:28,prob:0.55}],
    groove_rim:   [{step:2,vel:0.44,offset:8,prob:0.70},{step:10,vel:0.40,offset:12,prob:0.64}],
    groove_cowbl: [{step:4,vel:0.40,offset:8,prob:0.76},{step:12,vel:0.36,offset:12,prob:0.70}],
    groove_clap:  [],
    groove_tamb:  [{step:2,vel:0.34,offset:8,prob:0.64},{step:6,vel:0.31,offset:12,prob:0.58},{step:10,vel:0.32,offset:10,prob:0.61},{step:14,vel:0.29,offset:14,prob:0.55}],
    groove_shkr:  [{step:0,vel:0.26,offset:4,prob:0.55},{step:4,vel:0.24,offset:8,prob:0.50},{step:8,vel:0.25,offset:5,prob:0.52},{step:12,vel:0.22,offset:10,prob:0.48}],
    swing:0.25, beats:4,
  },

  'world06': {
    groove_kick:  [{step:0,vel:0.85,offset:0,prob:1},{step:8,vel:0.80,offset:5,prob:1}],
    groove_snare: [{step:4,vel:0.73,offset:18,prob:1},{step:12,vel:0.69,offset:22,prob:1}],
    groove_hat:   [{step:0,vel:0.50,offset:0,prob:1},{step:2,vel:0.32,offset:6,prob:0.85},{step:4,vel:0.47,offset:10,prob:1},{step:6,vel:0.25,offset:14,prob:0.77},{step:8,vel:0.49,offset:3,prob:1},{step:10,vel:0.27,offset:8,prob:0.81},{step:12,vel:0.46,offset:7,prob:1},{step:14,vel:0.18,offset:16,prob:0.70}],
    groove_hiop:  [{step:7,vel:0.46,offset:24,prob:0.62}],
    groove_rim:   [{step:2,vel:0.42,offset:8,prob:0.67},{step:6,vel:0.38,offset:12,prob:0.62},{step:10,vel:0.40,offset:10,prob:0.64},{step:14,vel:0.36,offset:14,prob:0.58}],
    groove_cowbl: [{step:0,vel:0.38,offset:4,prob:0.74},{step:4,vel:0.35,offset:8,prob:0.68},{step:8,vel:0.36,offset:6,prob:0.72},{step:12,vel:0.32,offset:10,prob:0.66}],
    groove_clap:  [{step:4,vel:0.44,offset:24,prob:0.76},{step:12,vel:0.41,offset:28,prob:0.72}],
    groove_tamb:  [{step:0,vel:0.30,offset:4,prob:0.58},{step:4,vel:0.28,offset:8,prob:0.54},{step:8,vel:0.30,offset:5,prob:0.56},{step:12,vel:0.26,offset:10,prob:0.52}],
    groove_shkr:  [],
    swing:0.22, beats:4,
  },

  // ── DEEP GROOVE ────────────────────────────────────────────────────────────

  'groove01': {
    groove_kick:  [{step:0,vel:0.88,offset:0,prob:1},{step:3,vel:0.50,offset:14,prob:0.78},{step:8,vel:0.82,offset:6,prob:1},{step:11,vel:0.43,offset:18,prob:0.68}],
    groove_snare: [{step:4,vel:0.78,offset:34,prob:1},{step:6,vel:0.13,offset:8,prob:0.52,ghost:true},{step:12,vel:0.73,offset:40,prob:1},{step:14,vel:0.11,offset:-4,prob:0.43,ghost:true}],
    groove_hat:   [{step:0,vel:0.55,offset:0,prob:1},{step:2,vel:0.34,offset:5,prob:0.88},{step:4,vel:0.50,offset:10,prob:1},{step:6,vel:0.25,offset:15,prob:0.78},{step:8,vel:0.52,offset:3,prob:1},{step:10,vel:0.28,offset:8,prob:0.83},{step:12,vel:0.52,offset:12,prob:1},{step:14,vel:0.19,offset:20,prob:0.68}],
    groove_hiop:  [{step:7,vel:0.47,offset:25,prob:0.63}],
    groove_rim:   [{step:5,vel:0.38,offset:14,prob:0.60}],
    groove_cowbl: [],
    groove_clap:  [{step:4,vel:0.42,offset:42,prob:0.75},{step:12,vel:0.39,offset:46,prob:0.70}],
    groove_tamb:  [{step:2,vel:0.30,offset:8,prob:0.55},{step:10,vel:0.28,offset:12,prob:0.50}],
    groove_shkr:  [],
    swing:0.50, beats:4,
  },

  'groove02': {
    groove_kick:  [{step:0,vel:0.86,offset:0,prob:1},{step:9,vel:0.66,offset:10,prob:0.88}],
    groove_snare: [{step:1,vel:0.10,offset:6,prob:0.58,ghost:true},{step:3,vel:0.14,offset:10,prob:0.52,ghost:true},{step:4,vel:0.82,offset:18,prob:1},{step:6,vel:0.08,offset:-3,prob:0.62,ghost:true},{step:7,vel:0.18,offset:8,prob:0.48,ghost:true},{step:10,vel:0.12,offset:5,prob:0.58,ghost:true},{step:12,vel:0.78,offset:22,prob:1},{step:14,vel:0.10,offset:4,prob:0.48,ghost:true}],
    groove_hat:   [{step:0,vel:0.52,offset:0,prob:1},{step:2,vel:0.38,offset:4,prob:0.88},{step:4,vel:0.48,offset:8,prob:1},{step:6,vel:0.35,offset:6,prob:0.83},{step:8,vel:0.50,offset:2,prob:1},{step:10,vel:0.32,offset:10,prob:0.78},{step:12,vel:0.46,offset:12,prob:1},{step:14,vel:0.28,offset:8,prob:0.73}],
    groove_hiop:  [{step:7,vel:0.46,offset:22,prob:0.68}],
    groove_rim:   [{step:3,vel:0.40,offset:10,prob:0.60}],
    groove_cowbl: [],
    groove_clap:  [{step:4,vel:0.44,offset:26,prob:0.78},{step:12,vel:0.42,offset:30,prob:0.74}],
    groove_tamb:  [{step:6,vel:0.30,offset:10,prob:0.55},{step:14,vel:0.28,offset:14,prob:0.50}],
    groove_shkr:  [],
    swing:0, beats:4,
  },

  'groove03': {
    groove_kick:  [{step:0,vel:0.88,offset:0,prob:1},{step:4,vel:0.66,offset:8,prob:0.88},{step:8,vel:0.83,offset:14,prob:1},{step:12,vel:0.61,offset:22,prob:0.83}],
    groove_snare: [{step:4,vel:0.72,offset:10,prob:1},{step:6,vel:0.12,offset:5,prob:0.52,ghost:true},{step:12,vel:0.68,offset:30,prob:1}],
    groove_hat:   [{step:0,vel:0.54,offset:0,prob:1},{step:2,vel:0.38,offset:4,prob:0.88},{step:4,vel:0.50,offset:8,prob:1},{step:6,vel:0.31,offset:12,prob:0.83},{step:8,vel:0.48,offset:16,prob:1},{step:10,vel:0.27,offset:20,prob:0.78},{step:12,vel:0.46,offset:24,prob:1},{step:14,vel:0.22,offset:28,prob:0.73}],
    groove_hiop:  [{step:7,vel:0.48,offset:25,prob:0.68}],
    groove_rim:   [{step:10,vel:0.35,offset:22,prob:0.58}],
    groove_cowbl: [],
    groove_clap:  [{step:4,vel:0.40,offset:15,prob:0.80},{step:12,vel:0.37,offset:38,prob:0.75}],
    groove_tamb:  [{step:4,vel:0.30,offset:12,prob:0.58},{step:12,vel:0.28,offset:32,prob:0.54}],
    groove_shkr:  [{step:2,vel:0.22,offset:6,prob:0.50},{step:10,vel:0.20,offset:22,prob:0.46}],
    swing:0, beats:4,
  },

  'groove04': {
    groove_kick:  [{step:0,vel:0.90,offset:0,prob:1},{step:3,vel:0.60,offset:8,prob:0.85},{step:7,vel:0.70,offset:12,prob:0.82},{step:10,vel:0.55,offset:6,prob:0.78},{step:14,vel:0.60,offset:10,prob:0.74}],
    groove_snare: [{step:4,vel:0.82,offset:14,prob:1},{step:12,vel:0.78,offset:18,prob:1},{step:6,vel:0.13,offset:4,prob:0.50,ghost:true}],
    groove_hat:   [{step:0,vel:0.54,offset:0,prob:1},{step:2,vel:0.36,offset:5,prob:0.92},{step:4,vel:0.52,offset:8,prob:1},{step:6,vel:0.28,offset:10,prob:0.85},{step:8,vel:0.52,offset:2,prob:1},{step:10,vel:0.30,offset:7,prob:0.88},{step:12,vel:0.50,offset:6,prob:1},{step:14,vel:0.20,offset:12,prob:0.75}],
    groove_hiop:  [{step:3,vel:0.52,offset:20,prob:0.62},{step:11,vel:0.48,offset:24,prob:0.55}],
    groove_rim:   [{step:9,vel:0.40,offset:8,prob:0.66}],
    groove_cowbl: [{step:1,vel:0.36,offset:6,prob:0.68},{step:9,vel:0.33,offset:10,prob:0.63}],
    groove_clap:  [{step:4,vel:0.56,offset:18,prob:0.90},{step:12,vel:0.54,offset:22,prob:0.87}],
    groove_tamb:  [],
    groove_shkr:  [{step:0,vel:0.24,offset:4,prob:0.52},{step:4,vel:0.22,offset:8,prob:0.48},{step:8,vel:0.24,offset:5,prob:0.50},{step:12,vel:0.20,offset:10,prob:0.46}],
    swing:0.38, beats:4,
  },

  'groove05': {
    groove_kick:  [{step:0,vel:0.88,offset:0,prob:1},{step:8,vel:0.83,offset:5,prob:1},{step:11,vel:0.48,offset:16,prob:0.70}],
    groove_snare: [{step:4,vel:0.76,offset:22,prob:1},{step:12,vel:0.72,offset:28,prob:1},{step:6,vel:0.12,offset:6,prob:0.50,ghost:true}],
    groove_hat:   [{step:0,vel:0.53,offset:0,prob:1},{step:2,vel:0.35,offset:6,prob:0.90},{step:4,vel:0.50,offset:10,prob:1},{step:6,vel:0.25,offset:14,prob:0.80},{step:8,vel:0.52,offset:3,prob:1},{step:10,vel:0.27,offset:8,prob:0.83},{step:12,vel:0.49,offset:8,prob:1},{step:14,vel:0.18,offset:17,prob:0.70}],
    groove_hiop:  [{step:7,vel:0.48,offset:24,prob:0.65}],
    groove_rim:   [{step:2,vel:0.40,offset:8,prob:0.65}],
    groove_cowbl: [],
    groove_clap:  [{step:4,vel:0.50,offset:28,prob:0.85},{step:12,vel:0.48,offset:34,prob:0.82}],
    groove_tamb:  [{step:2,vel:0.30,offset:8,prob:0.56},{step:6,vel:0.28,offset:12,prob:0.52},{step:10,vel:0.30,offset:8,prob:0.54},{step:14,vel:0.26,offset:14,prob:0.48}],
    groove_shkr:  [],
    swing:0.42, beats:4,
  },

  'groove06': {
    groove_kick:  [{step:0,vel:0.88,offset:0,prob:1},{step:2,vel:0.56,offset:8,prob:0.80},{step:8,vel:0.84,offset:4,prob:1},{step:13,vel:0.58,offset:10,prob:0.74}],
    groove_snare: [{step:4,vel:0.80,offset:16,prob:1},{step:6,vel:0.12,offset:5,prob:0.50,ghost:true},{step:12,vel:0.76,offset:20,prob:1}],
    groove_hat:   [{step:0,vel:0.53,offset:0,prob:1},{step:1,vel:0.26,offset:10,prob:0.70},{step:2,vel:0.47,offset:5,prob:0.93},{step:3,vel:0.20,offset:14,prob:0.60},{step:4,vel:0.52,offset:8,prob:1},{step:5,vel:0.24,offset:4,prob:0.75},{step:6,vel:0.42,offset:10,prob:0.88},{step:8,vel:0.53,offset:2,prob:1},{step:10,vel:0.28,offset:8,prob:0.80},{step:12,vel:0.50,offset:6,prob:1},{step:14,vel:0.17,offset:14,prob:0.70}],
    groove_hiop:  [{step:7,vel:0.48,offset:22,prob:0.63}],
    groove_rim:   [{step:6,vel:0.38,offset:8,prob:0.60}],
    groove_cowbl: [],
    groove_clap:  [{step:4,vel:0.58,offset:16,prob:0.92},{step:12,vel:0.55,offset:20,prob:0.89}],
    groove_tamb:  [{step:0,vel:0.28,offset:4,prob:0.52},{step:4,vel:0.30,offset:8,prob:0.55},{step:8,vel:0.28,offset:5,prob:0.50},{step:12,vel:0.26,offset:10,prob:0.48}],
    groove_shkr:  [],
    swing:0.42, beats:4,
  },

  // ── SPECIAL / AMBIENT ──────────────────────────────────────────────────────

  'ambient01': {
    groove_kick:  [{step:0,vel:0.80,offset:0,prob:1},{step:8,vel:0.75,offset:8,prob:0.85}],
    groove_snare: [{step:4,vel:0.68,offset:30,prob:0.90},{step:12,vel:0.65,offset:36,prob:0.88}],
    groove_hat:   [{step:0,vel:0.38,offset:0,prob:0.90},{step:4,vel:0.35,offset:10,prob:0.85},{step:8,vel:0.36,offset:5,prob:0.88},{step:12,vel:0.33,offset:12,prob:0.82}],
    groove_hiop:  [{step:7,vel:0.40,offset:28,prob:0.55},{step:15,vel:0.38,offset:35,prob:0.48}],
    groove_rim:   [],
    groove_cowbl: [],
    groove_clap:  [],
    groove_tamb:  [{step:4,vel:0.30,offset:12,prob:0.60},{step:12,vel:0.28,offset:16,prob:0.55}],
    groove_shkr:  [{step:2,vel:0.20,offset:8,prob:0.50},{step:6,vel:0.18,offset:12,prob:0.45},{step:10,vel:0.20,offset:8,prob:0.48},{step:14,vel:0.16,offset:14,prob:0.42}],
    swing:0.50, beats:4,
  },

  'ambient02': {
    groove_kick:  [{step:0,vel:0.82,offset:0,prob:1}],
    groove_snare: [{step:4,vel:0.70,offset:32,prob:0.92},{step:12,vel:0.66,offset:38,prob:0.88}],
    groove_hat:   [{step:0,vel:0.36,offset:0,prob:0.88},{step:4,vel:0.33,offset:10,prob:0.82},{step:8,vel:0.35,offset:5,prob:0.85},{step:12,vel:0.30,offset:12,prob:0.80}],
    groove_hiop:  [{step:11,vel:0.42,offset:30,prob:0.55}],
    groove_rim:   [],
    groove_cowbl: [],
    groove_clap:  [],
    groove_tamb:  [{step:2,vel:0.28,offset:8,prob:0.52},{step:6,vel:0.26,offset:12,prob:0.48},{step:10,vel:0.28,offset:8,prob:0.50},{step:14,vel:0.24,offset:14,prob:0.44}],
    groove_shkr:  [{step:0,vel:0.22,offset:4,prob:0.55},{step:4,vel:0.20,offset:8,prob:0.50},{step:8,vel:0.21,offset:5,prob:0.52},{step:12,vel:0.18,offset:10,prob:0.46}],
    swing:0.48, beats:4,
  },

  'ambient03': {
    groove_kick:  [{step:0,vel:0.85,offset:0,prob:1},{step:8,vel:0.79,offset:6,prob:0.92}],
    groove_snare: [{step:4,vel:0.72,offset:26,prob:1},{step:12,vel:0.68,offset:32,prob:0.95}],
    groove_hat:   [{step:2,vel:0.32,offset:8,prob:0.75},{step:6,vel:0.28,offset:12,prob:0.68},{step:10,vel:0.30,offset:8,prob:0.72},{step:14,vel:0.26,offset:14,prob:0.65}],
    groove_hiop:  [{step:7,vel:0.44,offset:26,prob:0.60},{step:15,vel:0.40,offset:32,prob:0.52}],
    groove_rim:   [{step:5,vel:0.34,offset:12,prob:0.55}],
    groove_cowbl: [],
    groove_clap:  [{step:4,vel:0.35,offset:38,prob:0.70},{step:12,vel:0.32,offset:44,prob:0.65}],
    groove_tamb:  [{step:0,vel:0.26,offset:4,prob:0.50},{step:4,vel:0.28,offset:8,prob:0.52},{step:8,vel:0.26,offset:5,prob:0.48},{step:12,vel:0.24,offset:10,prob:0.46}],
    groove_shkr:  [],
    swing:0.50, beats:4,
  },

  'ambient04': {
    groove_kick:  [{step:0,vel:0.83,offset:0,prob:1},{step:8,vel:0.77,offset:7,prob:0.90},{step:12,vel:0.50,offset:15,prob:0.65}],
    groove_snare: [{step:4,vel:0.70,offset:28,prob:1},{step:12,vel:0.66,offset:34,prob:0.92}],
    groove_hat:   [{step:0,vel:0.40,offset:0,prob:0.92},{step:4,vel:0.36,offset:10,prob:0.86},{step:8,vel:0.38,offset:5,prob:0.90},{step:12,vel:0.34,offset:12,prob:0.84}],
    groove_hiop:  [{step:7,vel:0.42,offset:28,prob:0.58}],
    groove_rim:   [],
    groove_cowbl: [],
    groove_clap:  [{step:4,vel:0.33,offset:40,prob:0.68},{step:12,vel:0.30,offset:46,prob:0.63}],
    groove_tamb:  [{step:4,vel:0.26,offset:10,prob:0.50},{step:8,vel:0.24,offset:8,prob:0.48},{step:12,vel:0.25,offset:12,prob:0.48}],
    groove_shkr:  [{step:2,vel:0.18,offset:8,prob:0.48},{step:6,vel:0.16,offset:12,prob:0.44},{step:10,vel:0.18,offset:8,prob:0.46},{step:14,vel:0.14,offset:14,prob:0.40}],
    swing:0.50, beats:4,
  },

});

let rhythmLoop = null;
let kickSynth, snareSynth, hatSynth, hiopSynth, rimSynth, cowblSynth, clapSynth, tambSynth, shkrSynth;

