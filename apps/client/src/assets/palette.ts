/**
 * カラーパレット（色の定義はこのファイル1か所に集約する: CLAUDE.md「実装ルール」・docs/art-style.md）
 *
 * - 画面（CSS）: `pnpm --filter @chain-factory/client art` で src/styles/palette.css の CSS 変数に書き出す
 * - 盤面（PixiJS）: manifest.ts の BOARD_THEME がここを参照する
 * - 素材（SVG）: art/ の生成スクリプトがここの色を埋め込んで src/assets/ に書き出す
 * 色を変えたら `pnpm --filter @chain-factory/client art` で書き出し直す（ずれはテストで検出する）。
 */

/** 画面の基本色（CSS 変数 --<キー> として書き出す） */
export const UI_COLORS = {
  bg: '#1a1c20',
  panel: '#262a31',
  'panel-border': '#3a3f48',
  text: '#eef0f3',
  muted: '#a3aab5',
  /** ハザードイエロー（アクセント・警告・ハザード柄） */
  accent: '#ffc107',
  'hazard-black': '#2b2b2b',
  /** 本番スイッチの赤 */
  primary: '#e53935',
  'primary-hover': '#f44336',
  'primary-shadow': '#8e1414',
  secondary: '#3a404a',
  /** ノルマ達成・良い結果 */
  met: '#69f0ae',
  /** ノルマ未達・悪い結果 */
  missed: '#ff5252',
  selected: '#ffeb3b',
} as const;

/** 素材の線（アウトライン）と、共通の白・黒 */
export const INK = {
  /** 素材の輪郭線（ほぼ黒の紺。純黒より柔らかく見える） */
  outline: '#1b1f27',
  white: '#ffffff',
  black: '#000000',
  /** 金属パーツの地の色 */
  steel: '#90a4ae',
  steelLight: '#cfd8dc',
  steelDark: '#546e7a',
} as const;

/**
 * パーツの系統色（docs/art-style.md「パーツ」）
 * 倍率=橙、分岐=紫、再発動=水色、配置=緑、経済=桃、基本=灰と黄
 */
export const FAMILY_COLORS = {
  multiplier: { main: '#fb8c00', light: '#ffcc80' },
  branch: { main: '#8e24aa', light: '#ce93d8' },
  retrigger: { main: '#00acc1', light: '#80deea' },
  placement: { main: '#43a047', light: '#a5d6a7' },
  economy: { main: '#ec407a', light: '#f8bbd0' },
  basic: { main: '#90a4ae', light: '#eceff1' },
  hazard: { main: '#ffc107', light: '#ffe082' },
} as const;

export type Family = keyof typeof FAMILY_COLORS;

/** マスコット「ボルト」 */
export const BOLT_COLORS = {
  body: '#7cb342',
  bodyLight: '#9ccc65',
  outline: '#33691e',
  lamp: '#ffeb3b',
  eye: '#ffffff',
  pupil: '#212121',
  cheek: '#f48fb1',
  sweat: '#81d4fa',
} as const;

/** 盤面（床・枠・マス）とボス */
export const BOARD_COLORS = {
  background: '#23272e',
  floorA: '#4a4f57',
  floorB: '#454a52',
  floorLine: '#363a41',
  /** 床の汚れ・ボルトの頭など、床の細部 */
  floorDetail: '#3d4249',
  hazardYellow: '#ffc107',
  hazardBlack: '#2b2b2b',
  /** 使用不可マス（補修工事） */
  blocked: '#c62828',
  selected: '#ffeb3b',
  ghostOk: '#69f0ae',
  arrowFill: '#ffeb3b',
  arrowStroke: '#3e2723',
  badgeFill: '#212121',
  badgeText: '#ffeb3b',
  signalText: '#1b1f27',
  glow: '#ffffff',
  reset: '#4dd0e1',
  shipText: '#69f0ae',
  pipFilled: '#ffeb3b',
  pipEmpty: '#9e9e9e',
  incomeText: '#ffd54f',
  tooltipBg: '#111418',
  tooltipText: '#ffffff',
} as const;

/** 信号の色（値の桁数が増えるほど派手になる） */
export const SIGNAL_TIERS = [
  '#fff176',
  '#ffb74d',
  '#ff7043',
  '#f06292',
  '#ba68c8',
  '#4dd0e1',
] as const;

/** 信号が消えた理由ごとの色（状態表示） */
export const VANISH_COLORS = {
  outOfBoard: '#90a4ae',
  emptyCell: '#ffb74d',
  exhausted: '#ef5350',
  blocked: '#c62828',
  inert: '#9575cd',
} as const;

/** '#rrggbb' → 0xRRGGBB（PixiJS 用） */
export function hex(color: string): number {
  return parseInt(color.slice(1), 16);
}

/** 色を暗くする（1段の影に使う。amount 0〜1） */
export function darken(color: string, amount: number): string {
  const n = hex(color);
  const channel = (shift: number) => Math.round(((n >> shift) & 0xff) * (1 - amount));
  return `#${[16, 8, 0].map((s) => channel(s).toString(16).padStart(2, '0')).join('')}`;
}
