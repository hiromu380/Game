/**
 * 今週の好機と逆風（すべて推定。docs/balance-log.md）
 * 場所前の各週に、その週だけの追い風か向かい風が出ることがある。効く行動に掛ける倍率で表す。
 * 毎週の正解を動かし、読んで乗る・避けるのが親方の腕になる
 */
export interface TideDef {
  /** 追い風か向かい風か（画面の印） */
  tone: 'good' | 'bad';
  /** 選ばれやすさ */
  weight: number;
  /** 行動ごとの伸びの倍率（壁で上がる素質にも掛かる） */
  coach?: number;
  spar?: number;
  mune?: number;
  degeiko?: number;
  /** 稽古の行動の疲れ・けがの倍率 */
  fatigue?: number;
  injury?: number;
  /** 休ませたときの回復の倍率 */
  rest?: number;
  /** 挨拶回りで上がる関係の倍率 */
  visit?: number;
  /** スカウト回り: 素質の上乗せ・会える人数に足す */
  scoutTalent?: number;
  scoutCount?: number;
  /** この週は費用がかからない行動 */
  free?: 'mune' | 'degeiko';
}

export const TIDES = {
  /** 横綱の一行が近くで稽古: 胸を借りると1.5倍伸びる */
  yokozuna: { tone: 'good', weight: 2, mune: 1.5 },
  /** 一門の連合稽古: 出稽古がただで、倍伸びる */
  rengo: { tone: 'good', weight: 2, degeiko: 2, free: 'degeiko' },
  /** 部屋に活気: 申し合いが1.5倍伸び、けがも少ない */
  spirit: { tone: 'good', weight: 2, spar: 1.5, injury: 0.5 },
  /** 涼しい朝: 個別指導がよく伸び、疲れにくい */
  cool: { tone: 'good', weight: 2, coach: 1.4, fatigue: 0.5 },
  /** 町の祭り: 挨拶回りの効き目が倍 */
  festival: { tone: 'good', weight: 2, visit: 2 },
  /** 逸材の噂: スカウト回りで会える子が増え、素質も高い */
  rumor: { tone: 'good', weight: 1, scoutTalent: 4, scoutCount: 1 },
  /** 整体師の巡回: 休ませると倍回復する */
  seitai: { tone: 'good', weight: 2, rest: 2 },
  /** 長雨: 稽古が半分しか伸びない */
  rain: { tone: 'bad', weight: 3, coach: 0.5, spar: 0.5, mune: 0.5, degeiko: 0.5 },
  /** 猛暑・厳寒: 稽古の疲れが倍、けがも増える */
  harsh: { tone: 'bad', weight: 3, fatigue: 2, injury: 1.6 },
  /** 風邪がはやる: 稽古の伸びが落ち、休ませても回復が半分 */
  cold: { tone: 'bad', weight: 2, coach: 0.7, spar: 0.7, rest: 0.5 },
} as const satisfies Record<string, TideDef>;

export type TideId = keyof typeof TIDES;
export const TIDE_IDS = Object.keys(TIDES) as TideId[];

/** 週ごとに、好機か逆風が出る確率 */
export const TIDE_CHANCE = 0.55;
