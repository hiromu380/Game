/**
 * レリックのアイコン（64×64）。土台は紫の六角形の宝石枠（今日の出来事の緑の札・ボスの丸い標識と形で見分ける）
 * 中身は、効果が効くパーツの絵を縮めて置き、小さな記号を添える
 */
import type { PartId, RelicId } from '@chain-factory/sim';
import {
  FAMILY_COLORS as F,
  INK,
  MATERIAL_COLORS as M,
  UI_COLORS as U,
} from '../src/assets/palette';
import { partBody } from './parts';
import { circle, group, line, outlined, path, polygon, rect, svg } from './svg';

const O = INK.outline;

/** 六角形の宝石枠 */
const frame = () => [
  polygon('32,3 57,17 57,47 32,61 7,47 7,17', outlined('#7e57c2', 3)),
  polygon('32,9 52,20 52,44 32,55 12,44 12,20', { fill: '#ede7f6', stroke: O, 'stroke-width': 2 }),
  path('M16 19 L28 12', line(INK.white, 2.5)),
];

/** パーツの絵を中央に縮めて置く */
const part = (id: PartId, scale = 0.56, dy = 0) =>
  group(
    { transform: `translate(${32 - 32 * scale} ${32 - 32 * scale + dy}) scale(${scale})` },
    ...partBody(id),
  );

/** 右下の小さな記号の札（＋・↑ など） */
const tag = (text: string, color: string = F.hazard.main) =>
  group({}, circle(46, 46, 8, outlined(color, 2)), el(text));

/** 札の中の記号（＋・↓・↑） */
function el(text: string): string {
  switch (text) {
    case '+':
      return path('M42 46 h8 M46 42 v8', line(O, 2.5));
    case '-':
      return path('M42 46 h8', line(O, 2.5));
    case 'up':
      return path('M46 50 v-8 M42 45 l4 -4 l4 4', line(O, 2.2));
    default:
      return '';
  }
}

const RELICS: Record<RelicId, string[]> = {
  spareSwitch: [part('switch', 0.5, -2), tag('+')],
  gearGloves: [part('gear', 0.5), tag('up')],
  rewoundCoil: [part('coil', 0.5), tag('up')],
  doubleCheck: [part('inspector', 0.5), tag('up')],
  chainPulse: [part('chainMeter', 0.5), tag('up')],
  goldLeaf: [
    rect(20, 20, 24, 24, outlined('#ffd54f', 2.5), 4),
    polygon(
      '32,23 35,30 42,30 36,35 38,42 32,38 26,42 28,35 22,30 29,30',
      outlined('#ff8f00', 1.5),
    ),
    tag('up'),
  ],
  junkbotHunch: [part('junkbot', 0.5), tag('up')],
  polishedFloor: [
    polygon('14,36 32,26 50,36 32,46', outlined(F.hazard.main, 2)),
    path('M24 36 l4 -2 M34 32 l4 -2', line(INK.white, 2)),
    path('M42 18 l2 5 l5 2 l-5 2 l-2 5 l-2 -5 l-5 -2 l5 -2 Z', outlined('#fff59d', 1.2)),
  ],
  spareOil: [part('oiler', 0.5), tag('+')],
  afterglow: [part('barrel', 0.5), tag('+', M.fire)],
  piggyHabit: [part('piggyBank', 0.5), tag('+')],
  coupon: [
    rect(14, 22, 36, 20, outlined('#ffcc80', 2.5), 3),
    path('M22 22 v20', { ...line(O, 1.5), 'stroke-dasharray': '3 2' }),
    path('M30 36 l8 -8', line(O, 2)),
    circle(31, 29, 2, { fill: O }),
    circle(38, 36, 2, { fill: O }),
    tag('-', U.met),
  ],
  connoisseur: [
    circle(28, 30, 10, outlined('#b3e5fc', 2.5)),
    path('M35 37 L44 46', line(O, 5)),
    path('M24 26 a5 5 0 0 1 5 -2', line(INK.white, 2)),
    tag('+'),
  ],
  nightPay: [
    path('M36 16 a14 14 0 1 0 10 22 a11 11 0 1 1 -10 -22 Z', outlined(M.sun, 2.5)),
    circle(24, 40, 6, outlined(M.coin, 2)),
    tag('+'),
  ],
  floorCraftsman: [
    polygon('14,38 32,28 50,38 32,48', outlined('#4dd0e1', 2)),
    rect(28, 14, 8, 14, outlined(INK.steel, 2), 2),
    rect(24, 12, 16, 5, outlined(F.retrigger.main, 2), 2),
    tag('+'),
  ],
};

export function relicFiles(): Record<string, string> {
  const files: Record<string, string> = {};
  for (const [id, body] of Object.entries(RELICS)) {
    files[`src/assets/relics/${id}.svg`] = svg(`レリック: ${id}`, [...frame(), ...body]);
  }
  return files;
}
