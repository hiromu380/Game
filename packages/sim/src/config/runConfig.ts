/**
 * RunConfig: 1ランの間ずっと使う設定一式
 *
 * ラン開始時に balance.ts（＋メタ進行）から組み立てて RunState に保存する。
 * こうしておくと、
 * - balance.ts を変更しても進行中のランの挙動は変わらない（セーブの互換性）
 * - フェーズ3の相場（価格）やデイリーの条件を、ここに差し込むだけで反映できる
 */
import { BALANCE, type Balance, type BossModifierId, type ShiftSpec } from '../balance';
import { createPrng, type Prng } from '../core/prng';
import { PART_IDS, type PartId, type RuleSet } from '../types';
import { SIM_VERSION } from '../version';
import { createRuleSet } from './rules';

/** ショップ・売却・リロールの設定 */
export interface EconomyConfig {
  prices: Record<PartId, number>;
  /** ショップに並びうるパーツと出現重み（重み 0 のパーツは含めない） */
  shopPool: { partId: PartId; weight: number }[];
  offersPerShift: number;
  reroll: { baseCost: number; costStep: number; enabled: boolean };
  refundPercent: number;
}

/** 夜シフトのボス修正ルール（ラン開始時に抽選して確定する） */
export interface BossPlanEntry {
  id: BossModifierId;
  /** 床の補修工事で使用不可になるマス（index）。他のルールでは空 */
  blockedCells: number[];
}

export interface RunConfig {
  /** RunConfig 自体の形式のバージョン（セーブの変換で使う） */
  configVersion: 1;
  board: { width: number; height: number };
  /** 基本＋メタ進行のルール（ボス修正は含まない。getShiftRules で重ねる） */
  rules: RuleSet;
  economy: EconomyConfig;
  shifts: ShiftSpec[];
  shiftsPerDay: number;
  /** 本編のシフト数（延長戦でシフトが増えても変わらない。クリア判定に使う） */
  baseShiftCount: number;
  /** 延長戦の設定（balance.ts の overtime の写し） */
  overtime: Balance['overtime'];
  /** シフトごとのボス修正（通常シフトは null） */
  bossPlan: (BossPlanEntry | null)[];
  /** ボス修正ルールの効果量（balance.ts の boss の写し） */
  bossParams: Balance['boss'];
  starterKit: Partial<Record<PartId, number>>;
  /** このランを作ったシミュレーションのバージョン（デイリーの提出で照合する） */
  simVersion: string;
  /**
   * 本番シードの決め方
   * - derived: ランシードから派生させる（通常ラン。クライアントだけで遊べる）
   * - external: 外から渡す（デイリー。サーバーが秘密値から作ったシードを渡す）
   */
  commitSeedMode: 'derived' | 'external';
  /** ラン全体にかかる修正ルール（デイリーの「今日の特殊ルール」。通常ランは null） */
  globalModifier: BossPlanEntry | null;
  /**
   * ランの種類
   * - normal: 通常ラン（オフラインで完結・ランキング対象外）
   * - daily: デイリー本番（本番シードはサーバーから受け取る）
   * - practice: デイリーの練習（条件は同じ、本番シードはクライアント側）
   */
  mode: 'normal' | 'daily' | 'practice';
  /** 延長戦に進めるか（通常ランのみ） */
  overtimeAllowed: boolean;
}

/**
 * メタ進行による変更（2b で実装）。デイリーチャレンジではこの層を適用しない
 */
export interface MetaModifiers {
  /** ショップに並ぶパーツ（未指定なら全パーツ） */
  unlockedParts?: PartId[];
  /** 盤面の拡張量（7×7 → +1 で 8×8） */
  boardExpansion?: number;
}

export interface BuildRunConfigOptions {
  balance?: Balance;
  meta?: MetaModifiers;
  /** ボス計画の抽選に使うシード（seeds.ts の bossSeed） */
  bossSeed: number;
}

/** RunConfig を組み立てる（基本 → メタ進行の順に適用） */
export function buildRunConfig({
  balance = BALANCE,
  meta = {},
  bossSeed,
}: BuildRunConfigOptions): RunConfig {
  const expansion = meta.boardExpansion ?? 0;
  const board = {
    width: balance.board.width + expansion,
    height: balance.board.height + expansion,
  };
  const unlocked = new Set(meta.unlockedParts ?? PART_IDS);

  const prices = {} as Record<PartId, number>;
  const shopPool: EconomyConfig['shopPool'] = [];
  for (const id of PART_IDS) {
    const part = balance.parts[id];
    prices[id] = part.price;
    if (part.rarity === null || !unlocked.has(id)) continue;
    const weight = part.shopWeight ?? balance.rarityWeights[part.rarity];
    if (weight > 0) shopPool.push({ partId: id, weight });
  }

  return {
    configVersion: 1,
    board,
    rules: createRuleSet(balance),
    economy: {
      prices,
      shopPool,
      offersPerShift: balance.economy.offersPerShift,
      reroll: { ...balance.economy.reroll, enabled: true },
      refundPercent: balance.economy.refundPercent,
    },
    shifts: balance.shifts.map((s) => ({ ...s })),
    shiftsPerDay: balance.shiftsPerDay,
    baseShiftCount: balance.shifts.length,
    overtime: { ...balance.overtime },
    bossPlan: planBosses(balance, board, bossSeed),
    bossParams: { ...balance.boss, candidates: [...balance.boss.candidates] },
    starterKit: { ...balance.economy.starterKit },
    simVersion: SIM_VERSION,
    commitSeedMode: 'derived',
    globalModifier: null,
    mode: 'normal',
    overtimeAllowed: true,
  };
}

/** 夜シフトごとにボス修正ルールを抽選する（同じ夜が続けて同じルールにならないようにする） */
function planBosses(
  balance: Balance,
  board: { width: number; height: number },
  seed: number,
): (BossPlanEntry | null)[] {
  const rng = createPrng(seed);
  let previous: BossModifierId | null = null;

  return balance.shifts.map((shift) => {
    if (shift.kind !== 'boss') return null;
    const entry = drawBoss(rng, balance.boss, board, previous);
    previous = entry?.id ?? previous;
    return entry;
  });
}

/**
 * ボス修正ルールを1つ抽選する（直前の夜と同じルールは避ける）。
 * 延長戦でシフトを追加するときにも使う
 */
export function drawBoss(
  rng: Prng,
  params: Balance['boss'],
  board: { width: number; height: number },
  previous: BossModifierId | null,
): BossPlanEntry | null {
  const candidates = params.candidates;
  if (candidates.length === 0) return null;
  const pool = candidates.length > 1 ? candidates.filter((c) => c !== previous) : candidates;
  const id = pool[rng.nextInt(pool.length)]!;

  const blockedCells: number[] = [];
  if (id === 'repairWork') {
    const cellCount = board.width * board.height;
    const count = Math.min(params.repairWorkCells, cellCount);
    while (blockedCells.length < count) {
      const cell = rng.nextInt(cellCount);
      if (!blockedCells.includes(cell)) blockedCells.push(cell);
    }
    blockedCells.sort((a, b) => a - b);
  }
  return { id, blockedCells };
}
