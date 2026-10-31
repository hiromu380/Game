/**
 * 後援会とタニマチ（すべて推定。docs/realism.md「後援会」）
 *
 * - 会員（個人）と法人会員の年会費が、場所ごとに部屋に入る
 * - 大口の後援者（タニマチ）は名前つき。ひいきの力士がいて、関係（0〜100）しだいで場所ごとにご祝儀を出す。関係が薄れると離れる
 * - 千秋楽パーティーの規模で、会員の増え方・タニマチとの関係・名声が変わる
 */
import type { PartyLevel, PatronKind } from '../model/types';

export const KOENKAI = {
  /** 会員数の目安 = 基本 + 名声 × a + 関取 × b + 三役 × c。毎場所この目安へ2割ずつ近づく */
  memberBase: 80,
  memberPerPrestige: 2,
  memberPerSekitori: 120,
  memberPerSanyaku: 200,
  memberMove: 0.2,
  /** 個人会員の年会費（円） */
  memberDuesPerYear: 8_000,
  /** 法人会員の目安 = 関取 × a + 名声 × b */
  corporatePerSekitori: 2,
  corporatePerPrestige: 1 / 50,
  corporateDuesPerYear: 150_000,
  /** タニマチの上限・来る確率（場所ごと） */
  patronMax: 6,
  patronBaseChance: 0.06,
  patronChancePerSekitori: 0.08,
  patronChancePerPrestige: 1 / 1500,
  /** ご祝儀の基本額（場所ごと。関係 50 でこの額、0 で半分、100 で1.5倍） */
  patronGift: [200_000, 600_000] as const,
  /** 関係の動き */
  favorStart: 60,
  favorDecay: 2,
  favorKachikoshi: 3,
  favorMakekoshi: -2,
  favorPromotion: 10,
  /** これを下回ると離れる */
  favorLeave: 15,
  /** 挨拶回り（親方の貯金から。1人に場所ごと1回） */
  visitCost: 100_000,
  visitFavor: 12,
  /** 千秋楽パーティー */
  party: {
    none: { cost: 0, members: 0.9, favor: -1, prestige: 0 },
    small: { cost: 500_000, members: 1, favor: 0, prestige: 0 },
    grand: { cost: 2_000_000, members: 1.15, favor: 3, prestige: 0.3 },
  } satisfies Record<
    PartyLevel,
    { cost: number; members: number; favor: number; prestige: number }
  >,
  /** タニマチの名字（架空の人物。よくある名字から） */
  surnames: [
    '佐伯',
    '藤田',
    '大森',
    '川村',
    '島田',
    '野口',
    '岩崎',
    '松尾',
    '杉山',
    '北村',
    '平井',
    '服部',
    '荒木',
    '吉岡',
    '丸山',
    '今井',
    '久保',
    '堀内',
    '安藤',
    '宮下',
  ] as const,
  kinds: [
    'construction',
    'ryotei',
    'hospital',
    'it',
    'fishery',
    'brewery',
    'hometown',
  ] as const satisfies readonly PatronKind[],
} as const;
