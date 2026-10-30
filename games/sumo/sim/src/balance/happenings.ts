/**
 * 場所の間の出来事（場所前に1つ起きることがある。選択肢つき）
 *
 * 金額・効果はすべて推定の調整値。最後の選択肢は「断る・見送る」で、返事をしないまま場所を進めるとそれになる。
 * - requires: 起きる条件（部屋の様子）
 * - target: 誰の話か（条件に合う弟子から1人。本文の {name}）
 * - months: 起きる時期（これから取る場所の番号。0 初場所 / 1 春 / 2 夏 / 3 名古屋 / 4 秋 / 5 九州）
 * - chance: 選んだあと、確率で起きる追加の結果（うまくいった・いかなかった）
 */
import type { HappeningId, Style } from '../model/types';

/** 出来事の効果 */
export interface HappeningEffect {
  /** 部屋の口座の増減（円） */
  stableMoney?: number;
  /** 関取1人あたりの部屋の口座の増減 */
  perSekitoriMoney?: number;
  /** 親方の貯金の増減（円） */
  personalMoney?: number;
  prestige?: number;
  /** 対象の力士の疲れ（マイナスで抜ける） */
  fatigue?: number;
  /** 対象の力士の次の稽古の伸びの倍率 */
  boost?: number;
  /** 対象の力士がけがをする確率 */
  injuryRisk?: number;
  /** けがの弟子（target）の治りを早める（場所数） */
  heal?: number;
  /** 対象の力士のけがを長引かせる（場所数） */
  injury?: number;
  /** 対象の力士のけがのしやすさの倍率 */
  fragility?: number;
  /** 対象の力士の能力を上げる（best は一番高い能力） */
  ability?: { style: Style | 'best'; amount: number };
  /** 対象の力士の体重（kg） */
  weightKg?: number;
  /** 対象の力士が引退を申し出る確率 */
  retireRequest?: number;
  /** 入門希望者が来る（素質の範囲・経歴・外国出身） */
  candidate?: {
    talent: readonly [number, number];
    background: 'juniorHigh' | 'highSchool' | 'college' | 'otherSport';
    foreign?: boolean;
  };
}

export type HappeningGroup = 'sekitori' | 'upper' | 'lower' | 'all' | 'target';

export interface HappeningOption {
  key: string;
  /** 効果の対象（関取・幕下以上・幕下より下・弟子全員・この出来事の当人） */
  group?: HappeningGroup;
  effect: HappeningEffect;
  /** 確率 p で、さらに effect が起きる（うまくいった）。起きなければ「うまくいかなかった」 */
  chance?: { p: number; effect: HappeningEffect };
}

/** 起きる条件 */
export type HappeningRequirement =
  'none' | 'sekitori' | 'upper' | 'many' | 'rich' | 'heyatsuki' | 'alumni' | 'noForeign';

/** 誰の話か */
export type HappeningTarget =
  | 'injured'
  | 'young'
  | 'veteran'
  | 'sekitori'
  | 'sekitoriAdult'
  | 'upper'
  | 'lower'
  | 'foreign'
  | 'any';

export interface HappeningDef {
  id: HappeningId;
  requires: HappeningRequirement;
  target?: HappeningTarget;
  months?: readonly number[];
  weight: number;
  options: readonly HappeningOption[];
}

export const HAPPENING_CHANCE = 0.7;
/** 同じ出来事が続かないように、一度起きたら次に起きるまで空ける場所数 */
export const HAPPENING_COOLDOWN = 12;
/** 部屋が「お金に余裕がある」とみなす口座の額（円） */
export const HAPPENING_RICH = 30_000_000;
/** 「弟子が多い」とみなす人数 */
export const HAPPENING_MANY = 8;
/** 若い弟子・ベテランの年齢 */
export const HAPPENING_YOUNG_MAX = 19;
export const HAPPENING_VETERAN_MIN = 30;

const decline: HappeningOption = { key: 'decline', effect: {} };

export const HAPPENINGS: readonly HappeningDef[] = [
  // ── 後援会・タニマチ ──
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
      decline,
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
  {
    id: 'tanimachiDinner',
    requires: 'none',
    target: 'sekitori',
    weight: 2,
    options: [
      { key: 'go', group: 'target', effect: { prestige: 0.5, fatigue: 6, weightKg: 1 } },
      { key: 'master', effect: { personalMoney: -50_000, prestige: 0.3 } },
      decline,
    ],
  },
  {
    id: 'newSponsor',
    requires: 'none',
    weight: 1.5,
    options: [
      { key: 'accept', effect: { stableMoney: 1_000_000, prestige: 0.3 } },
      {
        key: 'askMore',
        effect: {},
        chance: { p: 0.5, effect: { stableMoney: 2_000_000, prestige: 0.3 } },
      },
      decline,
    ],
  },
  {
    id: 'sponsorScandal',
    requires: 'none',
    weight: 0.8,
    options: [
      { key: 'cutTies', effect: { stableMoney: -800_000, prestige: 1 } },
      { key: 'stayQuiet', effect: {}, chance: { p: 0.35, effect: { prestige: -4 } } },
    ],
  },
  {
    id: 'hometownCheer',
    requires: 'none',
    target: 'any',
    weight: 1.5,
    options: [
      {
        key: 'go',
        group: 'target',
        effect: { stableMoney: 200_000, boost: 1.1, fatigue: 5, prestige: 0.3 },
      },
      { key: 'letter', effect: { prestige: 0.1 } },
    ],
  },
  {
    id: 'kenshoOffer',
    requires: 'sekitori',
    weight: 1,
    options: [{ key: 'accept', effect: { stableMoney: 300_000, prestige: 0.5 } }, decline],
  },
  {
    id: 'merchandise',
    requires: 'sekitori',
    weight: 1,
    options: [
      {
        key: 'make',
        effect: { stableMoney: -600_000 },
        chance: { p: 0.6, effect: { stableMoney: 1_800_000, prestige: 0.5 } },
      },
      decline,
    ],
  },
  {
    id: 'chankoVideo',
    requires: 'none',
    weight: 1.2,
    options: [
      {
        key: 'film',
        group: 'all',
        effect: { prestige: 0.5, fatigue: 3 },
        chance: { p: 0.4, effect: { stableMoney: 600_000, prestige: 1 } },
      },
      decline,
    ],
  },

  // ── 稽古・成長 ──
  {
    id: 'demegeiko',
    requires: 'upper',
    weight: 2,
    options: [
      { key: 'send', group: 'upper', effect: { boost: 1.25, fatigue: 12, injuryRisk: 0.05 } },
      decline,
    ],
  },
  {
    id: 'rengoKeiko',
    requires: 'upper',
    weight: 1.5,
    options: [
      { key: 'attend', group: 'upper', effect: { boost: 1.15, fatigue: 8, prestige: 0.5 } },
      decline,
    ],
  },
  {
    id: 'soken',
    requires: 'sekitori',
    months: [0, 2, 4],
    weight: 2,
    options: [
      { key: 'attend', group: 'sekitori', effect: { boost: 1.1, fatigue: 8, prestige: 0.5 } },
      decline,
    ],
  },
  {
    id: 'kneeWorry',
    requires: 'none',
    target: 'upper',
    weight: 1.5,
    options: [
      { key: 'rest', group: 'target', effect: { fatigue: -25, boost: 0.9 } },
      { key: 'pushOn', group: 'target', effect: { boost: 1.1, injuryRisk: 0.25 } },
    ],
  },
  {
    id: 'guestCoach',
    requires: 'none',
    weight: 0.8,
    options: [
      { key: 'accept', group: 'all', effect: { stableMoney: -300_000, boost: 1.15, fatigue: 5 } },
      decline,
    ],
  },
  {
    id: 'bulkUp',
    requires: 'none',
    target: 'young',
    weight: 1.5,
    options: [
      { key: 'eat', group: 'target', effect: { stableMoney: -100_000, weightKg: 5 } },
      {
        key: 'balanced',
        group: 'target',
        effect: { weightKg: 2, ability: { style: 'best', amount: 1 } },
      },
    ],
  },
  {
    id: 'lateStudy',
    requires: 'none',
    target: 'any',
    weight: 1.5,
    options: [
      {
        key: 'allow',
        group: 'target',
        effect: { ability: { style: 'waza', amount: 2 }, fatigue: 8 },
      },
      { key: 'sleep', group: 'target', effect: { fatigue: -10 } },
    ],
  },
  {
    id: 'strictSenior',
    requires: 'many',
    target: 'young',
    weight: 1.2,
    options: [
      { key: 'leave', group: 'target', effect: { boost: 1.15, retireRequest: 0.15 } },
      { key: 'stepIn', effect: { prestige: 0.1 } },
    ],
  },
  {
    id: 'summerCamp',
    requires: 'none',
    months: [4],
    weight: 2,
    options: [
      {
        key: 'go',
        group: 'all',
        effect: { stableMoney: -800_000, boost: 1.2, fatigue: 10, prestige: 0.5 },
      },
      decline,
    ],
  },
  {
    id: 'heatWave',
    requires: 'none',
    months: [3, 4],
    weight: 2,
    options: [
      { key: 'aircon', effect: { stableMoney: -400_000 } },
      { key: 'endure', group: 'all', effect: { fatigue: 10 } },
    ],
  },
  {
    id: 'coldSnap',
    requires: 'none',
    months: [0, 1],
    weight: 1.5,
    options: [
      { key: 'heating', effect: { stableMoney: -300_000 } },
      { key: 'endure', group: 'all', effect: { injuryRisk: 0.03 } },
    ],
  },

  // ── 弟子の暮らし ──
  {
    id: 'homesick',
    requires: 'none',
    target: 'young',
    weight: 1.5,
    options: [
      { key: 'talk', group: 'target', effect: { retireRequest: 0.08 } },
      { key: 'homeVisit', group: 'target', effect: { fatigue: -20, boost: 0.9 } },
      { key: 'ignore', group: 'target', effect: { retireRequest: 0.35 } },
    ],
  },
  {
    id: 'runaway',
    requires: 'none',
    target: 'young',
    weight: 0.8,
    options: [
      { key: 'fetch', group: 'target', effect: { stableMoney: -50_000, retireRequest: 0.15 } },
      { key: 'wait', group: 'target', effect: { retireRequest: 0.5 } },
    ],
  },
  {
    id: 'parentsVisit',
    requires: 'none',
    target: 'any',
    weight: 1.2,
    options: [
      { key: 'welcome', group: 'target', effect: { stableMoney: -50_000, boost: 1.1 } },
      { key: 'busy', effect: {} },
    ],
  },
  {
    id: 'newChanko',
    requires: 'none',
    target: 'lower',
    weight: 1.2,
    options: [
      { key: 'praise', group: 'all', effect: { stableMoney: -60_000, weightKg: 1 } },
      { key: 'usual', effect: {} },
    ],
  },
  {
    id: 'snsTrouble',
    requires: 'none',
    target: 'any',
    weight: 0.8,
    options: [
      { key: 'apologize', effect: { prestige: -0.5 } },
      { key: 'phoneBan', group: 'all', effect: { prestige: -0.2, fatigue: 3 } },
      { key: 'ignore', effect: {}, chance: { p: 0.4, effect: { prestige: -3 } } },
    ],
  },
  {
    id: 'drinkingTrouble',
    requires: 'none',
    target: 'upper',
    weight: 0.6,
    options: [
      { key: 'punish', group: 'target', effect: { boost: 0.85, prestige: 0.3 } },
      { key: 'protect', effect: {}, chance: { p: 0.5, effect: { prestige: -4 } } },
    ],
  },
  {
    id: 'wedding',
    requires: 'none',
    target: 'sekitoriAdult',
    weight: 1,
    options: [
      {
        key: 'celebrate',
        group: 'target',
        effect: { stableMoney: -300_000, prestige: 1, boost: 1.1 },
      },
      { key: 'quiet', group: 'target', effect: { boost: 1.05 } },
    ],
  },
  {
    id: 'japaneseClass',
    requires: 'none',
    target: 'foreign',
    weight: 1.2,
    options: [
      { key: 'school', group: 'target', effect: { stableMoney: -100_000, boost: 1.08 } },
      { key: 'self', effect: {} },
    ],
  },
  {
    id: 'alumniVisit',
    requires: 'alumni',
    weight: 1.2,
    options: [{ key: 'welcome', group: 'all', effect: { boost: 1.05, prestige: 0.3 } }, decline],
  },
  {
    id: 'quarrel',
    requires: 'many',
    target: 'any',
    weight: 1,
    options: [
      { key: 'scoldBoth', effect: { prestige: 0.1 } },
      { key: 'letThem', group: 'target', effect: { injuryRisk: 0.15, boost: 1.05 } },
    ],
  },
  {
    id: 'veteranDoubt',
    requires: 'none',
    target: 'veteran',
    weight: 1.2,
    options: [
      { key: 'encourage', group: 'target', effect: { boost: 1.1, fatigue: 5 } },
      { key: 'respect', group: 'target', effect: { retireRequest: 0.5 } },
    ],
  },

  // ── 経営 ──
  {
    id: 'leakyRoof',
    requires: 'none',
    weight: 1.2,
    options: [
      { key: 'repair', effect: { stableMoney: -1_500_000 } },
      {
        key: 'patch',
        effect: { stableMoney: -200_000 },
        chance: { p: 0.4, effect: { stableMoney: -1_000_000 } },
      },
    ],
  },
  {
    id: 'managerQuits',
    requires: 'none',
    weight: 1,
    options: [
      { key: 'raise', effect: { stableMoney: -400_000 } },
      { key: 'letGo', group: 'all', effect: { prestige: -0.3, fatigue: 5 } },
    ],
  },
  {
    id: 'taxAudit',
    requires: 'rich',
    weight: 1,
    options: [
      { key: 'accountant', effect: { stableMoney: -500_000 } },
      {
        key: 'selfHandle',
        effect: {},
        chance: { p: 0.5, effect: { stableMoney: -1_500_000 } },
      },
    ],
  },
  {
    id: 'lodging',
    requires: 'none',
    months: [1, 3, 5],
    weight: 2,
    options: [
      { key: 'temple', group: 'all', effect: { stableMoney: -600_000, boost: 1.05 } },
      { key: 'cheap', group: 'all', effect: { stableMoney: -200_000, fatigue: 6 } },
    ],
  },
  {
    id: 'nutritionist',
    requires: 'none',
    weight: 1,
    options: [
      { key: 'hire', group: 'all', effect: { stableMoney: -300_000, boost: 1.05, fatigue: -5 } },
      decline,
    ],
  },
  {
    id: 'chiropractor',
    requires: 'none',
    weight: 1,
    options: [
      {
        key: 'try',
        group: 'all',
        effect: { stableMoney: -200_000 },
        chance: { p: 0.7, effect: { fatigue: -12 } },
      },
      decline,
    ],
  },

  // ── 協会・一門・地域 ──
  {
    id: 'ichimonMeeting',
    requires: 'none',
    weight: 1.5,
    options: [
      { key: 'attend', effect: { personalMoney: -100_000, prestige: 0.5 } },
      { key: 'skip', effect: { prestige: -0.5 } },
    ],
  },
  {
    id: 'associationDuty',
    requires: 'none',
    weight: 1.2,
    options: [
      { key: 'accept', group: 'all', effect: { prestige: 1, boost: 0.95 } },
      { key: 'coach', effect: { prestige: 0.3 } },
      { key: 'decline', effect: { prestige: -1 } },
    ],
  },
  {
    id: 'kidsSumo',
    requires: 'none',
    weight: 2,
    options: [
      { key: 'help', group: 'all', effect: { stableMoney: -200_000, prestige: 1.5, fatigue: 3 } },
      decline,
    ],
  },
  {
    id: 'tvInterview',
    requires: 'sekitori',
    weight: 2,
    options: [{ key: 'accept', group: 'sekitori', effect: { prestige: 2, fatigue: 5 } }, decline],
  },
  {
    id: 'hospitalVisit',
    requires: 'sekitori',
    weight: 1,
    options: [{ key: 'go', group: 'sekitori', effect: { prestige: 1, fatigue: 3 } }, decline],
  },
  {
    id: 'disasterRelief',
    requires: 'none',
    weight: 0.6,
    options: [
      { key: 'go', group: 'all', effect: { stableMoney: -300_000, prestige: 2, fatigue: 5 } },
      { key: 'donate', effect: { stableMoney: -500_000, prestige: 1 } },
      decline,
    ],
  },
  {
    id: 'overseasEvent',
    requires: 'sekitori',
    weight: 0.6,
    options: [
      {
        key: 'go',
        group: 'sekitori',
        effect: { stableMoney: 300_000, prestige: 1.5, fatigue: 12 },
      },
      decline,
    ],
  },
  {
    id: 'newYearVisit',
    requires: 'none',
    months: [0],
    weight: 2,
    options: [
      { key: 'shrine', group: 'all', effect: { prestige: 0.3, boost: 1.05 } },
      { key: 'keiko', group: 'all', effect: { boost: 1.08, fatigue: 5 } },
    ],
  },
  {
    id: 'setsubun',
    requires: 'sekitori',
    months: [1],
    weight: 2,
    options: [
      { key: 'go', group: 'sekitori', effect: { stableMoney: 200_000, prestige: 0.5, fatigue: 3 } },
      decline,
    ],
  },

  // ── スカウト ──
  {
    id: 'promisingKid',
    requires: 'none',
    weight: 1,
    options: [
      {
        key: 'visit',
        effect: {
          stableMoney: -100_000,
          candidate: { talent: [60, 82], background: 'juniorHigh' },
        },
      },
      decline,
    ],
  },
  {
    id: 'collegeStar',
    requires: 'none',
    weight: 0.6,
    options: [
      {
        key: 'visit',
        effect: { stableMoney: -300_000 },
        chance: {
          p: 0.5,
          effect: { candidate: { talent: [68, 90], background: 'college' } },
        },
      },
      decline,
    ],
  },
  {
    id: 'highSchoolCoach',
    requires: 'none',
    weight: 1,
    options: [
      {
        key: 'accept',
        effect: { stableMoney: -50_000, candidate: { talent: [50, 74], background: 'highSchool' } },
      },
      decline,
    ],
  },
  {
    id: 'overseasProspect',
    requires: 'noForeign',
    weight: 0.6,
    options: [
      {
        key: 'meet',
        effect: {
          stableMoney: -400_000,
          candidate: { talent: [58, 86], background: 'otherSport', foreign: true },
        },
      },
      decline,
    ],
  },

  // ── けが・医療 ──
  {
    id: 'famousDoctor',
    requires: 'none',
    target: 'injured',
    weight: 3,
    options: [
      { key: 'treat', group: 'target', effect: { stableMoney: -500_000, heal: 1 } },
      decline,
    ],
  },
  {
    id: 'surgery',
    requires: 'none',
    target: 'injured',
    weight: 1.5,
    options: [
      {
        key: 'operate',
        group: 'target',
        effect: { stableMoney: -800_000, injury: 1, fragility: 0.85 },
      },
      { key: 'conservative', effect: {} },
    ],
  },
];
