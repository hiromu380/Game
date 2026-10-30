/**
 * 場所の間の出来事（場所前に1つ起きることがある。選択肢つき）
 *
 * 金額・効果はすべて推定の調整値。最後の選択肢は「断る・見送る」で、返事をしないまま場所を進めるとそれになる。
 */
import type { HappeningId } from '../model/types';

/** 出来事の効果 */
export interface HappeningEffect {
  /** 部屋の口座の増減（円） */
  stableMoney?: number;
  /** 関取1人あたりの部屋の口座の増減 */
  perSekitoriMoney?: number;
  prestige?: number;
  /** 対象の力士の疲れ */
  fatigue?: number;
  /** 対象の力士の次の稽古の伸びの倍率 */
  boost?: number;
  /** 対象の力士がけがをする確率 */
  injuryRisk?: number;
  /** けがの弟子（target）の治りを早める（場所数） */
  heal?: number;
  /** 素質の高い入門希望者が来る（素質の範囲） */
  candidate?: readonly [number, number];
}

export interface HappeningOption {
  key: string;
  /** 効果の対象（関取・幕下以上・弟子全員） */
  group?: 'sekitori' | 'upper' | 'all';
  effect: HappeningEffect;
}

export interface HappeningDef {
  id: HappeningId;
  /** 起きる条件: 関取がいる・幕下以上がいる・けがの弟子がいる・なし */
  requires: 'sekitori' | 'upper' | 'injured' | 'none';
  weight: number;
  options: readonly HappeningOption[];
}

export const HAPPENING_CHANCE = 0.7;

export const HAPPENINGS: readonly HappeningDef[] = [
  {
    id: 'supporterParty',
    requires: 'none',
    weight: 3,
    options: [
      {
        key: 'withSekitori',
        group: 'sekitori',
        effect: { stableMoney: 500_000, perSekitoriMoney: 300_000, prestige: 1, fatigue: 10 },
      },
      { key: 'masterOnly', effect: { stableMoney: 300_000 } },
      { key: 'decline', effect: {} },
    ],
  },
  {
    id: 'demegeiko',
    requires: 'upper',
    weight: 2,
    options: [
      { key: 'send', group: 'upper', effect: { boost: 1.25, fatigue: 12, injuryRisk: 0.05 } },
      { key: 'decline', effect: {} },
    ],
  },
  {
    id: 'tvInterview',
    requires: 'sekitori',
    weight: 2,
    options: [
      { key: 'accept', group: 'sekitori', effect: { prestige: 2, fatigue: 5 } },
      { key: 'decline', effect: {} },
    ],
  },
  {
    id: 'kidsSumo',
    requires: 'none',
    weight: 2,
    options: [
      { key: 'help', group: 'all', effect: { stableMoney: -200_000, prestige: 1.5, fatigue: 3 } },
      { key: 'decline', effect: {} },
    ],
  },
  {
    id: 'famousDoctor',
    requires: 'injured',
    weight: 3,
    options: [
      { key: 'treat', effect: { stableMoney: -500_000, heal: 1 } },
      { key: 'decline', effect: {} },
    ],
  },
  {
    id: 'promisingKid',
    requires: 'none',
    weight: 1,
    options: [
      { key: 'visit', effect: { stableMoney: -100_000, candidate: [60, 82] } },
      { key: 'decline', effect: {} },
    ],
  },
  {
    id: 'riceGift',
    requires: 'none',
    weight: 2,
    options: [
      { key: 'thank', effect: { stableMoney: 250_000, prestige: 0.5 } },
      { key: 'receive', effect: { stableMoney: 300_000 } },
    ],
  },
];
