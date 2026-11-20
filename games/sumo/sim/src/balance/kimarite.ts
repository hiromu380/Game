/**
 * 決まり手（日本相撲協会の82手と、勝負結果の非技5つ。docs/realism.md「決まり手」）
 *
 * - group: 協会の分類（基本技7・投げ手13・掛け手18・反り手6・捻り手19・特殊技19・非技5）
 * - motion: 演出の動き（勝敗には影響しない）
 * - style: 出やすい型（null はどの型でも同じ）
 * - weight: 出やすさ。幕内の傾向（寄り切り・押し出し・寄り倒し・押し倒しで6割ほど）に合わせた推定の値
 * - reversal: 攻め込まれた側が逆転して決めることが多い技（格下が勝つときに出やすい）。非技は攻めた側の自滅
 */
import type { Style } from '../model/types';

export type KimariteGroup = 'kihon' | 'nage' | 'kake' | 'sori' | 'hineri' | 'tokushu' | 'hiwaza';

export type KimariteMotion =
  | 'thrust'
  | 'push'
  | 'force'
  | 'lift'
  | 'throw'
  | 'trip'
  | 'backward'
  | 'twist'
  | 'slapDown'
  | 'behind'
  | 'edge'
  | 'selfOut'
  | 'selfFall';

export interface KimariteDef {
  id: string;
  group: KimariteGroup;
  motion: KimariteMotion;
  style: Style | null;
  weight: number;
  reversal: boolean;
}

type Row = [string, KimariteMotion, Style | null, number, boolean?];

const ROWS: Record<KimariteGroup, Row[]> = {
  kihon: [
    ['tsukidashi', 'thrust', 'oshi', 2.2],
    ['tsukitaoshi', 'thrust', 'oshi', 1],
    ['oshidashi', 'push', 'oshi', 21],
    ['oshitaoshi', 'push', 'oshi', 3.5],
    ['yorikiri', 'force', 'yotsu', 28],
    ['yoritaoshi', 'force', 'yotsu', 4],
    ['abisetaoshi', 'force', 'yotsu', 0.4],
  ],
  nage: [
    ['uwatenage', 'throw', 'yotsu', 4],
    ['shitatenage', 'throw', 'yotsu', 2],
    ['kotenage', 'throw', null, 2, true],
    ['sukuinage', 'throw', 'waza', 1.5, true],
    ['uwatedashinage', 'throw', 'waza', 1],
    ['shitatedashinage', 'throw', 'waza', 0.5],
    ['koshinage', 'throw', 'yotsu', 0.05],
    ['kubinage', 'throw', null, 0.3, true],
    ['ipponzeoi', 'throw', 'waza', 0.02],
    ['nichonage', 'throw', 'waza', 0.02],
    ['yaguranage', 'throw', 'yotsu', 0.02],
    ['kakenage', 'throw', 'yotsu', 0.05],
    ['tsukaminage', 'throw', 'yotsu', 0.02],
  ],
  kake: [
    ['uchigake', 'trip', 'yotsu', 0.2],
    ['sotogake', 'trip', 'yotsu', 0.3],
    ['chongake', 'trip', 'waza', 0.05],
    ['kirikaeshi', 'trip', 'waza', 0.2],
    ['kawazugake', 'trip', 'waza', 0.03, true],
    ['kekaeshi', 'trip', 'waza', 0.1],
    ['ketaguri', 'trip', 'waza', 0.1],
    ['mitokorozeme', 'trip', 'waza', 0.02],
    ['watashikomi', 'trip', 'waza', 0.4],
    ['nimaigeri', 'trip', 'waza', 0.01],
    ['komatasukui', 'trip', 'waza', 0.05],
    ['sotokomata', 'trip', 'waza', 0.03],
    ['omata', 'trip', 'waza', 0.02],
    ['tsumatori', 'trip', 'waza', 0.005],
    ['kozumatori', 'trip', 'waza', 0.02],
    ['ashitori', 'trip', 'waza', 0.1],
    ['susotori', 'trip', 'waza', 0.02],
    ['susoharai', 'trip', 'waza', 0.01],
  ],
  sori: [
    ['izori', 'backward', 'waza', 0.01, true],
    ['shumokuzori', 'backward', null, 0.002],
    ['kakezori', 'backward', null, 0.002],
    ['tasukizori', 'backward', null, 0.005],
    ['sototasukizori', 'backward', null, 0.002],
    ['tsutaezori', 'backward', 'waza', 0.01, true],
  ],
  hineri: [
    ['tsukiotoshi', 'twist', null, 6, true],
    ['makiotoshi', 'twist', 'waza', 0.3, true],
    ['tottari', 'twist', 'waza', 0.2],
    ['sakatottari', 'twist', 'waza', 0.05, true],
    ['katasukashi', 'twist', 'waza', 0.6, true],
    ['sotomuso', 'twist', 'waza', 0.005],
    ['uchimuso', 'twist', 'waza', 0.03],
    ['zubuneri', 'twist', 'waza', 0.02],
    ['uwatehineri', 'twist', 'yotsu', 0.1],
    ['shitatehineri', 'twist', 'yotsu', 0.1],
    ['amiuchi', 'twist', 'waza', 0.02],
    ['sabaori', 'force', 'yotsu', 0.03],
    ['harimanage', 'throw', 'yotsu', 0.02, true],
    ['osakate', 'throw', 'yotsu', 0.01],
    ['kainahineri', 'twist', 'waza', 0.03],
    ['gasshohineri', 'twist', 'yotsu', 0.01],
    ['tokkurinage', 'throw', 'yotsu', 0.005],
    ['kubihineri', 'twist', 'waza', 0.05],
    ['kotehineri', 'twist', 'waza', 0.1],
  ],
  tokushu: [
    ['hatakikomi', 'slapDown', null, 7, true],
    ['hikiotoshi', 'slapDown', null, 3, true],
    ['hikkake', 'slapDown', 'waza', 0.4, true],
    ['tsuridashi', 'lift', 'yotsu', 0.3],
    ['okuritsuridashi', 'lift', 'yotsu', 0.02],
    ['tsuriotoshi', 'lift', 'yotsu', 0.01],
    ['okuritsuriotoshi', 'lift', 'yotsu', 0.005],
    ['okuridashi', 'behind', null, 3],
    ['okuritaoshi', 'behind', null, 0.4],
    ['okurinage', 'behind', null, 0.05],
    ['okurigake', 'behind', null, 0.02],
    ['okurihikiotoshi', 'behind', null, 0.03],
    ['waridashi', 'force', 'yotsu', 0.1],
    ['utchari', 'edge', 'yotsu', 0.1, true],
    ['kimedashi', 'force', 'yotsu', 0.4],
    ['kimetaoshi', 'force', 'yotsu', 0.1],
    ['ushiromotare', 'edge', null, 0.01, true],
    ['yobimodoshi', 'throw', 'yotsu', 0.02],
    ['sokubiotoshi', 'slapDown', null, 0.03, true],
  ],
  hiwaza: [
    ['isamiashi', 'selfOut', null, 0.5, true],
    ['koshikudake', 'selfFall', null, 0.1, true],
    ['tsukite', 'selfFall', null, 0.15, true],
    ['tsukihiza', 'selfFall', null, 0.05, true],
    ['fumidashi', 'selfOut', null, 0.02, true],
  ],
};

export const KIMARITE: readonly KimariteDef[] = (
  Object.entries(ROWS) as [KimariteGroup, Row[]][]
).flatMap(([group, rows]) =>
  rows.map(([id, motion, style, weight, reversal]) => ({
    id,
    group,
    motion,
    style,
    weight,
    reversal: reversal ?? false,
  })),
);

export const KIMARITE_BY_ID: ReadonlyMap<string, KimariteDef> = new Map(
  KIMARITE.map((k) => [k.id, k]),
);

/** 決まり手の選び方の調整値（推定） */
export const KIMARITE_PICK = {
  /** 勝った側の型に合う技の倍率 */
  styleMatch: 3,
  /** 型を選ばない技の倍率 */
  styleAny: 1.5,
  /** 勝つ確率がこれより低い側が勝ったら「逆転の技」が出やすい */
  upsetBelow: 0.4,
  /** 逆転の技の倍率（格下が勝ったとき / それ以外） */
  reversalUpset: 3,
  reversalOther: 0.6,
  /** 吊りは、勝った側が軽いと出にくい */
  liftLighter: 0.3,
} as const;
