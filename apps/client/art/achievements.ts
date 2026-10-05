/**
 * 実績アイコン（64×64）: 系統ごとの色の縁のメダル＋中央の絵（パーツ・ボス・ボルトの絵を流用）＋数字
 *
 * Steamworks には PNG で登録する（build/achievements/generate.mjs が 256px の PNG と、未解除用のグレー版を作る）。
 * 実績の定義は packages/sim の ACHIEVEMENTS。ここに無い実績があるとテストで失敗する。
 */
import type { AchievementId } from '@chain-factory/sim';
import {
  BOLT_COLORS,
  FAMILY_COLORS as F,
  INK,
  MATERIAL_COLORS as M,
  UI_COLORS as U,
} from '../src/assets/palette';
import { bossBody, uiBody } from './icons';
import { lettering } from './lettering';
import { boltBody } from './mascot';
import { partBody } from './parts';
import { circle, group, line, outlined, path, rect, svg } from './svg';

/** 実績の系統（メダルの縁の色） */
type Group = 'ship' | 'shift' | 'boss' | 'chain' | 'progress' | 'weekly' | 'secret';

const RING: Record<Group, string> = {
  ship: F.multiplier.main,
  shift: F.placement.main,
  boss: U.missed,
  chain: F.branch.main,
  progress: F.hazard.main,
  weekly: F.retrigger.main,
  secret: F.economy.main,
};

/** 64×64 の絵を、中央に縮小して置く */
const art = (body: string[], scale = 0.62, viewBoxShift = 0) =>
  group(
    {
      transform: `translate(${32 - 32 * scale + viewBoxShift} ${30 - 32 * scale}) scale(${scale})`,
    },
    ...body,
  );

/** 24×24 の UI アイコンを中央に置く */
const uiArt = (name: string, size = 30) =>
  group(
    { transform: `translate(${32 - size / 2} ${28 - size / 2}) scale(${size / 24})` },
    ...uiBody(name),
  );

/** 下側の数字の札 */
const label = (text: string, scale = 0.5) =>
  group(
    {},
    rect(12, 44, 40, 15, { fill: INK.outline, stroke: INK.outline, 'stroke-width': 2 }, 5),
    lettering(text, {
      x: 32,
      y: 45.5,
      scale,
      fill: INK.white,
      outline: null,
      weight: 4,
      anchor: 'middle',
    }),
  );

const box = (x: number, y: number, s: number) =>
  group(
    {},
    rect(x, y, s, s * 0.8, outlined(M.cardboard, 2.5), 2),
    path(`M${x + s / 2} ${y} V${y + s * 0.35}`, line(M.cardboardDark, 2)),
  );

const moon = () => path('M38 10 a14 14 0 1 0 12 22 a11 11 0 1 1 -12 -22 Z', outlined(M.sun, 3));

const DEFS: Record<AchievementId, { group: Group; body: string[] }> = {
  ACH_FIRST_SHIP: { group: 'ship', body: [box(20, 16, 24)] },
  ACH_FIRST_SHIFT: { group: 'shift', body: [art(boltBody('happy'), 0.6, 1)] },
  ACH_FIRST_NIGHT: { group: 'shift', body: [moon()] },
  ACH_FULL_CLEAR: {
    group: 'shift',
    body: [
      circle(32, 26, 14, outlined(INK.white, 3)),
      path('M32 17 V26 L38 30', line(INK.outline, 3)),
      label('9'),
    ],
  },
  ACH_FULL_CLEAR_10: {
    group: 'progress',
    body: [uiArt('ranking', 32), label('10')],
  },
  ACH_BOSS_LOWOIL: { group: 'boss', body: [art(bossBody('lowOil'), 0.66)] },
  ACH_BOSS_REPAIR: { group: 'boss', body: [art(bossBody('repairWork'), 0.66)] },
  ACH_BOSS_INSPECTION: { group: 'boss', body: [art(bossBody('strictInspection'), 0.66)] },
  ACH_BOSS_SHORT: { group: 'boss', body: [art(bossBody('shortShift'), 0.66)] },
  ACH_BOSS_SHORTAGE: { group: 'boss', body: [art(bossBody('partShortage'), 0.66)] },
  ACH_CHAIN_25: { group: 'chain', body: [art(partBody('chainMeter'), 0.5), label('25')] },
  ACH_CHAIN_100: { group: 'chain', body: [art(partBody('chainMeter'), 0.5), label('100', 0.45)] },
  ACH_CHAIN_300: { group: 'chain', body: [art(partBody('chainMeter'), 0.5), label('300', 0.45)] },
  ACH_SHIFT_1M: { group: 'ship', body: [box(22, 12, 20), label('1M')] },
  ACH_SHIFT_1B: { group: 'ship', body: [box(16, 16, 16), box(32, 12, 18), label('1B')] },
  ACH_SHIFT_1T: {
    group: 'ship',
    body: [box(13, 20, 14), box(25, 10, 16), box(37, 18, 15), label('1T')],
  },
  ACH_TOTAL_1B: { group: 'progress', body: [art(partBody('dock'), 0.5), label('1B')] },
  ACH_RUNS_10: { group: 'progress', body: [art(boltBody('idle'), 0.5, 1), label('10')] },
  ACH_RUNS_50: { group: 'progress', body: [art(boltBody('happy'), 0.5, 1), label('50')] },
  ACH_FACTORY_8: { group: 'progress', body: [uiArt('expand'), label('8×8', 0.42)] },
  ACH_FACTORY_9: { group: 'progress', body: [uiArt('expand'), label('9×9', 0.42)] },
  ACH_ALL_PARTS: {
    group: 'progress',
    body: [
      group({ transform: 'translate(12 8) scale(0.32)' }, ...partBody('gear')),
      group({ transform: 'translate(32 8) scale(0.32)' }, ...partBody('splitter')),
      group({ transform: 'translate(12 28) scale(0.32)' }, ...partBody('turntable')),
      group({ transform: 'translate(32 28) scale(0.32)' }, ...partBody('coil')),
    ],
  },
  ACH_OVERTIME_3: {
    group: 'shift',
    body: [group({ transform: 'translate(0 -4)' }, moon()), label('3')],
  },
  ACH_OVERTIME_9: {
    group: 'shift',
    body: [group({ transform: 'translate(0 -4)' }, moon()), label('9')],
  },
  ACH_DAILY_FIRST: { group: 'weekly', body: [uiArt('weekly', 32)] },
  ACH_DAILY_CLEAR: {
    group: 'weekly',
    body: [uiArt('weekly', 30), path('M36 38 l5 5 l10 -12', line(U.met, 4))],
  },
  ACH_DAILY_TOP10: { group: 'weekly', body: [uiArt('ranking', 28), label('10%', 0.42)] },
  ACH_DAILY_7: { group: 'weekly', body: [uiArt('weekly', 28), label('7')] },
  ACH_JUNKBOT_JACKPOT: {
    group: 'secret',
    body: [art(partBody('junkbot'), 0.5), label('×3')],
  },
  ACH_ZERO: { group: 'secret', body: [art(boltBody('surprised'), 0.5, 1), label('0')] },
};

function medal(ring: string, body: string[]): string[] {
  return [
    circle(32, 32, 30, { fill: ring, stroke: INK.outline, 'stroke-width': 3 }),
    circle(32, 32, 24, { fill: U.panel, stroke: INK.outline, 'stroke-width': 2 }),
    path('M14 20 a20 20 0 0 1 12 -10', line(BOLT_COLORS.eye, 2)),
    ...body,
  ];
}

export function achievementFiles(): Record<string, string> {
  return Object.fromEntries(
    Object.entries(DEFS).map(([id, { group: g, body }]) => [
      `src/assets/achievements/${id}.svg`,
      svg(`実績: ${id}`, medal(RING[g], body)),
    ]),
  );
}

/** 実績の定義にある ID（テストで、アイコンが全部あるか確かめる） */
export const ACHIEVEMENT_ICON_IDS = Object.keys(DEFS);
