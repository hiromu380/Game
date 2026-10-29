/**
 * 色の定義（1か所。CSS の変数にも、ここから流し込む）
 *
 * 相撲絵の平たい色面を、和紙の上に置いたような落ち着いた色。docs/art-style.md
 */
export const PALETTE = {
  washi: '#f4ecdc',
  washi2: '#eadfc8',
  card: '#fffaf0',
  sumi: '#2a2420',
  sumi2: '#4d4339',
  muted: '#6a5e50',
  line: '#d6c7a8',
  ai: '#1f4466',
  aiLight: '#dfe8ef',
  beni: '#b3322a',
  beniLight: '#f6dcd6',
  odo: '#c69a4a',
  odoLight: '#ead7a8',
  wakatake: '#4f7a4a',
  murasaki: '#5b3d6e',
  kincha: '#a8742a',
  gold: '#7a5a00',
  goldBg: '#f6e7b0',
  /** 肌（3種） */
  skin: ['#f6d7b8', '#eec5a0', '#e2b38a'] as const,
  cheek: '#ef9a8f',
  white: '#ffffff',
} as const;

/** 関取の締め込みの色（部屋ごとに決まる） */
export const SHIMEKOMI = [
  PALETTE.ai,
  PALETTE.murasaki,
  PALETTE.kincha,
  PALETTE.beni,
  PALETTE.wakatake,
  '#2f2f5a',
] as const;

/** 和柄（CSS の背景に使う SVG） */
function svgUrl(svg: string): string {
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

/** 青海波 */
export function seigaiha(color: string, opacity: number): string {
  const arc = (cx: number, cy: number) =>
    [18, 13, 8]
      .map(
        (r) =>
          `<path d="M${cx - r} ${cy} A${r} ${r} 0 0 1 ${cx + r} ${cy}" fill="none" stroke="${color}" stroke-width="1.6"/>`,
      )
      .join('');
  return svgUrl(
    `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="20" opacity="${opacity}">${arc(0, 20)}${arc(40, 20)}${arc(20, 10)}${arc(0, 0)}${arc(40, 0)}</svg>`,
  );
}

/** 麻の葉（六角の星） */
export function asanoha(color: string, opacity: number): string {
  const w = 30;
  const h = 52;
  const lines = [
    [w / 2, 0, w / 2, h],
    [0, 0, w, h],
    [w, 0, 0, h],
    [0, h / 2, w, h / 2],
    [0, 0, w / 2, h / 2],
    [w, 0, w / 2, h / 2],
    [0, h, w / 2, h / 2],
    [w, h, w / 2, h / 2],
  ]
    .map(
      ([a, b, c, d]) =>
        `<line x1="${a}" y1="${b}" x2="${c}" y2="${d}" stroke="${color}" stroke-width="0.8"/>`,
    )
    .join('');
  return svgUrl(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" opacity="${opacity}">${lines}</svg>`,
  );
}

/** CSS の変数を流し込む（起動時に1回） */
export function applyPalette(root: HTMLElement = document.documentElement): void {
  const vars: Record<string, string> = {
    '--paper': PALETTE.washi,
    '--paper-2': PALETTE.washi2,
    '--card': PALETTE.card,
    '--ink': PALETTE.sumi,
    '--ink-2': PALETTE.sumi2,
    '--muted': PALETTE.muted,
    '--line': PALETTE.line,
    '--ai': PALETTE.ai,
    '--ai-light': PALETTE.aiLight,
    '--shu': PALETTE.beni,
    '--shu-light': PALETTE.beniLight,
    '--odo': PALETTE.odo,
    '--odo-light': PALETTE.odoLight,
    '--good': PALETTE.wakatake,
    '--gold': PALETTE.gold,
    '--gold-bg': PALETTE.goldBg,
    '--focus': PALETTE.ai,
    '--pattern-seigaiha': seigaiha(PALETTE.ai, 0.08),
    '--pattern-seigaiha-strong': seigaiha(PALETTE.washi, 0.22),
    '--pattern-asanoha': asanoha(PALETTE.odo, 0.18),
  };
  for (const [k, v] of Object.entries(vars)) root.style.setProperty(k, v);
}
