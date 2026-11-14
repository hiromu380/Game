/**
 * 箱庭の人のドット絵（力士・親方・布団のけが人）を、コードで1ドットずつ組み立てる（純粋関数。Canvas を使わない）
 * 生成AIの絵（docs/sprites の rikishi_*）が届くまでの自前の絵。届いたら Hakoniwa の描き分けで差し替える
 * 足元は絵の下の中央（FOOT）。左下を向く。flip で左右を返す
 */
import { PALETTE } from '../palette';
import { dark, rgb, Sheet, SUMI, type Pixels, type Rgb } from '../pixel/sheet';

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
  | 'sweep'
  /** 仕切り（腰を落として両手を下ろす） */
  | 'shikiri'
  /** 行司（コマ 0: 軍配を構える / 1: 軍配を上げる） */
  | 'gyoji';

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
  /** まわしの色を替える（関取の締め込み。#rrggbb）。省くと mawashi の白・黒 */
  cloth?: string;
  flip?: boolean;
}

export const PERSON = { width: 30, height: 36 } as const;
/** 足元（絵の中の点） */
export const FOOT = { x: 15, y: 34 } as const;

export type { Pixels } from '../pixel/sheet';

const CHEEK = rgb(PALETTE.cheek);
const WHITE = rgb(PALETTE.washi);
const AI = rgb(PALETTE.ai);
const BENI = rgb(PALETTE.beni);
const WOOD = rgb(PALETTE.wood);
const GRAY = rgb(PALETTE.hairLight);

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
  const belt = look.cloth ? rgb(look.cloth) : look.mawashi === 'white' ? WHITE : SUMI;
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
    case 'shikiri': {
      // 仕切り: 腰を割って前へかがみ、両手を土俵に下ろす（コマ 1 で片手を浮かす）
      const b = body(-2, 4);
      leg(cx + 2, ground - 5, cx + 7, ground - 1);
      leg(cx - 3, ground - 5, cx - 6, ground - 1);
      s.ball(b.cx, b.cy, b.rx, b.ry, skin);
      mawashi(s, b, belt);
      arm(b.cx - b.rx + 1, b.cy - 1, b.cx - b.rx - 2, ground - 1 - f * 2);
      arm(b.cx - 2, b.cy + 2, b.cx - 5, ground - 1);
      head(s, b.cx - 4, b.cy - b.ry - 2, skin, look.hair);
      break;
    }
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

/** 行司: 烏帽子・紫の装束・軍配。軍配は左（flip で右）へ上げる */
function gyoji(s: Sheet, look: PersonLook): void {
  const skin = rgb(PALETTE.skin[look.skin]);
  const robe = rgb(PALETTE.murasaki);
  const cx = FOOT.x;
  const ground = FOOT.y;
  s.rect(cx - 5, ground - 2, 4, 2, WHITE);
  s.rect(cx + 2, ground - 2, 4, 2, WHITE);
  s.ball(cx, ground - 10, 7, 8, robe);
  s.rect(cx - 6, ground - 6, 13, 4, dark(robe));
  s.rect(cx - 1, ground - 18, 2, 4, WHITE);
  // 軍配: 構える（胸の前）／上げる（勝った方へ）
  if (look.frame === 0) {
    s.limb(cx - 5, ground - 12, cx - 7, ground - 9, 1.5, robe);
    s.limb(cx - 7, ground - 9, cx - 8, ground - 13, 0.6, WOOD);
    s.ball(cx - 8, ground - 15, 2.2, 2.6, rgb(PALETTE.odo), false);
  } else {
    s.limb(cx - 5, ground - 13, cx - 10, ground - 18, 1.5, robe);
    s.limb(cx - 10, ground - 18, cx - 12, ground - 22, 0.6, WOOD);
    s.ball(cx - 12, ground - 24, 2.4, 2.8, rgb(PALETTE.odo), false);
  }
  head(s, cx - 1, ground - 22, skin, 'zanbara');
  // 烏帽子
  s.rect(cx - 3, ground - 31, 5, 4, SUMI);
  s.rect(cx - 2, ground - 33, 3, 2, SUMI);
}

const cache = new Map<string, Pixels>();

/** 人の絵（同じ見た目は使い回す） */
export function personPixels(look: PersonLook): Pixels {
  const key = `${look.pose}:${look.frame}:${look.skin}:${look.mawashi}:${look.hair}:${look.build}:${look.cloth ?? ''}:${look.flip ? 1 : 0}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const s = new Sheet(PERSON.width, PERSON.height);
  if (look.pose === 'lie') lie(s, look);
  else if (look.pose === 'oyakata' || look.pose === 'oyakataSit') oyakata(s, look);
  else if (look.pose === 'gyoji') gyoji(s, look);
  else rikishi(s, look);
  const out = s.out(look.flip ?? false);
  cache.set(key, out);
  return out;
}
