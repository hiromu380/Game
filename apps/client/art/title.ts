/**
 * タイトル画面の背景の素材: 工場のシルエット（煙突つき）と、大きな歯車
 *
 * どちらも1色の影絵にして、動きは画面側（CSS）で付ける（煙・歯車の回転・窓の明かり）。
 * 煙を出す位置は画面側で合わせるので、煙突の位置を変えたら styles.css の .title-backdrop__smoke も直す。
 */
import { TITLE_COLORS as T } from '../src/assets/palette';
import { circle, path, rect, rotate, svg } from './svg';

/** 工場の建物1棟（260×150）: のこぎり屋根の工場・煙突2本・窓 */
export function factorySvg(): string {
  const body = [
    // 煙突（左 x=40・右 x=196 が煙の出口）
    rect(32, 8, 16, 70, { fill: T.factory }),
    rect(188, 26, 16, 60, { fill: T.factory }),
    rect(29, 4, 22, 8, { fill: T['factory-edge'] }, 2),
    rect(185, 22, 22, 8, { fill: T['factory-edge'] }, 2),
    // のこぎり屋根の工場
    path('M0 150 V70 L40 50 V70 L80 50 V70 L120 50 V70 L160 50 V150 Z', { fill: T.factory }),
    path('M40 50 V70 M80 50 V70 M120 50 V70', { stroke: T['factory-edge'], 'stroke-width': 2 }),
    // 箱型の棟
    rect(150, 80, 110, 70, { fill: T.factory }),
    rect(150, 78, 110, 4, { fill: T['factory-edge'] }),
    // 窓（明かりの点滅は画面側で重ねる。ここでは薄く灯しておく）
    ...[0, 1, 2, 3].map((i) =>
      rect(12 + i * 36, 95, 18, 12, { fill: T.window, opacity: 0.55 }, 1),
    ),
    ...[0, 1, 2].map((i) => rect(165 + i * 32, 100, 18, 14, { fill: T.window, opacity: 0.4 }, 1)),
  ];
  return svg('タイトル画面の背景: 工場のシルエット', body, '0 0 260 150');
}

/** 大きな歯車の影絵（背景でゆっくり回す） */
export function gearSvg(): string {
  const teeth = Array.from({ length: 12 }, (_, i) =>
    rect(44, 0, 12, 18, { fill: T.gear, transform: rotate(i * 30, 50, 50) }, 2),
  );
  return svg(
    'タイトル画面の背景: 大きな歯車',
    [...teeth, circle(50, 50, 38, { fill: T.gear }), circle(50, 50, 14, { fill: T['sky-top'] })],
    '0 0 100 100',
  );
}

export function titleFiles(): Record<string, string> {
  return {
    'src/assets/title/factory.svg': factorySvg(),
    'src/assets/title/gear.svg': gearSvg(),
  };
}
