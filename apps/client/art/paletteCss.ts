/**
 * palette.ts → CSS 変数（src/styles/palette.css）
 */
import {
  BOARD_COLORS,
  FX_COLORS,
  INK,
  TITLE_COLORS,
  UI_COLORS,
  VANISH_COLORS,
} from '../src/assets/palette';

export function paletteCss(): string {
  const vars = [
    ...Object.entries(UI_COLORS).map(([k, v]) => `  --${k}: ${v};`),
    `  --white: ${INK.white};`,
    `  --ink-outline: ${INK.outline};`,
    `  --ship-box: ${FX_COLORS.shipBox};`,
    `  --ship-box-tape: ${FX_COLORS.shipBoxTape};`,
    `  --hazard-yellow: ${BOARD_COLORS.hazardYellow};`,
    ...Object.entries(VANISH_COLORS).map(([k, v]) => `  --vanish-${k}: ${v};`),
    ...Object.entries(TITLE_COLORS).map(([k, v]) => `  --title-${k}: ${v};`),
  ];
  return [
    '/* カラーパレットの CSS 変数（src/assets/palette.ts から art/ のスクリプトで生成。手で編集しない） */',
    ':root {',
    ...vars,
    '}',
    '',
  ].join('\n');
}
