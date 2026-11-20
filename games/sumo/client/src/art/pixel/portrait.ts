/**
 * 顔の絵（ドット絵）: 力士・親方の胸像と全身を、見た目（Look）からコードで1ドットずつ組み立てる（純粋関数。Canvas を使わない）
 * 箱庭の人と同じ描き方（色面・右下に1段の陰・墨の輪郭）。正面を向いた、番付の顔写真のような構図
 */
import type { Look } from '../look';
import { PALETTE } from '../palette';
import { dark, rgb, Sheet, SUMI, type Pixels, type Rgb } from './sheet';

export type PortraitVariant = 'bust' | 'full';

/** 絵の大きさ（ドット） */
export const PORTRAIT = {
  bust: { width: 40, height: 40 },
  full: { width: 48, height: 62 },
} as const;

const CHEEK = rgb(PALETTE.cheek);
const WHITE = rgb(PALETTE.washi);
const PAPER = rgb(PALETTE.white);
const GRAY = rgb(PALETTE.hairLight);
const SILVER = rgb(PALETTE.stone);
const DROP = rgb(PALETTE.aiLight);
const BENI = rgb(PALETTE.beni);
const ODO = rgb(PALETTE.odo);

/** 頭の大きさ（半径） */
const HEAD = { rx: 11.5, ry: 10.5 } as const;

/** 左右対称に2点置く */
function pair(s: Sheet, cx: number, dx: number, y: number, col: Rgb): void {
  s.px(cx - dx, y, col);
  s.px(cx + dx, y, col);
}

/** 髪（頭の上半分。額は丸く残す）と髷 */
function hair(s: Sheet, cx: number, cy: number, look: Look): void {
  const col = look.hair === 'gray' ? SILVER : SUMI;
  const line = look.hair === 'gray' ? GRAY : rgb(PALETTE.sumi2);
  const inHead = (x: number, y: number) =>
    ((x - cx) / HEAD.rx) ** 2 + ((y - cy) / HEAD.ry) ** 2 <= 1;
  // 額の形: 髷を結う髪は生え際が丸く、ざんばら・短髪は低い
  const brow =
    look.hair === 'zanbara'
      ? { oy: 4.5, rx: 9.6, ry: 8.2 }
      : look.hair === 'short' || look.hair === 'gray'
        ? { oy: 3.6, rx: 9.8, ry: 9 }
        : { oy: 3, rx: 9.4, ry: 9.4 };
  const inFace = (x: number, y: number) =>
    ((x - cx) / brow.rx) ** 2 + ((y - cy - brow.oy) / brow.ry) ** 2 <= 1;
  for (let y = Math.floor(cy - HEAD.ry); y <= cy + 2; y++)
    for (let x = cx - 12; x <= cx + 12; x++) {
      if (!inHead(x, y) || inFace(x, y)) continue;
      s.px(x, y, col);
    }
  const top = Math.round(cy - HEAD.ry);
  if (look.hair === 'zanbara') {
    // ざんばら: 前髪がふぞろいに下り、てっぺんと襟足がはねる
    for (let x = cx - 8; x <= cx + 8; x++) {
      const drop = [2, 1, 3, 1, 2, 3, 1, 2, 1, 3, 2, 1, 3, 2, 1, 2, 3][x - cx + 8]!;
      for (let k = 0; k < drop; k++) {
        const y = Math.round(cy - 6.5 + Math.abs(x - cx) * 0.18) + k;
        if (inHead(x, y)) s.px(x, y, col);
      }
    }
    s.px(cx - 3, top - 1, col);
    s.px(cx + 2, top - 1, col);
    s.px(cx + 3, top - 2, col);
    s.px(cx + 6, top, col);
    for (const side of [-1, 1]) {
      s.rect(cx + side * 12 - (side < 0 ? 0 : 0), cy - 3, 1, 6, col);
      s.px(cx + side * 13, cy + 2, col);
    }
  } else if (look.hair === 'chonmage' || look.hair === 'oicho') {
    // 鬢（びん）: こめかみの髪を横へ張り出す
    for (const side of [-1, 1]) {
      s.ball(cx + side * 11, cy - 3, 2.4, 4.2, col, false);
      s.px(cx + side * 9, cy - 1, col);
    }
    if (look.hair === 'chonmage') {
      // ちょんまげ: 頭のてっぺんに、前へ折り返した短い髷
      s.rect(cx - 2, top - 3, 5, 3, col);
      s.rect(cx - 1, top - 4, 3, 1, col);
      s.rect(cx - 1, top - 1, 3, 1, line);
    } else {
      // 大銀杏: 髷の先をいちょうの葉の形に広げる
      [3, 5, 6, 6, 4, 2].forEach((half, k) => s.rect(cx - half, top - 7 + k, half * 2 + 1, 1, col));
      for (const dx of [-3, 0, 3]) {
        s.px(cx + dx, top - 6, line);
        s.px(cx + (dx === 0 ? 0 : dx > 0 ? 2 : -2), top - 4, line);
      }
      s.rect(cx - 1, top - 1, 3, 1, line);
    }
  } else {
    // 短髪（親方）: 横分けの線を1本
    for (let k = 0; k < 4; k++) s.px(cx - 4 + k, top + 1 + (k > 1 ? 1 : 0), line);
    for (const side of [-1, 1]) s.rect(cx + side * 11 - (side > 0 ? 0 : 0), cy - 4, 1, 4, col);
  }
}

/** 顔（正面）。cy は頭の中心 */
function face(s: Sheet, cx: number, cy: number, look: Look): void {
  const skin = rgb(look.skin);
  s.ball(cx, cy, HEAD.rx, HEAD.ry, skin);
  // 耳
  for (const side of [-1, 1]) {
    s.rect(cx + side * 12 - (side > 0 ? 0 : 0), cy + 1, 1, 3, skin);
    s.px(cx + side * 12, cy + 3, dark(skin));
  }
  hair(s, cx, cy, look);

  const eyeY = cy + 2;
  const ex = 5;
  // 眉
  const browY = eyeY - 3;
  for (const side of [-1, 1]) {
    const x = (k: number) => cx + side * (ex - 1 + k);
    if (look.brows === 'thick') {
      for (let k = -1; k <= 2; k++) {
        s.px(x(k), browY, SUMI);
        s.px(x(k), browY - 1, SUMI);
      }
    } else if (look.brows === 'arched') {
      s.px(x(-1), browY, SUMI);
      s.px(x(0), browY - 1, SUMI);
      s.px(x(1), browY - 1, SUMI);
      s.px(x(2), browY, SUMI);
    } else {
      // 怒り眉: 内へ下がる
      s.px(x(-1), browY, SUMI);
      s.px(x(0), browY, SUMI);
      s.px(x(0), browY - 1, SUMI);
      s.px(x(1), browY - 1, SUMI);
      s.px(x(2), browY - 2, SUMI);
    }
  }
  // 目
  for (const side of [-1, 1]) {
    const x = (k: number) => cx + side * (ex + k);
    if (look.eyes === 'dot') {
      s.px(x(0), eyeY - 1, SUMI);
      s.px(x(1), eyeY - 1, SUMI);
      s.px(x(0), eyeY, SUMI);
      s.px(x(1), eyeY, SUMI);
      s.px(x(0), eyeY + 1, SUMI);
      s.px(x(1), eyeY + 1, SUMI);
      s.px(x(side > 0 ? 0 : 1), eyeY - 1, PAPER);
    } else if (look.eyes === 'line') {
      // 小さな丸い目
      s.px(x(0), eyeY, SUMI);
      s.px(x(1), eyeY, SUMI);
      s.px(x(0), eyeY + 1, SUMI);
      s.px(x(1), eyeY + 1, SUMI);
    } else if (look.eyes === 'smile') {
      // 笑った目
      s.px(x(-1), eyeY + 1, SUMI);
      s.px(x(0), eyeY, SUMI);
      s.px(x(1), eyeY, SUMI);
      s.px(x(2), eyeY + 1, SUMI);
    } else {
      // 切れ長: 目尻が上がる
      for (let k = -1; k <= 2; k++) s.px(x(k), eyeY, SUMI);
      s.px(x(0), eyeY + 1, SUMI);
      s.px(x(1), eyeY + 1, SUMI);
      s.px(x(2), eyeY - 1, SUMI);
    }
  }
  // ほお・鼻・口
  for (const side of [-1, 1]) {
    for (const k of [0, 1, 2]) {
      s.px(cx + side * (7 + k), cy + 5, CHEEK);
      if (k < 2) s.px(cx + side * (7 + k), cy + 6, CHEEK);
    }
  }
  s.px(cx, cy + 4, dark(skin));
  s.px(cx, cy + 5, dark(skin));
  const my = cy + 8;
  if (look.mouth === 'flat') {
    for (let k = -1; k <= 1; k++) s.px(cx + k, my, SUMI);
  } else if (look.mouth === 'smile') {
    pair(s, cx, 2, my - 1, SUMI);
    for (let k = -1; k <= 1; k++) s.px(cx + k, my, SUMI);
  } else if (look.mouth === 'he') {
    pair(s, cx, 2, my, SUMI);
    for (let k = -1; k <= 1; k++) s.px(cx + k, my - 1, SUMI);
  } else {
    for (let k = -1; k <= 1; k++) {
      s.px(cx + k, my - 1, SUMI);
      s.px(cx + k, my + 1, SUMI);
    }
    pair(s, cx, 1, my, SUMI);
    s.px(cx, my, dark(BENI));
  }
  if (look.bandage) {
    // ばんそうこう（ほお）
    s.rect(cx + 5, cy + 5, 5, 3, WHITE);
    s.rect(cx + 7, cy + 5, 1, 3, dark(WHITE, 0.85));
  }
  if (look.sweat) {
    s.px(cx - 10, cy - 2, DROP);
    s.rect(cx - 11, cy - 1, 2, 2, DROP);
  }
}

/** 体の横幅の半分（ドット）: 見た目の width（26〜46）から */
function halfWidth(look: Look, base: number, spread: number): number {
  return base + ((look.width - 26) / 20) * spread;
}

/** 着物の合わせ襟（白い半襟と、のどの肌） */
function collar(s: Sheet, cx: number, top: number, depth: number, skin: Rgb): void {
  for (let k = 0; k <= depth; k++) {
    const half = Math.round(((depth - k) / depth) * 5);
    for (let x = cx - half; x <= cx + half; x++) s.over(x, top + k, 1, 1, skin);
    s.over(cx - half - 1, top + k, 1, 1, WHITE);
    s.over(cx + half + 1, top + k, 1, 1, WHITE);
  }
}

/** 布の色。墨の布は輪郭と溶けないよう、少し明るい墨にする */
function clothOf(look: Look): Rgb {
  return look.cloth === PALETTE.sumi ? rgb(PALETTE.sumi2) : rgb(look.cloth);
}

function bust(look: Look): Sheet {
  const { width: W, height: H } = PORTRAIT.bust;
  const s = new Sheet(W, H);
  // 髷の上に輪郭の分の余白を取る
  s.oy = 1;
  const cx = W / 2;
  const cy = 18;
  // 下の端（ずらした分だけ上）
  const B = H - s.oy;
  const skin = rgb(look.skin);
  const cloth = clothOf(look);
  const rx = halfWidth(look, 14, 4.5);
  if (look.kimono) {
    s.ball(cx, B + 1, rx, 13, cloth);
    collar(s, cx, B - 11, 9, skin);
    // 紋
    s.rect(cx - 10, B - 5, 2, 2, WHITE);
    s.rect(cx + 9, B - 5, 2, 2, WHITE);
  } else {
    s.ball(cx, B + 1, rx, 13, skin);
    // 胸の線
    for (const side of [-1, 1])
      for (let k = 2; k <= 7; k++)
        s.over(cx + side * k, B - 3 + (k > 5 ? -1 : 0), 1, 1, dark(skin));
    if (look.tsuna) {
      // 横綱の綱（白）と紙垂
      s.over(0, B - 3, W, 3, WHITE);
      s.over(0, B - 1, W, 1, dark(WHITE, 0.82));
      for (const dx of [-8, 0, 8]) s.over(cx + dx - 1, B - 3, 3, 3, PAPER);
    }
  }
  // あごの下の陰
  s.over(cx - 7, cy + Math.round(HEAD.ry), 15, 2, dark(look.kimono ? cloth : skin, 0.86));
  face(s, cx, cy, look);
  return s;
}

function full(look: Look): Sheet {
  const { width: W, height: H } = PORTRAIT.full;
  const s = new Sheet(W, H);
  s.oy = 2;
  const cx = W / 2;
  const cy = 17;
  const skin = rgb(look.skin);
  const cloth = clothOf(look);
  const ground = H - 2 - s.oy;
  if (look.kimono) {
    // 着物: なで肩から裾へ少し広がる。袖・帯・白足袋・草履
    for (const side of [-1, 1]) {
      // 袖と手
      s.limb(cx + side * 11, 30, cx + side * 14, 40, 3, side > 0 ? dark(cloth) : cloth);
      s.rect(cx + side * 14 - 1, 43, 3, 2, skin);
    }
    for (let y = 27; y <= ground - 3; y++) {
      const h = Math.round(y < 31 ? 8 + (y - 27) * 1.1 : 12 + (y - 31) * 0.1);
      s.rect(cx - h, y, h * 2 + 1, 1, cloth);
      s.rect(cx + h - 2, y, 3, 1, dark(cloth));
    }
    collar(s, cx, 28, 8, skin);
    s.rect(cx - 12, 41, 25, 3, ODO);
    s.rect(cx - 12, 43, 25, 1, dark(ODO));
    s.rect(cx, 45, 1, ground - 48, dark(cloth));
    for (const side of [-1, 1]) {
      s.rect(cx + side * 5 - 2, ground - 2, 5, 2, WHITE);
      s.rect(cx + side * 5 - 3, ground, 7, 1, rgb(PALETTE.wood));
    }
  } else {
    const rx = halfWidth(look, 11, 4);
    // 脚と足（少し開いて立つ）
    for (const side of [-1, 1]) {
      const x = cx + side * (rx * 0.55);
      s.limb(x, 45, x + side, ground - 3, 3.4, skin);
      s.rect(Math.round(x + side) - 3, ground - 1, 7, 2, skin);
      s.rect(Math.round(x + side) - 3, ground, 7, 1, dark(skin));
    }
    // 腕は体の横に下ろす。体との境に細い陰を入れる
    for (const side of [-1, 1]) {
      s.limb(cx + side * (rx + 1), 31, cx + side * (rx + 3), 42, 2.7, skin);
      s.ball(cx + side * (rx + 3), 43, 2.4, 2.2, skin, false);
    }
    // 胸と腹（肩はなだらかに、腹は丸く）
    s.ball(cx, 39, rx + 1.2, 10, dark(skin, 0.74), false);
    s.ball(cx, 32, rx - 0.5, 5.5, skin, false);
    s.ball(cx, 39, rx, 9.6, skin);
    for (const side of [-1, 1]) {
      for (let k = 2; k <= 6; k++) s.px(cx + side * k, 34 + (k === 6 ? -1 : 0), dark(skin));
    }
    s.px(cx, 40, dark(skin));
    // まわし: 帯と前袋
    const by = 43;
    for (let x = cx - 20; x <= cx + 20; x++) {
      // 腹の形の中だけ（腕は塗らない）
      if (((x - cx) / (rx + 1.2)) ** 2 > 1) continue;
      s.over(x, by, 1, 4, cloth);
      s.over(x, by + 3, 1, 1, dark(cloth));
    }
    s.rect(cx - 3, by + 4, 7, 5, cloth);
    s.rect(cx + 2, by + 4, 2, 5, dark(cloth));
    if (look.sagari) {
      // 下がり: 帯から下がる房
      for (const dx of [-9, -6, -3, 0, 3, 6, 9]) s.rect(cx + dx, by + 4, 1, 7, dark(cloth, 0.86));
    }
    if (look.tsuna) {
      // 横綱の綱と紙垂
      for (let x = cx - 20; x <= cx + 20; x++) {
        if (((x - cx) / (rx + 1.2)) ** 2 > 1) continue;
        s.over(x, by - 4, 1, 4, WHITE);
        s.over(x, by - 1, 1, 1, dark(WHITE, 0.82));
      }
      for (const dx of [-8, -4, 0, 4, 8]) {
        s.rect(cx + dx - 1, by, 3, 5, PAPER);
        s.px(cx + dx + 1, by + 2, dark(WHITE, 0.82));
      }
    }
  }
  s.over(cx - 7, cy + Math.round(HEAD.ry), 15, 2, dark(look.kimono ? cloth : skin, 0.86));
  face(s, cx, cy, look);
  return s;
}

const cache = new Map<string, Pixels>();

/** 同じ見た目と構図からは、いつも同じ鍵 */
export function portraitKey(look: Look, variant: PortraitVariant): string {
  return `${variant}:${JSON.stringify(look)}`;
}

/** 顔の絵（同じ見た目は使い回す） */
export function portraitPixels(look: Look, variant: PortraitVariant = 'bust'): Pixels {
  const key = portraitKey(look, variant);
  const hit = cache.get(key);
  if (hit) return hit;
  const out = (variant === 'bust' ? bust(look) : full(look)).out(false);
  cache.set(key, out);
  return out;
}
