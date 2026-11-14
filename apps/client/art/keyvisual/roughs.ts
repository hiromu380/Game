/**
 * キービジュアルの構図 3案（段階1のラフ。Header Capsule 920×430）
 *
 * - A「押した瞬間」: 盤面から光の連鎖が放射状に走り、大きな数字が弾ける。手前にボルトが驚いて跳ねる
 * - B「工場の全景」: 夕暮れの工場街の屋根を連鎖の光が走り、ボルトのロケットが打ち上がる
 * - C「ボルトのアップ」: ボルトを大きく、背後に巨大な数字と盤面の連鎖
 * 実行: pnpm --filter @chain-factory/client exec tsx art/keyvisual/roughs.ts（docs/store/roughs/ に書き出す）
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BOARD_COLORS as B, SIGNAL_TIERS } from '../../src/assets/palette';
import { POSES } from '../characters/bolt';
import { svg } from '../svg';
import {
  bigNumber,
  board,
  bolt,
  burst,
  chainLight,
  duskSky,
  factoryRow,
  FILTERS,
  logo,
  pop,
  rocket,
  sparks,
  stars,
  type BoardCell,
} from './layers';

const W = 920;
const H = 430;

/** 見本の盤面（スイッチ → ギア → 分岐 → 上下に分かれて出荷口へ） */
const CELLS: BoardCell[] = [
  { x: 0, y: 2, part: 'switch', dir: 1 },
  { x: 1, y: 2, part: 'gear', dir: 1, floor: 'double' },
  { x: 2, y: 2, part: 'splitter', dir: 1 },
  { x: 2, y: 1, part: 'coil', dir: 1 },
  { x: 3, y: 1, part: 'press', dir: 1, floor: 'triple' },
  { x: 4, y: 1, part: 'dock', dir: 1 },
  { x: 2, y: 3, part: 'coil', dir: 1 },
  { x: 3, y: 3, part: 'barrel', dir: 1 },
  { x: 4, y: 3, part: 'dock', dir: 1 },
  { x: 1, y: 0, part: 'reflector', dir: 2 },
  { x: 3, y: 4, part: 'chainMeter', dir: 1 },
];

/** 盤面のマスの中心 */
const at =
  (bx: number, by: number, cell: number) =>
  (x: number, y: number): [number, number] => [bx + (x + 0.5) * cell, by + (y + 0.5) * cell];

const surprisedJump = {
  ...POSES.jump!.pose,
  variants: { ...POSES.jump!.pose.variants, head: 'surprised' },
};

function planA(): string[] {
  const bx = 470;
  const by = 112;
  const cell = 58;
  const c = at(bx, by, cell);
  return [
    FILTERS,
    ...duskSky(W, H, 300),
    ...stars(W, 260, 40),
    ...factoryRow(H + 20, W, 0.9),
    ...board(bx, by, 5, cell, CELLS),
    ...chainLight([c(0, 2), c(1, 2), c(2, 2), c(2, 1), c(3, 1), c(4, 1)], 7, 1),
    ...chainLight([c(2, 2), c(2, 3), c(3, 3), c(4, 3)], 7, 3),
    ...burst(...c(2, 2), 230, 18),
    ...sparks(...c(2, 2), 200, 22, 9),
    ...pop('×2', c(1, 2)[0], c(1, 2)[1] - 40, 0.9),
    ...pop('×3', c(3, 1)[0], c(3, 1)[1] - 40, 0.9),
    ...bigNumber('1.2B', 660, 26, 2.9, SIGNAL_TIERS[1]),
    bolt(surprisedJump, 300, 420, 290),
    logo(22, 22, 300),
  ];
}

function planB(): string[] {
  const roof = 320;
  const path: [number, number][] = [
    [-10, 300],
    [120, 270],
    [240, 300],
    [360, 250],
    [480, 285],
    [600, 230],
    [700, 260],
  ];
  return [
    FILTERS,
    ...duskSky(W, H, roof),
    ...stars(W, 240, 60),
    ...factoryRow(H, W, 1.25),
    ...chainLight(path, 8, 2),
    ...path.slice(1).flatMap(([x, y], i) => sparks(x, y, 30, 5, 7 + i)),
    ...pop('×2', 240, 262, 0.8),
    ...pop('×3', 480, 248, 0.8),
    ...rocket(770, 300, 250, true),
    ...bigNumber('1.2B', 520, 96, 2.4, SIGNAL_TIERS[1]),
    bolt(POSES.wave!.pose, 640, 330, 100),
    logo(22, 22, 300),
  ];
}

function planC(): string[] {
  const bx = 520;
  const by = 170;
  const cell = 64;
  const c = at(bx, by, cell);
  return [
    FILTERS,
    `<rect width="${W}" height="${H}" fill="${B.background}"/>`,
    ...stars(W, H, 30),
    ...board(bx, by, 5, cell, CELLS),
    ...chainLight([c(0, 2), c(1, 2), c(2, 2), c(2, 1), c(3, 1), c(4, 1)], 8, 1),
    ...chainLight([c(2, 2), c(2, 3), c(3, 3), c(4, 3)], 8, 3),
    ...burst(...c(2, 2), 260, 16, SIGNAL_TIERS[2]),
    ...bigNumber('1.2B', 640, 24, 4.2, SIGNAL_TIERS[1]),
    ...sparks(640, 70, 220, 18, 9),
    bolt(POSES.guts!.pose, 250, 520, 470),
    logo(22, 22, 260),
  ];
}

export function keyVisualRoughs(): Record<string, string> {
  const box = `0 0 ${W} ${H}`;
  return {
    'A.svg': svg('キービジュアル A「押した瞬間」（段階1のラフ）', planA(), box),
    'B.svg': svg('キービジュアル B「工場の全景」（段階1のラフ）', planB(), box),
    'C.svg': svg('キービジュアル C「ボルトのアップ」（段階1のラフ）', planC(), box),
  };
}

const here = dirname(fileURLToPath(import.meta.url));
const out = resolve(here, '../../../../docs/store/roughs');
mkdirSync(out, { recursive: true });
for (const [name, content] of Object.entries(keyVisualRoughs()))
  writeFileSync(resolve(out, name), content);
console.log(`wrote ${out}`);
