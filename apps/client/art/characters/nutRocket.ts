/**
 * ナット（仮名）のロケット: ボルトの手作りロケット（ガラクタの寄せ集め・ノズル1つ）より、ひと目で性能が良さそうに見える機体
 *
 * - 細長い流線形の機体・銀色の先端・後ろへ流れる大きな翼
 * - 両脇に補助ブースター2本、ノズル3つ（ボルトは1つ）
 * - 丸窓2つ・機体のライン・アンテナの皿（遠くと交信する: ナットのアンテナの光と同じ水色のランプ）
 * - 色はナットの水色に、白と銀。継ぎはぎやテープは無い（きれいに作られた機体）
 *
 * 書き出し（pnpm art）: src/assets/rocket/nut-rocket.svg・nut-rocket-flame.svg（打ち上げの炎つき）
 */
import { INK, NUT_COLORS as N, ROCKET_COLORS as R } from '../../src/assets/palette';
import { circle, group, line, path, rect, shade, svg } from '../svg';

const O = N.outline;
const fill = (color: string, width = 3) => ({
  fill: color,
  stroke: O,
  'stroke-width': width,
  'stroke-linejoin': 'round',
  'stroke-linecap': 'round',
});

/** 絵の座標系（ボルトのロケットより縦長: 機体が細長い） */
export const NUT_ROCKET_VIEW_BOX = '0 0 120 200';

/** 補助ブースター（x は中心） */
const booster = (x: number) => [
  path(`M${x - 8} 150 V104 Q${x} 88 ${x + 8} 104 V150 Z`, fill(INK.white, 2.5)),
  path(`M${x - 8} 128 H${x + 8}`, line(N.body, 4)),
  path(`M${x - 7} 150 L${x - 9} 160 H${x + 9} L${x + 7} 150 Z`, fill(INK.steel, 2.5)),
];

/** ノズル（x は中心） */
const nozzle = (x: number, w = 9) =>
  path(
    `M${x - w / 2} 170 L${x - w / 2 - 3} 180 H${x + w / 2 + 3} L${x + w / 2} 170 Z`,
    fill(INK.steelDark, 2.5),
  );

/** 炎（ノズルの下）。3本のノズルからそれぞれ */
const flames = () =>
  [48, 60, 72].map((x) =>
    group(
      {},
      path(`M${x - 7} 180 Q${x} 228 ${x + 7} 180 Z`, fill(R.flame, 2)),
      path(`M${x - 3.5} 180 Q${x} 204 ${x + 3.5} 180 Z`, { fill: R.flameCore }),
    ),
  );

/** 機体の絵（座標は NUT_ROCKET_VIEW_BOX。写真などに埋め込むときに使う） */
export function nutRocketBody(): string[] {
  return [
    // 後ろへ流れる大きな翼（機体の後ろ）
    path('M42 112 L2 170 V184 L42 164 Z', fill(N.body)),
    path('M78 112 L118 170 V184 L78 164 Z', fill(N.body)),
    path('M5 174 L40 154', line(N.bodyLight, 2.5)),
    path('M115 174 L80 154', line(N.bodyLight, 2.5)),
    // 補助ブースター
    ...booster(30),
    ...booster(90),
    // 機体（細長い流線形）
    path('M42 170 V64 Q42 30 60 8 Q78 30 78 64 V170 Z', fill(INK.white)),
    path('M66 20 Q76 40 76 64 V170 H70 V64 Q70 42 62 24 Z', {
      fill: shade(INK.white),
      opacity: 0.6,
    }),
    // 銀色の先端
    path('M49 36 Q54 20 60 8 Q66 20 71 36 Z', fill(INK.steelLight, 2.5)),
    // 機体のライン（ナットの水色）
    path('M42 92 H78 M42 98 H78', line(N.body, 4)),
    path('M42 150 H78', line(N.body, 6)),
    // 丸窓2つ
    circle(60, 62, 9, fill(INK.steelLight, 2.5)),
    circle(60, 62, 6, { fill: R.window }),
    circle(60, 118, 6, fill(INK.steelLight, 2.5)),
    circle(60, 118, 3.5, { fill: R.window }),
    // アンテナの皿（遠くと交信する）
    path('M60 8 V0', line(O, 2)),
    path('M54 2 Q60 8 66 2', line(O, 2)),
    circle(60, -1, 2.5, fill(N.lamp, 1.5)),
    // 機体の下とノズル3つ
    rect(44, 164, 32, 7, fill(INK.steel, 2.5), 2),
    nozzle(48),
    nozzle(60, 11),
    nozzle(72),
  ];
}

export function nutRocketFiles(): Record<string, string> {
  // 上はアンテナ、下は炎の分だけ広げる（2つの絵で同じ範囲にして、差し替えても位置がずれないように）
  const box = '0 -6 120 236';
  return {
    'src/assets/rocket/nut-rocket.svg': svg('ナットのロケット', nutRocketBody(), box),
    'src/assets/rocket/nut-rocket-flame.svg': svg(
      'ナットのロケット（打ち上げ）',
      [...flames(), ...nutRocketBody()],
      box,
    ),
  };
}
