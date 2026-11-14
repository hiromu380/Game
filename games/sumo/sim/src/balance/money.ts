/**
 * お金（円）。実際の値は docs/realism.md の項目名を添える。資料のない値は「推定」
 *
 * 時間の単位は場所（2か月）。月額の値は ×2 して場所ごとにする。
 */
import type { Division, Title } from '../model/types';

/** 関取の月給（docs/realism.md「関取の月給」2027年初場所から） */
export const SEKITORI_MONTHLY: Record<'Y' | 'O' | 'sanyaku' | 'M' | 'juryo', number> = {
  Y: 3_300_000,
  O: 2_750_000,
  sanyaku: 2_000_000,
  M: 1_550_000,
  juryo: 1_200_000,
};

/** 幕下以下の場所手当・勝星金・勝ち越し金・各段優勝（docs/realism.md「幕下以下（養成員）の場所手当など」） */
export const LOWER_PAY: Record<
  Exclude<Division, 'makuuchi' | 'juryo'>,
  { allowance: number; perWin: number; kachikoshi: number; yusho: number }
> = {
  makushita: { allowance: 180_000, perWin: 4_000, kachikoshi: 10_000, yusho: 700_000 },
  sandanme: { allowance: 120_000, perWin: 3_500, kachikoshi: 8_500, yusho: 500_000 },
  jonidan: { allowance: 95_000, perWin: 3_000, kachikoshi: 7_500, yusho: 300_000 },
  jonokuchi: { allowance: 82_000, perWin: 3_000, kachikoshi: 7_500, yusho: 200_000 },
};

/** 幕内優勝・十両優勝の賞金（docs/realism.md。十両は推定） */
export const YUSHO_PRIZE = { makuuchi: 20_000_000, juryo: 3_000_000 };

/**
 * 力士褒賞金（docs/realism.md「力士褒賞金」）。持ち給金は 0.5円単位なので「半円」の整数で持つ
 */
export const MOCHIKYUKIN = {
  /** 1円 = 4000円 */
  yenPerUnit: 4_000,
  startHalf: 6, // 3円
  perKachikoshiWinHalf: 1, // 勝ち越し1つ 0.5円
  kinboshiHalf: 20, // 10円
  yushoHalf: 60, // 30円
  zenshoHalf: 100, // 50円
  /** 地位ごとの最低額 */
  minimumHalf: { juryo: 80, M: 120, O: 200, Y: 300 } as const,
};

/**
 * 懸賞金（docs/realism.md「懸賞金」）。1本 7万円 = 協会の手数料 1万円 ＋ 力士 6万円
 * （土俵で受け取る袋に 1万円、残り 5万円は口座へ振り込み。振り込み分は税金に充てる積立を兼ねる）
 */
export const KENSHO = {
  perBanner: 70_000,
  associationFee: 10_000,
  /** 力士の取り分（袋 + 振り込み） */
  toRikishi: 60_000,
  inEnvelope: 10_000,
  toAccount: 50_000,
  /** 1番あたりの本数の目安（推定。結びの一番・横綱戦に集まる） */
  perBoutByTitle: { Y: 25, O: 12, S: 6, K: 5, M: 1 } satisfies Record<Title, number>,
};

/** 部屋（師匠）への支給（docs/realism.md「部屋（師匠）への支給」） */
export const STABLE_SUBSIDY = {
  /** 力士養成費: 幕下以下1人あたり 月7万円 → 場所ごと 14万円 */
  traineePerBasho: 140_000,
  /** 相撲部屋維持費: 1人あたり 場所ごと */
  upkeepPerBasho: 115_000,
  /** 稽古場維持費: 1人あたり 場所ごと */
  dojoPerBasho: 45_000,
  /** 養成奨励金（年額）。場所ごとに 1/6 ずつ入れる */
  sekitoriBonusYearly: {
    juryo: 1_140_000,
    M: 1_260_000,
    sanyaku: 1_560_000,
    O: 2_160_000,
    Y: 2_760_000,
  },
};

/** 部屋の支出（すべて推定。docs/realism.md「まだ確かめていないこと」） */
export const STABLE_COSTS = {
  /** 食費（ちゃんこ）: 1人あたり 場所ごと（元おかみの「年 2,000万円以上」を 30人ほどで割った目安） */
  foodPerRikishi: 110_000,
  /** 建物（家賃・ローン）・光熱費・雑費: 場所ごと */
  fixedPerBasho: 1_600_000,
  /** 力士1人あたりの雑費（稽古まわし・日用品・医療など）: 場所ごと */
  miscPerRikishi: 50_000,
  /** マネージャーなどの人件費: 場所ごと */
  staffPerBasho: 600_000,
  /** 関取の付け人・遠征などで増える費用: 関取1人あたり 場所ごと */
  perSekitori: 300_000,
};

/** 後援会・タニマチ（推定）: 場所ごと */
export const SUPPORTERS = {
  base: 300_000,
  perSekitori: 600_000,
  perSanyaku: 1_000_000,
  /** 名声 1 あたり */
  perPrestige: 5_000,
};

/** 親方（docs/realism.md「親方（年寄）」）。個人の収入と生活費（生活費は推定） */
export const OYAKATA_PAY = {
  monthly: 784_000,
  livingPerBasho: 1_000_000,
};

/** ゲーム開始時のお金（推定。部屋を開くときの協会からの補助はない） */
export const START_MONEY = {
  stable: 10_000_000,
  personal: 20_000_000,
};
