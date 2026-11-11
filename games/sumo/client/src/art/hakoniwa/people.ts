/**
 * 箱庭の人のドット絵（力士・親方・布団のけが人）を、コードで1ドットずつ組み立てる（純粋関数。Canvas を使わない）
 * 生成AIの絵（docs/sprites の rikishi_*）が届くまでの自前の絵。届いたら Hakoniwa の描き分けで差し替える
 * 足元は絵の下の中央（FOOT）。左下を向く。flip で左右を返す
 */
import { PALETTE } from '../palette';

export type Pose =
  | 'idle'
  | 'shiko'
  | 'teppo'
  | 'suriashi'
  | 'push'
  | 'sit'
  | 'lie'
  | 'oyakata'
  | 'oyakataSit'
  | 'sweep';

export interface PersonLook {
  pose: Pose;
  /** コマ（0・1 を交互に） */
  frame: 0 | 1;
  /** 肌の色（PALETTE.skin の番号） */
  skin: 0 | 1 | 2;
  /** 稽古まわし: 関取は白、幕下以下は黒 */
  mawashi: 'white' | 'black';
  /** 髷: 新弟子はざんばら、ほかはちょんまげ */
  hair: 'zanbara' | 'mage';
  /** 体の大きさ（0 = 細い 〜 2 = 大きい） */
  build: 0 | 1 | 2;
  flip?: boolean;
}

export const PERSON = { width: 30, height: 36 } as const;
/** 足元（絵の中の点） */
export const FOOT = { x: 15, y: 34 } as const;

export interface Pixels {
  width: number;
  height: number;
  /** RGBA（幅 × 高さ × 4） */
  data: Uint8ClampedArray;
}

type Rgb = readonly [number, number, number];

function rgb(hex: string): Rgb {
  const n = parseInt(hex.slice(1), 16);
  return [n >> 16, (n >> 8) & 255, n & 255];
}
function dark(c: Rgb, k = 0.78): Rgb {
  return [Math.round(c[0] * k), Math.round(c[1] * k), Math.round(c[2] * k)];
}

const SUMI = rgb(PALETTE.sumi);
const CHEEK = rgb(PALETTE.cheek);
const WHITE = rgb(PALETTE.washi);
const AI = rgb(PALETTE.ai);
const BENI = rgb(PALETTE.beni);
const WOOD = rgb(PALETTE.wood);
const GRAY = rgb(PALETTE.hairLight);

/** 小さなドットの画布。色を置き、最後に墨の輪郭を回す */
class Sheet {
  readonly w = PERSON.width;
  readonly h = PERSON.height;
  private readonly c: (Rgb | null)[];
  constructor() {
    this.c = new Array<Rgb | null>(this.w * this.h).fill(null);
  }
  px(x: number, y: number, col: Rgb): void {
    x = Math.round(x);
    y = Math.round(y);
    if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.c[y * this.w + x] = col;
  }
  rect(x: number, y: number, w: number, h: number, col: Rgb): void {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.px(x + i, y + j, col);
  }
  /** だ円。右下に1段の陰（版画の明暗） */
  ball(cx: number, cy: number, rx: number, ry: number, col: Rgb, shade = true): void {
    const inside = (x: number, y: number, ox: number, oy: number) =>
      ((x - cx - ox) / rx) ** 2 + ((y - cy - oy) / ry) ** 2 <= 1;
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++)
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        if (!inside(x, y, 0, 0)) continue;
        this.px(x, y, shade && !inside(x, y, -1.2, -1.2) ? dark(col) : col);
      }
  }
  /** 太さのある線（腕・脚） */
  limb(x0: number, y0: number, x1: number, y1: number, r: number, col: Rgb): void {
    const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0)));
    for (let i = 0; i <= n; i++)
      this.ball(x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * i) / n, r, r, col, false);
  }
  /** すでに色のある所だけ塗る（まわしを体の形に沿わせる） */
  over(x: number, y: number, w: number, h: number, col: Rgb): void {
    for (let j = 0; j < h; j++)
      for (let i = 0; i < w; i++) {
        const xx = Math.round(x + i);
        const yy = Math.round(y + j);
        if (xx >= 0 && yy >= 0 && xx < this.w && yy < this.h && this.c[yy * this.w + xx])
          this.c[yy * this.w + xx] = col;
      }
  }
  out(flip: boolean): Pixels {
    const data = new Uint8ClampedArray(this.w * this.h * 4);
    const at = (x: number, y: number) =>
      x >= 0 && y >= 0 && x < this.w && y < this.h ? this.c[y * this.w + x] : null;
    for (let y = 0; y < this.h; y++)
      for (let x = 0; x < this.w; x++) {
        let col = at(x, y) ?? null;
        // 色のない所で、隣（上下左右）に色があれば輪郭
        if (!col && (at(x - 1, y) || at(x + 1, y) || at(x, y - 1) || at(x, y + 1))) col = SUMI;
        if (!col) continue;
        const o = (y * this.w + (flip ? this.w - 1 - x : x)) * 4;
        data[o] = col[0];
        data[o + 1] = col[1];
        data[o + 2] = col[2];
        data[o + 3] = 255;
      }
    return { width: this.w, height: this.h, data };
  }
}

interface Body {
  /** 体の中心（腹）と大きさ */
  cx: number;
  cy: number;
  rx: number;
  ry: number;
}

/** 頭（顔は左下を向く: 目とほおを少し左へ） */
function head(
  s: Sheet,
  cx: number,
  cy: number,
  skin: Rgb,
  hair: PersonLook['hair'],
  gray = false,
): void {
  const hairCol = gray ? GRAY : SUMI;
  s.ball(cx, cy, 5.6, 5.2, skin);
  // 髪: 頭の上半分。額は丸く残す
  for (let y = Math.floor(cy - 6); y <= cy - 1; y++)
    for (let x = cx - 6; x <= cx + 6; x++) {
      const inHead = ((x - cx) / 5.6) ** 2 + ((y - cy) / 5.2) ** 2 <= 1;
      const brow = ((x - cx + 1) / 4.2) ** 2 + ((y - cy - 0.5) / 3.2) ** 2 <= 1;
      if (inHead && !brow) s.px(x, y, hairCol);
    }
  if (hair === 'mage') {
    // ちょんまげ: 頭のてっぺんに小さなまげ
    s.rect(cx - 1, cy - 8, 3, 2, hairCol);
    s.px(cx + 2, cy - 7, hairCol);
  } else if (!gray) {
    // ざんばら: 襟足が少しはねる
    s.px(cx + 6, cy, hairCol);
    s.px(cx - 6, cy, hairCol);
    s.px(cx + 6, cy + 1, hairCol);
  }
  s.px(cx - 3, cy + 1, SUMI);
  s.px(cx + 1, cy + 1, SUMI);
  s.px(cx - 4, cy + 3, CHEEK);
  s.px(cx + 2, cy + 3, CHEEK);
}

/** まわし（腹の下の帯と前袋）。体の形に沿わせる */
function mawashi(s: Sheet, b: Body, col: Rgb): void {
  const y = Math.round(b.cy + b.ry * 0.25);
  s.over(b.cx - b.rx - 1, y, b.rx * 2 + 3, 3, col);
  s.over(b.cx - b.rx - 1, y + 2, b.rx * 2 + 3, 1, dark(col));
  s.over(b.cx - 2, y + 3, 4, 4, col);
}

function rikishi(s: Sheet, look: PersonLook): void {
  const skin = rgb(PALETTE.skin[look.skin]);
  const belt = look.mawashi === 'white' ? WHITE : SUMI;
  const f = look.frame;
  const big = look.build;
  const cx = FOOT.x;
  const ground = FOOT.y;
  const body = (dx: number, dy: number): Body => ({
    cx: cx + dx,
    cy: ground - 13 + dy,
    rx: 7 + big * 0.8,
    ry: 6.5 + big * 0.5,
  });
  const leg = (x0: number, y0: number, x1: number, y1: number) => {
    s.limb(x0, y0, x1, y1, 2.1, skin);
    s.rect(Math.round(x1) - 2, Math.round(y1) + 1, 5, 1, dark(skin));
  };
  const arm = (x0: number, y0: number, x1: number, y1: number) => s.limb(x0, y0, x1, y1, 1.8, skin);

  switch (look.pose) {
    case 'idle':
    case 'sweep': {
      const b = body(0, f);
      leg(cx - 4, ground - 7, cx - 4, ground - 1);
      leg(cx + 4, ground - 7, cx + 4, ground - 1);
      s.ball(b.cx, b.cy, b.rx, b.ry, skin);
      mawashi(s, b, belt);
      if (look.pose === 'sweep') {
        // ほうき: 両手で持って掃く
        arm(b.cx - b.rx, b.cy - 2, b.cx - b.rx - 2, b.cy + 3);
        arm(b.cx + b.rx, b.cy - 2, b.cx - 2, b.cy + 2);
        const bx = b.cx - b.rx - 3 - f * 2;
        s.limb(bx + 4, b.cy - 6, bx, ground - 3, 0.6, WOOD);
        s.rect(bx - 2, ground - 3, 5, 3, rgb(PALETTE.odo));
      } else {
        arm(b.cx - b.rx - 1, b.cy - 3, b.cx - b.rx - 1, b.cy + 3);
        arm(b.cx + b.rx + 1, b.cy - 3, b.cx + b.rx + 1, b.cy + 3);
      }
      head(s, b.cx - 1, b.cy - b.ry - 4, skin, look.hair);
      break;
    }
    case 'shiko': {
      if (f === 0) {
        // 腰を割る: 足を開いて腰を落とし、手をひざに
        const b = body(0, 3);
        leg(cx - 6, ground - 5, cx - 9, ground - 1);
        leg(cx + 6, ground - 5, cx + 9, ground - 1);
        s.ball(b.cx, b.cy, b.rx, b.ry, skin);
        mawashi(s, b, belt);
        arm(b.cx - b.rx, b.cy - 3, b.cx - 8, b.cy + 4);
        arm(b.cx + b.rx, b.cy - 3, b.cx + 8, b.cy + 4);
        head(s, b.cx - 1, b.cy - b.ry - 4, skin, look.hair);
      } else {
        // 足を高く上げる: 体を傾けて、片足を横へ
        const b = body(-2, 0);
        leg(cx - 4, ground - 7, cx - 5, ground - 1);
        s.ball(b.cx, b.cy, b.rx, b.ry, skin);
        mawashi(s, b, belt);
        s.limb(b.cx + 4, b.cy + 4, cx + 11, ground - 13, 2.1, skin);
        s.rect(cx + 11, ground - 16, 2, 4, dark(skin));
        arm(b.cx - b.rx, b.cy - 3, b.cx - b.rx - 1, b.cy + 3);
        arm(b.cx + b.rx - 1, b.cy - 3, b.cx + 6, b.cy + 2);
        head(s, b.cx - 3, b.cy - b.ry - 4, skin, look.hair);
      }
      break;
    }
    case 'teppo':
    case 'push': {
      // 前（左）へ体を預けて突く。コマごとに突く手を替える
      const lean = look.pose === 'push' ? -3 : -2;
      const b = body(lean + (look.pose === 'push' ? f : 0), 1);
      leg(cx + 1, ground - 6, cx + 6, ground - 1);
      leg(cx - 3, ground - 6, cx - 5, ground - 1);
      s.ball(b.cx, b.cy, b.rx, b.ry, skin);
      mawashi(s, b, belt);
      const reach = b.cx - b.rx - 5;
      arm(b.cx - b.rx + 1, b.cy - 4, reach + (f ? 3 : 0), b.cy - 5 + (f ? 2 : 0));
      arm(b.cx - b.rx + 1, b.cy - 1, reach + (f ? 0 : 3), b.cy - 2 + (f ? 0 : 2));
      head(s, b.cx - 3, b.cy - b.ry - 3, skin, look.hair);
      break;
    }
    case 'suriashi': {
      // 腰を落として、足を地面から離さずに進む
      const b = body(-1, 3);
      leg(cx - 5 - f * 2, ground - 5, cx - 8 - f * 2, ground - 1);
      leg(cx + 4 + f * 2, ground - 5, cx + 6 + f * 2, ground - 1);
      s.ball(b.cx, b.cy, b.rx, b.ry, skin);
      mawashi(s, b, belt);
      arm(b.cx - b.rx + 1, b.cy - 3, b.cx - b.rx - 4, b.cy - 1);
      arm(b.cx + b.rx - 2, b.cy - 3, b.cx + b.rx - 5, b.cy + 2);
      head(s, b.cx - 2, b.cy - b.ry - 4, skin, look.hair);
      break;
    }
    case 'sit': {
      // あぐらで見取り稽古（休養）
      const b = body(0, 6);
      s.ball(cx, ground - 2, b.rx + 3, 2.6, skin);
      s.ball(b.cx, b.cy, b.rx, b.ry - 1, skin);
      mawashi(s, { ...b, ry: b.ry - 1 }, belt);
      arm(b.cx - b.rx, b.cy - 2, b.cx - 4, b.cy + 4);
      arm(b.cx + b.rx, b.cy - 2, b.cx + 4, b.cy + 4);
      head(s, b.cx - 1, b.cy - b.ry - 3 + f, skin, look.hair);
      break;
    }
    default:
      break;
  }
}

/** けが人: 布団に寝て、頭に白い包帯 */
function lie(s: Sheet, look: PersonLook): void {
  const skin = rgb(PALETTE.skin[look.skin]);
  const y = FOOT.y - 9;
  // 敷布団と掛け布団（藍）
  s.rect(3, y + 5, 24, 4, WHITE);
  s.ball(18, y + 2 - look.frame * 0.4, 9, 4.5, AI);
  s.rect(10, y + 4, 17, 3, dark(AI));
  // 枕と頭
  s.rect(3, y + 2, 6, 3, BENI);
  s.ball(7, y, 4.4, 4, skin);
  s.rect(3, y - 3, 9, 2, WHITE);
  s.px(6, y + 1, SUMI);
  s.px(9, y + 1, SUMI);
  s.px(5, y + 2, CHEEK);
}

/** 親方: 藍の着物。立ち姿と、座敷の座り姿 */
function oyakata(s: Sheet, look: PersonLook): void {
  const skin = rgb(PALETTE.skin[look.skin]);
  const cx = FOOT.x;
  const ground = FOOT.y;
  const kimono = AI;
  if (look.pose === 'oyakataSit') {
    // 正座して腕を組む
    s.ball(cx, ground - 2, 9, 3, dark(kimono));
    s.ball(cx, ground - 9, 7.5, 6.5, kimono);
    s.limb(cx - 6, ground - 10, cx + 5, ground - 9, 1.7, dark(kimono));
    s.rect(cx - 1, ground - 15, 2, 5, WHITE);
    head(s, cx - 1, ground - 19 + look.frame * 0.5, skin, 'zanbara', true);
    return;
  }
  // 立って腕を組み、稽古を見る
  s.rect(cx - 5, ground - 3, 4, 3, WHITE);
  s.rect(cx + 2, ground - 3, 4, 3, WHITE);
  s.ball(cx, ground - 11, 7.2, 8.5, kimono);
  s.rect(cx - 6, ground - 6, 13, 4, dark(kimono));
  s.limb(cx - 6, ground - 13, cx + 5, ground - 12, 1.7, dark(kimono));
  s.rect(cx - 1, ground - 19, 2, 5, WHITE);
  head(s, cx - 1, ground - 23 + look.frame * 0.5, skin, 'zanbara', true);
}

const cache = new Map<string, Pixels>();

/** 人の絵（同じ見た目は使い回す） */
export function personPixels(look: PersonLook): Pixels {
  const key = `${look.pose}:${look.frame}:${look.skin}:${look.mawashi}:${look.hair}:${look.build}:${look.flip ? 1 : 0}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const s = new Sheet();
  if (look.pose === 'lie') lie(s, look);
  else if (look.pose === 'oyakata' || look.pose === 'oyakataSit') oyakata(s, look);
  else rikishi(s, look);
  const out = s.out(look.flip ?? false);
  cache.set(key, out);
  return out;
}
