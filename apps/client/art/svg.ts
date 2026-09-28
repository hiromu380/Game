/**
 * SVG を組み立てる小さな部品（素材の生成スクリプト用）
 *
 * 素材はすべてここの部品と palette.ts の色で描く（線の太さ・影の付け方をそろえるため: docs/art-style.md）。
 * - 線: 64px 基準で 4px の濃色アウトライン（STROKE）。小さな UI アイコンは 24px 基準で 2px
 * - 影: 地の色を 15% 暗くした1段の影（shade）。グラデーションは使わない
 */
import { darken, INK } from '../src/assets/palette';

/** 64px 基準の輪郭線の太さ */
export const STROKE = 4;
/** 細部の線の太さ */
export const THIN = 2.5;

type Attrs = Record<string, string | number | undefined>;

/** 属性を文字列にする（undefined は出さない） */
function attrs(a: Attrs): string {
  return Object.entries(a)
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => ` ${k}="${v}"`)
    .join('');
}

/** 要素1つ（中身があれば開始・終了タグ、なければ自己終了タグ） */
export function el(tag: string, a: Attrs = {}, ...children: string[]): string {
  return children.length
    ? `<${tag}${attrs(a)}>${children.join('')}</${tag}>`
    : `<${tag}${attrs(a)}/>`;
}

/** 輪郭線つきの塗り（素材の基本の見た目） */
export const outlined = (fill: string, width = STROKE): Attrs => ({
  fill,
  stroke: INK.outline,
  'stroke-width': width,
  'stroke-linejoin': 'round',
  'stroke-linecap': 'round',
});

/** 線だけ（塗りなし） */
export const line = (color: string = INK.outline, width = THIN): Attrs => ({
  fill: 'none',
  stroke: color,
  'stroke-width': width,
  'stroke-linejoin': 'round',
  'stroke-linecap': 'round',
});

/** 1段の影の色（地の色を 15% 暗く） */
export const shade = (color: string) => darken(color, 0.15);

export const rect = (x: number, y: number, w: number, h: number, a: Attrs, r = 0) =>
  el('rect', { x, y, width: w, height: h, rx: r || undefined, ...a });
export const circle = (cx: number, cy: number, r: number, a: Attrs) =>
  el('circle', { cx, cy, r, ...a });
export const path = (d: string, a: Attrs) => el('path', { d, ...a });
export const polygon = (points: string, a: Attrs) => el('polygon', { points, ...a });
export const group = (a: Attrs, ...children: string[]) => el('g', a, ...children);

/** 回転（中心 cx,cy のまわりに deg 度） */
export const rotate = (deg: number, cx = 32, cy = 32) => `rotate(${deg} ${cx} ${cy})`;

/**
 * SVG ファイル全体。comment は何の絵かを書く（差し替え時の手がかり）
 * viewBox は既定で 64×64
 */
export function svg(comment: string, body: string[], viewBox = '0 0 64 64'): string {
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}">`,
    `  <!-- ${comment}（art/ のスクリプトで生成。手で編集しない） -->`,
    ...body.map((b) => `  ${b}`),
    '</svg>',
    '',
  ].join('\n');
}
