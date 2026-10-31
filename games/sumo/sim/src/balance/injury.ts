/**
 * けがの部位・治療・古傷。数値はすべて推定（docs/realism.md「けがと休場」）
 */

export type InjuryPart =
  'knee' | 'ankle' | 'shoulder' | 'elbow' | 'back' | 'chest' | 'neck' | 'finger';

export const INJURY_PARTS: readonly InjuryPart[] = [
  'knee',
  'ankle',
  'shoulder',
  'elbow',
  'back',
  'chest',
  'neck',
  'finger',
];

export type Treatment = 'rest' | 'surgery';

export const INJURY = {
  /** 部位の出やすさ（膝は力士の職業病とされる）と、左右のある部位か */
  parts: {
    knee: { weight: 30, sided: true },
    ankle: { weight: 18, sided: true },
    shoulder: { weight: 12, sided: true },
    elbow: { weight: 10, sided: true },
    back: { weight: 12, sided: false },
    chest: { weight: 8, sided: false },
    neck: { weight: 4, sided: false },
    finger: { weight: 6, sided: true },
  } as Record<InjuryPart, { weight: number; sided: boolean }>,
  /** 古傷のある部位は、また痛めやすい（部位の重みの倍率） */
  recurrence: 3,
  /** 治療の方針を聞く全治（場所）の下限 */
  treatmentMinTotal: 2,
  /** 手術: 休む場所が増える */
  surgeryExtra: 1,
  /** 治ったときに古傷になる確率（保存療法・軽いけが・手術） */
  chronicChance: { rest: 0.45, minor: 0.2, surgery: 0.05 },
  /** 古傷1つあたりのけがのしやすさの増え方（数える古傷の上限） */
  chronicFragility: 0.25,
  chronicCountMax: 2,
  /** 古傷1つあたりの、1年で引退を考える確率の上乗せ */
  chronicRetirePerYear: 0.05,
} as const;

/**
 * 中日（8日目）の判断: 休場している弟子を後半から出す（再出場・途中出場）。推定の調整値
 */
export const MID_BASHO = {
  /** 何日目の後で止まるか */
  day: 8,
  /** 再出場した力士の調子の減点 */
  conditionPenalty: 10,
  /** 再出場した力士が取組でけがをする確率の倍率 */
  boutInjuryMultiplier: 3,
  /** 場所中のけがを押して再出場したとき、場所の後にけがが1場所ぶん重くなる確率 */
  worsenChance: 0.5,
} as const;
