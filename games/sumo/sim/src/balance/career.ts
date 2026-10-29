/**
 * 入門・引退・年寄名跡（docs/realism.md「新弟子検査」「親方（年寄）」。確率は調整値）
 */
export const RECRUIT = {
  /** 新弟子の年齢 */
  ageMin: 15,
  ageMax: 22,
  /** 新弟子検査の体格（docs/realism.md「新弟子検査」） */
  minHeight: 167,
  minWeight: 67,
  /** 外国出身は1部屋1人 */
  foreignPerStable: 1,
  /** 架空の部屋が1年に入れる新弟子の数（全体。番付の人数を保つ） */
  npcPerYearTarget: 640,
  /** 自分の部屋に来る入門希望者の数（場所ごと。春場所は中学・高校の卒業で多い） */
  playerCandidates: { normal: [0, 2] as const, spring: [2, 4] as const },
  /** 素質（伸びの上限）の分布: 基本の範囲と、名声 10 あたりの上乗せ */
  talentMin: 34,
  talentMax: 72,
  talentRareChance: 0.06,
  talentRareMax: 95,
  talentPerPrestige: 0.05,
  /** 名声による素質の上乗せの上限 */
  talentPrestigeMax: 10,
  /** 入門時の能力 */
  startAbilityMin: 14,
  startAbilityMax: 28,
};

export const RETIRE = {
  /** この年齢を過ぎると引退を考え始める */
  ageSoft: 30,
  /** この年齢で必ず引退 */
  ageHard: 40,
  /** 年あたりの引退の確率（年齢と地位で上がる） */
  basePerYear: 0.04,
  perYearOverSoft: 0.12,
  /** 関取から幕下以下に落ちた年長の力士は引退しやすい */
  fallenSekitori: 0.25,
  /** 幕下以下で伸びない若手の引退（1年あたり） */
  lowerStalled: 0.08,
};

/** 年寄名跡（docs/realism.md「親方（年寄）」） */
export const TOSHIYORI = {
  total: 105,
  /** 襲名の資格（いずれか） */
  sanyakuBasho: 1,
  makuuchiBasho: 20,
  sekitoriBasho: 30,
  /** 定年 */
  retireAge: 65,
  /** 1年に空く名跡の数（定年などで。推定） */
  freedPerYear: [3, 6] as const,
  /** 空いた名跡を他の部屋の資格者が先に取る確率（推定） */
  npcTakeChance: 0.6,
  /** 年の終わりに、他の部屋（借株・名跡の交換など）が空きを埋めて、残る空きの数の上限（推定。名跡はいつも足りない） */
  freeAfterYearMax: 2,
  /** 自分の部屋の資格者が名跡の空きを待てる年数（過ぎたら協会を去る） */
  waitYears: 3,
  /** 部屋付きの親方の年齢の幅（ゲーム開始時の自分） */
  startAge: 40,
};
