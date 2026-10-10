/**
 * 数値の置き場（表示と抽選処理は必ずここを参照する。コードに直書きしない）
 *
 * 単位: 距離はタイル、時間は秒、金額はチップ（整数）
 */

/** 抽選結果の種類 */
export type OutcomeId = 'miss' | 'small' | 'medium' | 'big' | 'jackpot';

export interface OutcomeDef {
  id: OutcomeId;
  /** 出現の重み（合計 10000 = 100.00%） */
  weight: number;
  /**
   * 払い戻しの倍率（元金を含む）を 10 倍した整数。1.5 倍 → 15。
   * 払い戻し = floor(賭け金 × payoutTenths / 10)（端数は切り捨て）
   */
  payoutTenths: number;
}

/** 通常台の抽選表（出現率と払い戻し。表示もこの表から作る） */
export const SLOT_TABLE: readonly OutcomeDef[] = [
  { id: 'miss', weight: 6000, payoutTenths: 0 },
  { id: 'small', weight: 2500, payoutTenths: 15 },
  { id: 'medium', weight: 1000, payoutTenths: 30 },
  { id: 'big', weight: 400, payoutTenths: 100 },
  { id: 'jackpot', weight: 100, payoutTenths: 1000 },
];

export const BALANCE = {
  /** 挑戦開始時の所持チップ */
  startChips: 10,
  /** 「小額」の賭け金 */
  minBet: 1,

  /** 導入の壊れた台（最初の抽選が必ず 777。確定したら故障して止まる） */
  brokenMachine: { limit: 10 },

  /** 抽選: リールが回る時間 */
  spinSeconds: 0.9,
  /**
   * 払い出しの時間（秒）= clamp(base + perDigit × log10(払い戻し), min, max)
   * 低額は約1秒、高額は3〜5秒
   */
  collect: { base: 0.4, perDigit: 0.9, min: 1, max: 5, radius: 2.2 },

  /** 巻き戻しの演出の長さ（秒） */
  rewindSeconds: 0.8,
  /** 最初の数回の巻き戻しは痕跡を残さない（能力を安全に試せる） */
  safeRewinds: 2,

  player: {
    speed: 3.4,
    hp: 3,
    radius: 0.3,
    dodge: { seconds: 0.22, speed: 10, cooldown: 0.7 },
    shockwave: { radius: 2.6, cooldown: 3, push: 1.6, stunSeconds: 1.3, noxSlowSeconds: 1, noxSlowFactor: 0.35 },
    invulnSeconds: 1.1,
  },

  guards: {
    patrol: { speed: 1.5, chaseSpeed: 2.7, vision: 4.2, fovDeg: 80, chaseMemory: 3.5, damage: 1 },
    bouncer: { speed: 0, chaseSpeed: 2.1, guardRadius: 3.2, damage: 2 },
    /** 巻き戻しの直後・大口の回収中は、警備に怪しまれる */
    suspicionAfterRewind: 2.5,
    suspiciousPayout: 100,
    knockback: 1.3,
    contactRadius: 0.55,
  },

  /** 支配人ミスター・ノクス */
  nox: {
    /** 痕跡がこの段階に達すると現れる: 1 時計の異変 / 2 視線 / 3 足音（出現） */
    appearAt: 3,
    speed: 1.55,
    speedPerTrace: 0.1,
    maxSpeed: 2.9,
    /** 隣の部屋から入ってくるまでの時間（秒）。痕跡が多いほど短い */
    roomTravelSeconds: 7,
    roomTravelMin: 2.5,
    catchRadius: 0.55,
    /** 部屋に入ってからしばらくは、ゆっくり歩く（突然の即捕獲にしない） */
    entranceSlowSeconds: 2,
  },

  /** 痕跡（右上の時計）が増える量 */
  trace: { perRewind: 1, perBigWin: 1, perJackpot: 2 },

  /** 台の賭け金上限（部屋の種類ごとの範囲。挑戦ごとにこの中から決める） */
  limits: {
    entrance: [20, 40],
    hall: [60, 200],
    highRoller: [400, 1500],
  } as const,

  items: {
    maxEquipped: 3,
    boots: { seconds: 3, speedMul: 1.7 },
    glove: { limitMul: 2 },
    mirror: { charges: 3 },
    echo: { bonusPercent: 25 },
    receipt: { safePercent: 25 },
    contract: { payoutPercent: 150, noxSpeedMul: 1.4 },
    /** 時計工房の品数 */
    shopOffers: 3,
    repair: { price: 60 },
  },
} as const;

/** 払い出しにかかる時間（秒） */
export function collectSeconds(payout: number): number {
  if (payout <= 0) return 0;
  const c = BALANCE.collect;
  const t = c.base + c.perDigit * Math.log10(payout);
  return Math.min(c.max, Math.max(c.min, Math.round(t * 10) / 10));
}
