/**
 * パーツ20種の画像（64×64・モチーフは中央の約 70% に収める: docs/art-style.md「形と線」）
 *
 * 色は系統色（FAMILY_COLORS）が主。回転して向きを表すパーツ（コンベア・分岐器・散布機）は上向きに描く。
 * モチーフの案は docs/plans/phase4-plan.md §9「パーツのモチーフ案」。
 */
import type { PartId } from '@chain-factory/sim';
import { FAMILY_COLORS as F, INK, MATERIAL_COLORS as M, UI_COLORS } from '../src/assets/palette';
import {
  circle,
  el,
  group,
  line,
  outlined,
  path,
  polygon,
  rect,
  rotate,
  shade,
  svg,
  THIN,
} from './svg';

/** ハザード柄（黄・黒の斜めじま）の塗り。使う SVG の中で1回 defs に入れる */
export const hazardDefs = (id = 'hazard', size = 8) =>
  el(
    'defs',
    {},
    el(
      'pattern',
      {
        id,
        width: size,
        height: size,
        patternUnits: 'userSpaceOnUse',
        patternTransform: 'rotate(45)',
      },
      rect(0, 0, size / 2, size, { fill: F.hazard.main }),
      rect(size / 2, 0, size / 2, size, { fill: UI_COLORS['hazard-black'] }),
    ),
  );

/** 上向きの矢じり（x,y が先端） */
const arrowHead = (x: number, y: number, s: number, fill: string) =>
  polygon(`${x},${y} ${x + s},${y + s} ${x - s},${y + s}`, outlined(fill, THIN));

const O = INK.outline;

const PARTS: Record<PartId, () => string[]> = {
  // スイッチ: 黄黒ハザード台座に乗った大きな赤い押しボタン
  switch: () => [
    hazardDefs(),
    rect(9, 36, 46, 17, outlined('url(#hazard)'), 5),
    rect(20, 28, 24, 12, outlined(INK.steelDark), 3),
    path('M16 30 a16 13 0 0 1 32 0 v2 a16 6 0 0 1 -32 0 Z', outlined(UI_COLORS.primary)),
    path('M17 32 a15 6 0 0 0 30 0 v-2 a15 6 0 0 1 -30 0 Z', { fill: UI_COLORS['primary-shadow'] }),
    path('M23 22 q5 -5 12 -4', line(INK.white, 2.5)),
  ],

  // ベルトコンベア: 上向きの矢羽根が並んだベルト（ローラー2本）
  conveyor: () => [
    rect(15, 9, 34, 46, outlined(INK.steelDark), 4),
    rect(11, 8, 42, 7, outlined(INK.steel), 3.5),
    rect(11, 49, 42, 7, outlined(INK.steel), 3.5),
    ...[40, 29, 18].map((y) =>
      path(
        `M21 ${y + 8} L32 ${y} L43 ${y + 8} L43 ${y + 12} L32 ${y + 4} L21 ${y + 12} Z`,
        outlined(F.hazard.main, THIN),
      ),
    ),
  ],

  // 出荷口: 半分開いたシャッター付きの搬出口と、出ていく段ボール箱
  dock: () => [
    rect(8, 10, 48, 44, outlined(INK.steel), 4),
    rect(14, 16, 36, 38, { fill: M.shadowHole }),
    rect(14, 16, 36, 16, outlined(INK.steelLight, THIN)),
    ...[20, 24, 28].map((y) => path(`M16 ${y} H48`, line(INK.steelDark, 1.5))),
    // 段ボール箱
    rect(21, 36, 22, 17, outlined(M.cardboard), 1.5),
    rect(21, 36, 22, 5, { fill: M.cardboardDark, opacity: 0.6 }),
    path('M32 36 V44', line(M.cardboardDark, 2)),
    path('M27 48 h10', line(O, 1.5)),
  ],

  // ポンコツロボ: ボルトの親戚の小型ロボ（片目がずれていて、頭に「?」のランプ）
  junkbot: () => [
    path('M33 16 V9', line(O, 3)),
    circle(33, 8, 5, outlined(F.hazard.main, THIN)),
    path('M31 6.5 q2 -2 3.5 0 q0 1.5 -1.5 2 v1', line(O, 1.5)),
    rect(12, 16, 40, 34, { ...outlined(INK.steel), transform: rotate(5, 32, 33) }, 8),
    rect(12, 40, 40, 10, { fill: shade(INK.steel), transform: rotate(5, 32, 33) }, 0),
    circle(24, 30, 6.5, outlined(INK.white, THIN)),
    circle(26, 31, 3, { fill: O }),
    circle(42, 27, 4, outlined(INK.white, THIN)),
    circle(41, 26, 1.8, { fill: O }),
    path('M23 42 h4 l2 -2 l2 2 l2 -2 l2 2 h4', line(O, THIN)),
    rect(10, 50, 8, 6, outlined(INK.steelDark, THIN), 2),
    rect(46, 52, 8, 5, outlined(INK.steelDark, THIN), 2),
  ],

  // 増幅ギア: 大きな歯車と小さな歯車が噛み合い、中央に「×2」
  gear: () => {
    const teeth = (cx: number, cy: number, r: number, n: number, w: number, fill: string) =>
      group(
        { fill, stroke: O, 'stroke-width': THIN, 'stroke-linejoin': 'round' },
        ...Array.from({ length: n }, (_, i) =>
          rect(cx - w / 2, cy - r - 4, w, 8, { transform: rotate((360 / n) * i, cx, cy) }, 1.5),
        ),
      );
    return [
      teeth(47, 17, 8, 6, 5, F.multiplier.light),
      circle(47, 17, 8, outlined(F.multiplier.light, THIN)),
      circle(47, 17, 2.5, { fill: O }),
      teeth(28, 36, 17, 10, 7, F.multiplier.main),
      circle(28, 36, 17, outlined(F.multiplier.main)),
      circle(28, 36, 11, { fill: shade(F.multiplier.main) }),
      path('M21 31 l7 7 M28 31 l-7 7', line(INK.white, 2.5)),
      path('M30 31 q4 -2 5 1 q0 2 -5 6 h6', line(INK.white, 2.5)),
    ];
  },

  // プレス機: 上から押し潰す油圧プレスのヘッドと、4方向へ伸びる腕（隣接マスに効く）
  press: () => [
    ...[
      [30, 6, 4, 6],
      [30, 52, 4, 6],
      [6, 30, 6, 4],
      [52, 30, 6, 4],
    ].map(([x, y, w, h]) => rect(x!, y!, w!, h!, outlined(F.multiplier.light, THIN), 1)),
    rect(12, 11, 40, 9, outlined(F.multiplier.main), 3),
    rect(28, 20, 8, 10, outlined(INK.steelLight, THIN)),
    rect(16, 30, 32, 8, outlined(F.multiplier.main), 2),
    rect(16, 34, 32, 4, { fill: shade(F.multiplier.main) }),
    rect(12, 44, 40, 9, outlined(INK.steelDark), 2),
    path('M22 41 v-1 M32 41 v-1 M42 41 v-1', line(O, 2)),
  ],

  // 合流炉: 漏斗型の炉に3本の配管が集まり、下から1本出る
  merger: () => [
    rect(10, 7, 8, 12, outlined(INK.steel, THIN), 2),
    rect(28, 5, 8, 12, outlined(INK.steel, THIN), 2),
    rect(46, 7, 8, 12, outlined(INK.steel, THIN), 2),
    path('M9 18 H55 L39 40 H25 Z', outlined(F.multiplier.main)),
    path('M14 25 H50 L39 40 H25 Z', { fill: shade(F.multiplier.main) }),
    circle(32, 27, 4, { fill: M.fire, stroke: O, 'stroke-width': 1.5 }),
    rect(26, 40, 12, 15, outlined(INK.steel), 2),
  ],

  // 連鎖メーター: 針が振り切れそうな半円メーターに鎖のマーク
  chainMeter: () => [
    path('M9 38 a23 23 0 0 1 46 0 Z', outlined(F.multiplier.light)),
    path('M44 22 a23 23 0 0 1 11 16 H47 a15 15 0 0 0 -7 -11 Z', { fill: UI_COLORS.missed }),
    ...[-80, -50, -20, 10, 40, 70].map((deg) =>
      path('M32 17 v4', { ...line(O, 2), transform: rotate(deg, 32, 38) }),
    ),
    path('M32 38 L50 27', line(O, 3)),
    circle(32, 38, 3.5, { fill: O }),
    rect(9, 38, 46, 5, outlined(F.multiplier.main, THIN), 1),
    el('ellipse', { cx: 26, cy: 51, rx: 6, ry: 4, ...line(INK.steelDark, 3) }),
    el('ellipse', { cx: 38, cy: 51, rx: 6, ry: 4, ...line(INK.steel, 3) }),
  ],

  // 分岐器: 1本のレールが左右2本に分かれる（上向き基準: 下から入って左右へ）
  splitter: () => [
    path('M32 56 V32 Q32 24 22 24 H12 M32 32 Q32 24 42 24 H52', line(O, 12)),
    path('M32 56 V32 Q32 24 22 24 H12 M32 32 Q32 24 42 24 H52', line(F.branch.main, 7)),
    polygon('6,24 14,17 14,31', outlined(F.branch.light, THIN)),
    polygon('58,24 50,17 50,31', outlined(F.branch.light, THIN)),
    rect(26, 44, 12, 10, outlined(INK.steel, THIN), 2),
  ],

  // 散布機: スプリンクラーのヘッドから前・左・右の3方向に噴射（上向き基準）
  spreader: () => [
    ...[0, -90, 90].map((deg) =>
      group(
        { transform: rotate(deg) },
        path('M32 20 V12', line(F.branch.light, 5)),
        arrowHead(32, 6, 6, F.branch.light),
      ),
    ),
    rect(28, 36, 8, 18, outlined(INK.steel, THIN), 2),
    circle(32, 32, 11, outlined(F.branch.main)),
    circle(32, 32, 4, { fill: shade(F.branch.main), stroke: O, 'stroke-width': 1.5 }),
  ],

  // 爆発ドラム缶: ハザード柄の帯が入ったドラム缶と、8方向の小さな爆発マーク
  barrel: () => [
    hazardDefs('hz', 6),
    ...Array.from({ length: 8 }, (_, i) =>
      path('M32 3 V8', { ...line(M.fire, 3), transform: rotate(i * 45) }),
    ),
    rect(17, 12, 30, 41, outlined(F.branch.main), 5),
    rect(17, 27, 30, 11, outlined('url(#hz)', THIN)),
    rect(40, 14, 5, 37, { fill: shade(F.branch.main), opacity: 0.8 }),
    path('M17 20 H47 M17 45 H47', line(O, 2)),
  ],

  // コピー機: 紙が2枚ずれて出てくるコピー機（前方に2連の矢印）
  copier: () => [
    rect(20, 6, 20, 16, outlined(M.paper, THIN), 1),
    rect(25, 3, 20, 16, outlined(M.paper, THIN), 1),
    path('M29 8 h12 M29 12 h9', line(INK.steel, 1.5)),
    rect(9, 20, 46, 30, outlined(F.branch.light), 5),
    rect(9, 38, 46, 12, { fill: shade(F.branch.light) }),
    rect(9, 20, 46, 30, line(O, 4), 5),
    rect(16, 26, 20, 7, outlined(M.solarCell, THIN), 2),
    circle(45, 29, 3, { fill: F.branch.main, stroke: O, 'stroke-width': 1.5 }),
    rect(14, 50, 36, 6, outlined(INK.steelDark, THIN), 2),
  ],

  // 反射板: 斜めの鏡面パネルと、跳ね返る矢印（U 字）
  reflector: () => [
    path('M20 50 V26 a12 12 0 0 1 24 0 V36', line(F.retrigger.light, 5)),
    polygon('44,48 36,36 52,36', outlined(F.retrigger.light, THIN)),
    path('M20 50 V26 a12 12 0 0 1 24 0 V36', { ...line(O, 1.5), opacity: 0.4 }),
    rect(8, 8, 48, 8, outlined(F.retrigger.main), 3),
    path('M14 11 h10', line(INK.white, 2)),
  ],

  // 回転台: 円形のターンテーブルに回転矢印（時計回り）
  turntable: () => [
    circle(32, 32, 23, outlined(F.retrigger.main)),
    circle(32, 32, 15, { fill: shade(F.retrigger.main) }),
    path('M32 17 a15 15 0 1 1 -14.5 11', line(F.retrigger.light, 4.5)),
    polygon('32,11 40,17 32,23', outlined(F.retrigger.light, THIN)),
    circle(32, 32, 4, { fill: INK.steelLight, stroke: O, 'stroke-width': THIN }),
  ],

  // 再起動装置: 電源マーク（⏻）の大きなボタンと、周囲4方向の稲妻
  rebooter: () => [
    ...[0, 90, 180, 270].map((deg) =>
      polygon('32,3 28,11 32,11 30,16 37,8 33,8 35,3', {
        ...outlined(F.hazard.main, 1.2),
        transform: rotate(deg),
      }),
    ),
    circle(32, 32, 16, outlined(F.retrigger.main)),
    circle(32, 35, 13, { fill: shade(F.retrigger.main) }),
    circle(32, 32, 13, { fill: F.retrigger.main }),
    path('M26.5 27 a8 8 0 1 0 11 0', line(INK.white, 3)),
    path('M32 23 V31', line(INK.white, 3)),
  ],

  // 潤滑油タンク: 注ぎ口付きの油差しと、したたる油滴
  oiler: () => [
    path('M36 26 L54 12 L56 15 L42 30', outlined(INK.steel, THIN)),
    path('M14 26 H42 L46 52 H10 Z', outlined(F.retrigger.main)),
    path('M12 42 H44 L46 52 H10 Z', { fill: shade(F.retrigger.main) }),
    rect(20, 18, 16, 8, outlined(INK.steelDark, THIN), 2),
    path('M18 34 H32', line(F.retrigger.light, 3)),
    path('M55 19 q2.5 4 0 5.5 q-2.5 -1.5 0 -5.5 Z', outlined(M.oil, 1.2)),
    path('M52 29 q2 3 0 4.5 q-2 -1.5 0 -4.5 Z', outlined(M.oil, 1.2)),
  ],

  // 共鳴コイル: 銅線を巻いたコイルと、上下左右に広がる波紋
  coil: () => [
    ...[0, 90, 180, 270].map((deg) =>
      path('M24 9 q8 -4 16 0', { ...line(F.placement.light, 2.5), transform: rotate(deg) }),
    ),
    rect(22, 14, 20, 36, outlined(F.placement.main), 3),
    ...[20, 26, 32, 38].map((y) => rect(18, y, 28, 6, outlined(M.copper, THIN), 3)),
    path('M21 22 h6', line(M.copperLight, 1.5)),
    rect(22, 46, 20, 6, outlined(INK.steelDark, THIN), 2),
  ],

  // ソーラーパネル: 斜めに傾いたパネルと、上に小さな太陽
  solar: () => [
    circle(48, 13, 6, outlined(M.sun, THIN)),
    ...[0, 60, 120, 180, 240, 300].map((deg) =>
      path('M48 3 V5', { ...line(M.sun, 2), transform: rotate(deg, 48, 13) }),
    ),
    path('M28 44 V54 M22 54 H34', line(O, 3)),
    polygon('8,46 20,20 52,24 44,50', outlined(M.solarCell)),
    path('M14 33 L48 37 M11 40 L46 44 M28 22 L22 48 M40 23 L34 49', line(M.solarCellLight, 1.5)),
    path('M8 46 L20 20 L52 24 L44 50 Z', { ...line(F.placement.main, 3) }),
  ],

  // 検品台: 虫めがねと、チェックマークの入った検品札
  inspector: () => [
    path('M10 14 H36 L42 20 V52 H10 Z', outlined(M.paper)),
    path('M16 34 l6 6 l12 -14', line(F.placement.main, 4.5)),
    path('M16 20 h14', line(INK.steel, 2)),
    circle(44, 40, 9, outlined(M.glass)),
    path('M40 36 a5 5 0 0 1 5 -2', line(INK.white, 2)),
    path('M50.5 46.5 L56 52', line(O, 6)),
    path('M50.5 46.5 L56 52', line(F.placement.main, 3)),
  ],

  // 貯金箱: ねじの柄の豚の貯金箱と、落ちてくる硬貨
  piggyBank: () => [
    circle(40, 11, 6, outlined(M.coin, THIN)),
    path('M38 11 h4', line(M.cardboardDark, 1.5)),
    el('ellipse', { cx: 30, cy: 38, rx: 20, ry: 15, ...outlined(F.economy.main) }),
    path('M12 44 a20 12 0 0 0 36 0', { fill: shade(F.economy.main) }),
    el('ellipse', { cx: 30, cy: 38, rx: 20, ry: 15, ...line(O, 4) }),
    path('M22 25 h8', line(O, 3)),
    polygon('36,25 40,15 45,24', outlined(F.economy.main, THIN)),
    rect(48, 33, 8, 9, outlined(F.economy.light, THIN), 3),
    circle(42, 33, 2, { fill: O }),
    path('M18 52 v4 M40 52 v4', line(O, 5)),
    circle(24, 40, 4.5, outlined(INK.steelLight, 1.5)),
    path('M22 38 l4 4 M26 38 l-4 4', line(O, 1.5)),
  ],
};

export function partSvg(id: PartId): string {
  return svg(`パーツ: ${id}`, PARTS[id]());
}

export function partFiles(): Record<string, string> {
  return Object.fromEntries(
    (Object.keys(PARTS) as PartId[]).map((id) => [`src/assets/parts/${id}.svg`, partSvg(id)]),
  );
}
