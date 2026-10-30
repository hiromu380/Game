/**
 * 協会の役職と理事選挙（docs/realism.md「協会の役職と理事選挙」）
 *
 * - 役職: 年寄 → 主任 → 委員 → 役員待遇委員 → 副理事・理事（選挙）→ 理事長（理事の互選）
 * - 理事選挙は2年に1度。理事10人・副理事3人。全親方が投票するが、一門の事前調整で定員どおり（無投票）になることが多い
 * - 月給は年寄 78.4万・委員 100.1万円が報道の実額。ほかは推定
 */
import type { AssocRank } from '../model/types';

export const OFFICE_ORDER: readonly AssocRank[] = [
  'toshiyori',
  'shunin',
  'iin',
  'yakuinTaiguu',
  'fukuRiji',
  'riji',
  'rijicho',
];

export const OFFICE = {
  /** 月給（円） */
  monthly: {
    toshiyori: 784_000,
    shunin: 860_000, // 推定
    iin: 1_001_000,
    yakuinTaiguu: 1_150_000, // 推定
    fukuRiji: 1_250_000, // 推定
    riji: 1_450_000, // 推定
    rijicho: 2_000_000, // 推定
  } satisfies Record<AssocRank, number>,
  /** 場所ごとの名声（協会の要職にいると部屋の格が上がる。推定） */
  prestigePerBasho: {
    toshiyori: 0,
    shunin: 0,
    iin: 0,
    yakuinTaiguu: 0.1,
    fukuRiji: 0.3,
    riji: 0.5,
    rijicho: 1,
  } satisfies Record<AssocRank, number>,
  /** 理事・副理事・理事長は協会の仕事で稽古場に立つ時間が減る（部屋付きの親方がいれば補える。推定） */
  busyGrowth: 0.97,
  /** 年の終わりの昇格の目安（推定）: 主任は45歳、委員は50歳か名声100（45歳以上）、役員待遇委員は委員を4年かつ名声150 */
  shuninAge: 45,
  iinAge: 50,
  iinPrestige: 100,
  iinPrestigeAge: 45,
  taiguuYears: 4,
  taiguuPrestige: 150,
  /** 理事選挙: 2年に1度（初場所の後）。定員 */
  electionEveryBasho: 12,
  rijiSeats: 10,
  fukuRijiSeats: 3,
  /** 一門の推薦を受けられる役職の下限 */
  candidateFrom: 'iin' as AssocRank,
  /** 一門の推薦なしで立候補したとき、当選する確率（名声で上がる。推定） */
  rebelBase: 0.12,
  rebelPerPrestige: 1 / 700,
  rebelMax: 0.55,
  /** 造反で当選・落選したときの名声（推定） */
  rebelWinPrestige: 3,
  rebelLosePrestige: -3,
} as const;
