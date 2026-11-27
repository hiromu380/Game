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
  full: { width: 48, height: 68 },
} as const;

const CHEEK = rgb(PALETTE.cheek);
const WHITE = rgb(PALETTE.washi);
const PAPER = rgb(PALETTE.white);
const GRAY = rgb(PALETTE.hairLight);
const SILVER = rgb(PALETTE.stone);
const DROP = rgb(PALETTE.aiLight);
const BENI = rgb(PALETTE.beni);
const ODO = rgb(PALETTE.odo);

/** 頭の大きさ（半径）。輪郭で変える: 丸・面長・えら張り */
const HEADS = {
  round: { rx: 11.5, ry: 10.5 },
  long: { rx: 10, ry: 10.5 },
  wide: { rx: 12.5, ry: 9.8 },
} as const;
const headOf = (look: Look) => HEADS[look.face ?? 'round'];

/** 左右対称に2点置く */
function pair(s: Sheet, cx: number, dx: number, y: number, col: Rgb): void {
  s.px(cx - dx, y, col);
  s.px(cx + dx, y, col);
}

/** 髪（頭の上半分。額は丸く残す）と髷 */
function hair(s: Sheet, cx: number, cy: number, look: Look): void {
  const HEAD = headOf(look);
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
/** 表情で目・眉・口・汗を差し替える（喜び: 笑った目・上がった眉・笑った口・赤いほお。こらえる: 怒り眉・への字・汗） */
function moodFace(look: Look): Look {
  if (look.mood === 'joy')
    return {
      ...look,
      eyes: 'smile',
      brows: 'arched',
      mouth: 'smile',
      sweat: false,
      mark: look.mark === 'none' || !look.mark ? 'rosy' : look.mark,
    };
  if (look.mood === 'grit') return { ...look, brows: 'angry', mouth: 'he', sweat: true };
  return look;
}

function face(s: Sheet, cx: number, cy: number, base: Look): void {
  const look = moodFace(base);
  const HEAD = headOf(look);
  const skin = rgb(look.skin);
  s.ball(cx, cy, HEAD.rx, HEAD.ry, skin);
  // 耳（輪郭の横に付ける）
  const ear = Math.round(HEAD.rx + 0.5);
  for (const side of [-1, 1]) {
    s.rect(cx + side * ear, cy + 1, 1, 3, skin);
    s.px(cx + side * ear, cy + 3, dark(skin));
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
  // 重い力士は二重あご（体つきの違いを顔でも見せる）
  if (look.width >= 38 && !look.kimono) {
    const chin = Math.round(cy + HEAD.ry) - 1;
    for (let x = cx - 4; x <= cx + 4; x++) s.px(x, chin, dark(skin, 0.82));
  }
  // 顔の印（小さな絵でも見分けがつくように）
  if (look.mark === 'stubble') {
    // 青ひげ: 口のまわりに薄い点を散らす
    const shade = dark(skin, 0.78);
    for (let y = my - 1; y <= my + 2; y++)
      for (let x = cx - 4; x <= cx + 4; x++)
        if ((x + y) % 2 === 0 && Math.abs(x - cx) + Math.abs(y - my) > 1) s.px(x, y, shade);
  } else if (look.mark === 'mole') {
    s.px(cx + 4, cy + 6, SUMI);
  } else if (look.mark === 'rosy') {
    // 赤いほお（ふだんのほおより大きく濃く）
    for (const side of [-1, 1])
      for (let k = 0; k < 3; k++) {
        s.px(cx + side * (6 + k), cy + 5, BENI);
        s.px(cx + side * (6 + k), cy + 6, CHEEK);
      }
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
  s.over(cx - 7, cy + Math.round(headOf(look).ry), 15, 2, dark(look.kimono ? cloth : skin, 0.86));
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
    rikishiBody(s, cx, ground, look, skin, cloth);
  }
  s.over(cx - 7, cy + Math.round(headOf(look).ry), 15, 2, dark(look.kimono ? cloth : skin, 0.86));
  face(s, cx, cy, look);
  return s;
}

/**
 * 力士の全身（正面・立ち姿）: なで肩より広い肩、体の横に下ろした腕（内側に1段濃い縁で胴と分ける）、
 * せり出した丸い腹、腹の下へ沈むまわしと前の縦みつ、太い腿。重い力士ほど横に広い
 */
function rikishiBody(
  s: Sheet,
  cx: number,
  ground: number,
  look: Look,
  skin: Rgb,
  cloth: Rgb,
): void {
  const heavy = (look.width - 26) / 20; // 0（軽い）〜1（重い）
  const rx = halfWidth(look, 10.5, 4);
  const sw = rx + 2;
  const rim = dark(skin, 0.72);
  // 脚: 太い腿から膝、すね、外へ開いた足
  for (const side of [-1, 1]) {
    const hip = cx + side * rx * 0.5;
    const knee = cx + side * (rx * 0.55 + 1.5);
    s.limb(hip, 50, knee, 57, 3.8 + heavy * 0.8, rim);
    s.limb(hip, 50, knee, 57, 3 + heavy * 0.8, skin);
    // ひざの陰
    s.px(knee - side, 57, rim);
    s.limb(knee, 57, knee + side * 0.5, ground - 2, 2.6 + heavy * 0.4, skin);
    s.rect(Math.round(knee + side * 0.5) - (side < 0 ? 5 : 2), ground - 1, 8, 2, skin);
    s.rect(Math.round(knee + side * 0.5) - (side < 0 ? 5 : 2), ground, 8, 1, dark(skin));
  }
  // 胸と肩（頭より広く、なだらか）・腹（丸くせり出す。右下に陰）
  s.ball(cx, 33, sw, 7.5, skin, false);
  s.ball(cx, 41, rx + 1.5, 9.2, skin);
  // 胸の線と、腹の下のしわ・へそ
  for (const side of [-1, 1])
    for (let k = 2; k <= 6; k++) s.px(cx + side * k, 34 + (k >= 5 ? -1 : 0), rim);
  s.px(cx, 42, rim);
  s.px(cx, 43, rim);
  // まわし: 腰の帯は脇で高く、腹の下へ沈む（腹がのる）。前は縦みつが股へ下りる
  const half = rx + 2.5;
  for (let x = Math.floor(cx - half); x <= Math.ceil(cx + half); x++) {
    const t = (x - cx) / half;
    if (t * t > 1) continue;
    const top = Math.round(45 + 3 * (1 - t * t));
    s.rect(x, top, 1, 4, cloth);
    s.px(x, top + 3, dark(cloth));
  }
  for (let y = 52; y <= 56; y++) {
    const w = y < 55 ? 2 : 1;
    s.rect(cx - w, y, w * 2 + 1, 1, cloth);
    s.px(cx + w, y, dark(cloth));
  }
  // 腕: 肩から下ろし、ひじで少し外へ。手は腿の横
  for (const side of [-1, 1]) {
    const sx = cx + side * (sw - 2);
    const ex = cx + side * (sw + 1.2);
    const hx = cx + side * (sw + 0.3);
    const r = 2.4 + heavy * 0.6;
    s.limb(sx, 32, ex, 38, r + 0.6, rim);
    s.limb(ex, 38, hx, 45, r + 0.5, rim);
    // 肩の丸み
    s.ball(sx, 32, r + 0.6, r + 0.2, skin, false);
    s.limb(sx, 32, ex, 38, r, skin);
    s.limb(ex, 38, hx, 45, r - 0.3, skin);
    s.ball(hx, 46.5, 2.2, 2, skin, false);
    s.px(hx + side, 47, rim);
  }
  if (look.sagari) {
    // 下がり: 帯の前から下がる房（縦みつの左右）
    for (const dx of [-8, -6, -4, 4, 6, 8])
      s.rect(cx + dx, 49 - Math.round(Math.abs(dx) / 4), 1, 7, dark(cloth, 0.86));
  }
  if (look.tsuna) {
    // 横綱の綱（腰の帯の上に太く）と紙垂
    for (let x = Math.floor(cx - half); x <= Math.ceil(cx + half); x++) {
      const t = (x - cx) / half;
      if (t * t > 1) continue;
      const top = Math.round(42 + 3 * (1 - t * t));
      s.rect(x, top, 1, 3, WHITE);
      s.px(x, top + 2, dark(WHITE, 0.82));
    }
    for (const dx of [-7, -2, 3, 8]) {
      s.rect(cx + dx - 1, 47, 3, 4, PAPER);
      s.px(cx + dx, 49, dark(WHITE, 0.82));
    }
  }
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
