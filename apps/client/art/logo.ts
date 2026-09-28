/**
 * ロゴ（暗い背景用・明るい背景用）: 左に鎖と歯車の紋章、右に「CHAIN / FACTORY」の2段
 *
 * 120×45 に縮めても読めるよう、文字は太い線で2段に積む（docs/art-style.md「読みやすさの基準」）。
 * 名前は仮（「Chain Factory（仮）」）。名前が決まったら lettering の文字を差し替える
 */
import { FAMILY_COLORS as F, INK, UI_COLORS as U } from '../src/assets/palette';
import { lettering, textWidth } from './lettering';
import { circle, el, group, line, outlined, rect, rotate, svg, THIN } from './svg';

/** 紋章: 歯車の上に、つながった鎖の輪2つ（80×80 の箱） */
const emblem = () => {
  const teeth = Array.from({ length: 10 }, (_, i) =>
    rect(34, 2, 12, 14, { transform: rotate(i * 36, 40, 40) }, 2),
  );
  return group(
    {},
    group({ ...outlined(F.multiplier.main, 3) }, ...teeth),
    circle(40, 40, 30, outlined(F.multiplier.main, 4)),
    circle(40, 40, 22, { fill: INK.outline }),
    el('rect', {
      x: 18,
      y: 31,
      width: 26,
      height: 18,
      rx: 9,
      ...line(U.accent, 6),
      transform: rotate(-20, 31, 40),
    }),
    el('rect', {
      x: 36,
      y: 31,
      width: 26,
      height: 18,
      rx: 9,
      ...line(INK.white, 6),
      transform: rotate(-20, 49, 40),
    }),
    circle(40, 40, 30, { fill: 'none', stroke: INK.outline, 'stroke-width': THIN }),
  );
};

function logo(background: 'dark' | 'light'): string {
  const chainScale = 1.35;
  const factoryScale = 1.05;
  const width = Math.ceil(
    96 + Math.max(textWidth('CHAIN') * chainScale, textWidth('FACTORY') * factoryScale) + 12,
  );
  return svg(
    `ロゴ（${background === 'dark' ? '暗い' : '明るい'}背景用）`,
    [
      group({ transform: 'translate(4 5)' }, emblem()),
      lettering('CHAIN', { x: 96, y: 8, scale: chainScale, fill: U.accent }),
      lettering('FACTORY', {
        x: 97,
        y: 54,
        scale: factoryScale,
        fill: background === 'dark' ? INK.white : INK.outline,
        outline: background === 'dark' ? INK.outline : null,
      }),
    ],
    `0 0 ${width} 90`,
  );
}

export function logoFiles(): Record<string, string> {
  return {
    'src/assets/logo/logo-dark-bg.svg': logo('dark'),
    'src/assets/logo/logo-light-bg.svg': logo('light'),
  };
}
