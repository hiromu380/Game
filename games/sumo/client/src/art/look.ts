/**
 * 力士・親方の見た目を決める（純粋関数）
 *
 * 同じ力士はいつ見ても同じ顔になるよう、ID から目・眉・口・肌を決める。
 * 体つき・髪・まわしは今の状態（体重・番付・場所数・けが・疲れ）から決める。docs/art-style.md
 */
import { PALETTE, SHIMEKOMI } from './palette';

export type Eyes = 'dot' | 'line' | 'smile' | 'sharp';
export type Brows = 'thick' | 'arched' | 'angry';
export type Mouth = 'he' | 'o' | 'smile' | 'flat';
export type Hair = 'zanbara' | 'chonmage' | 'oicho' | 'short' | 'gray';

export interface Look {
  skin: string;
  eyes: Eyes;
  brows: Brows;
  mouth: Mouth;
  hair: Hair;
  /** 体の横幅の半分（viewBox の単位） */
  width: number;
  /** まわしの色（親方は着物の色） */
  cloth: string;
  /** 関取の下がり */
  sagari: boolean;
  /** 横綱の綱 */
  tsuna: boolean;
  bandage: boolean;
  sweat: boolean;
  /** 親方（着物） */
  kimono: boolean;
}

/** 整数のハッシュ（xorshift を数回） */
export function hash(n: number, salt = 0): number {
  let x = (n * 2654435761 + salt * 40503) >>> 0 || 1;
  for (let i = 0; i < 3; i++) {
    x ^= x << 13;
    x >>>= 0;
    x ^= x >>> 17;
    x ^= x << 5;
    x >>>= 0;
  }
  return x;
}

const pick = <T>(items: readonly T[], h: number): T => items[h % items.length]!;

const EYES: Eyes[] = ['dot', 'line', 'smile', 'sharp'];
const BROWS: Brows[] = ['thick', 'arched', 'angry'];
const MOUTHS: Mouth[] = ['he', 'o', 'smile', 'flat'];

/** 体重 → 体の横幅（軽い新弟子は細く、重い関取は丸い） */
export function widthFor(weight: number): number {
  return Math.max(26, Math.min(46, 26 + (weight - 90) * 0.25));
}

export interface RikishiLookInput {
  id: number;
  weight: number;
  stableId: number;
  /** 番付に載った場所数（入門したてはざんばら） */
  careerBasho: number;
  sekitori: boolean;
  yokozuna: boolean;
  injured: boolean;
  fatigue: number;
}

export function rikishiLook(i: RikishiLookInput): Look {
  return {
    skin: pick(PALETTE.skin, hash(i.id, 1)),
    eyes: pick(EYES, hash(i.id, 2)),
    brows: pick(BROWS, hash(i.id, 3)),
    mouth: pick(MOUTHS, hash(i.id, 4)),
    hair: i.careerBasho < 6 ? 'zanbara' : i.sekitori ? 'oicho' : 'chonmage',
    width: widthFor(i.weight),
    cloth: i.sekitori ? pick(SHIMEKOMI, hash(i.stableId, 5)) : PALETTE.sumi,
    sagari: i.sekitori,
    tsuna: i.yokozuna,
    bandage: i.injured,
    sweat: i.fatigue >= 60,
    kimono: false,
  };
}

/** 親方（着物・髪はふつう。年を取ると白髪） */
export function oyakataLook(i: { id: number; age: number; stableId: number }): Look {
  return {
    skin: pick(PALETTE.skin, hash(i.id, 1)),
    eyes: pick(EYES, hash(i.id, 2)),
    brows: pick(BROWS, hash(i.id, 3)),
    mouth: pick(MOUTHS, hash(i.id, 4)),
    hair: i.age >= 55 ? 'gray' : 'short',
    width: 34,
    cloth: pick([PALETTE.sumi, PALETTE.ai, '#3b3328'], hash(i.stableId, 6)),
    sagari: false,
    tsuna: false,
    bandage: false,
    sweat: false,
    kimono: true,
  };
}
