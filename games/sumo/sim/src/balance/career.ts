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
  /**
   * 自分の部屋に来る入門希望者（実際は全体で年に50〜60人ほどを40余りの部屋で分ける）。
   * 春場所の前は中学・高校の卒業で1〜3人、ほかの場所の前は確率で1人。
   * 名声とスカウトの網で、ほかの場所の前に来る確率が上がる
   */
  playerCandidates: {
    spring: [1, 2] as const,
    otherChance: 0.15,
    otherChancePerPrestige: 0.003,
    otherChanceMax: 0.5,
    /** スカウトの網のレベルあたり、来る確率の上乗せ */
    otherChancePerScout: 0.15,
  },
  /** 架空の部屋も新弟子を選ぶ: 素質を2回引いて良い方を取る確率 */
  npcScoutChance: 0.5,
  /** 素質（伸びの上限）の分布: 基本の範囲と、名声 10 あたりの上乗せ */
  talentMin: 34,
  talentMax: 72,
  talentRareChance: 0.06,
  talentRareMax: 90,
  /** まれな逸材（横綱になりうる素質） */
  talentStarChance: 0.012,
  talentStarMin: 92,
  talentPerPrestige: 0.05,
  /** 名声による素質の上乗せの上限 */
  talentPrestigeMax: 4,
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
  /** 横綱: 2場所・3場所続けて負け越し（休場を含む）のときの引退の確率 */
  yokozunaBad2: 0.3,
  yokozunaBad3: 0.7,
  /** 関取から幕下以下に落ちた年長の力士は引退しやすい */
  fallenSekitori: 0.25,
  /** 幕下以下で伸びない若手の引退（1年あたり。この年齢から） */
  lowerStalled: 0.15,
  lowerStalledFromAge: 21,
  /** 関取になったことのない力士の、年あたりの引退の上乗せ（入門して数年でやめる人が多い） */
  neverSekitoriPerYear: 0.06,
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
