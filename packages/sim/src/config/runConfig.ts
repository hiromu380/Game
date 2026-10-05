/**
 * RunConfig: 1ランの間ずっと使う設定一式
 *
 * ラン開始時に balance/（＋メタ進行）から組み立てて RunState に保存する。
 * こうしておくと、
 * - balance/ を変更しても進行中のランの挙動は変わらない（セーブの互換性）
 * - フェーズ3の相場（価格）やデイリーの条件を、ここに差し込むだけで反映できる
 */
import {
  BALANCE,
  type Balance,
  type BossModifierId,
  type ShiftSpec,
  type StageBalance,
} from '../balance';
import { createPrng, type Prng } from '../core/prng';
import { generateStage, templateToFloor } from '../floor/stage';
import type { FloorLayer } from '../floor/types';
import { stageSeed } from '../run/seeds';
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

/** 日ごとのステージ（床の配置） */
export interface RunStages {
  /** 日ごとの床（index = 日。延長戦の日は、延長戦に入ったときに足す） */
  days: FloorLayer[];
  /** 延長戦の日を生成する設定（balance/ の stages の写し） */
  balance: StageBalance;
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
  /**
   * 2日目以降の朝に盤面のパーツをすべて手持ちに戻すか（balance/ の写し）。
   * これを導入する前に始めたラン（セーブ）には無いので、無ければ戻さない
   */
  resetBoardEachDay?: boolean;
  /**
   * 日ごとのイベント（balance/ の写しと、試供品で出るパーツの一覧）。
   * 導入前に始めたラン（セーブ）には無いので、無ければイベントは起きない
   */
  dayEvents?: Balance['dayEvents'] & { samplePool: PartId[] };
  /** 本編のシフト数（延長戦でシフトが増えても変わらない。クリア判定に使う） */
  baseShiftCount: number;
  /** 延長戦の設定（balance/ の overtime の写し） */
  overtime: Balance['overtime'];
  /**
   * 日ごとのステージ（床の配置）。
   * 床を導入する前に始めたラン（セーブ）には無いので、無ければ床なし
   */
  stages?: RunStages;
  /**
   * シフト開始時のボーナス床（balance/ の写し）。fromShift より前のシフトには湧かない（初回ガイドの1日目）。
   * 床を導入する前に始めたラン（セーブ）には無いので、無ければ湧かない
   */
  bonusFloors?: Balance['bonusFloors'] & { fromShift: number };
  /**
   * ランダム配置権（balance/ の写し）。fromShift より前のシフトのショップには出ない（初回ガイドの1日目）。
   * 導入前に始めたランには無いので、無ければショップに出ない
   */
  floorPermit?: Balance['floorPermit'] & { fromShift: number };
  /** シフトごとのボス修正（通常シフトは null） */
  bossPlan: (BossPlanEntry | null)[];
  /** ボス修正ルールの効果量（balance/ の boss の写し） */
  bossParams: Balance['boss'];
  starterKit: Partial<Record<PartId, number>>;
  /** このランを作ったシミュレーションのバージョン（デイリーの提出で照合する） */
  simVersion: string;
  /**
   * 本番シードの決め方
   * - derived: ランシードから派生させる（通常ラン。クライアントだけで遊べる）
   * - external: 外から渡す（週替わり。サーバーが秘密値から作ったシードを渡す）
   */
  commitSeedMode: 'derived' | 'external';
  /** ラン全体にかかる修正ルール（週替わりの「今週の特殊ルール」。通常ランは null） */
  globalModifier: BossPlanEntry | null;
  /**
   * ランの種類
   * - normal: 通常ラン（オフラインで完結・ランキング対象外）
   * - weekly: 週替わりチャレンジの本番（本番シードはサーバーから受け取る）
   * - practice: 週替わりの練習（条件は同じ、本番シードはクライアント側）
   */
  mode: 'normal' | 'weekly' | 'practice';
  /** 延長戦に進めるか（通常ランのみ） */
  overtimeAllowed: boolean;
}

/**
 * メタ進行による変更（2b で実装）。週替わりチャレンジではこの層を適用しない
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
  /** ランシード（日ごとのステージの抽選に使う。省略時はステージ・ボーナス床なし＝床なし） */
  runSeed?: number;
  /** 1日目のステージを初回ガイド用の固定テンプレートにする */
  tutorial?: boolean;
  /** 日ごとのステージを抽選する帯（省略時は balance の dayBands。週替わりは weeklyBand） */
  stageBands?: string[][];
}

/** RunConfig を組み立てる（基本 → メタ進行の順に適用） */
export function buildRunConfig({
  balance = BALANCE,
  meta = {},
  bossSeed,
  runSeed,
  tutorial = false,
  stageBands = balance.stages.dayBands,
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

  const dayCount = Math.ceil(balance.shifts.length / balance.shiftsPerDay);
  const stages: RunStages | undefined =
    runSeed === undefined
      ? undefined
      : {
          days: Array.from({ length: dayCount }, (_, day) =>
            tutorial && day === 0
              ? templateToFloor(balance.stages.templates[balance.stages.tutorialTemplate]!, board)
              : generateStage({
                  seed: stageSeed(runSeed, day),
                  band: stageBands[Math.min(day, stageBands.length - 1)] ?? [],
                  board,
                  stages: balance.stages,
                }),
          ),
          balance: balance.stages,
        };

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
    resetBoardEachDay: balance.resetBoardEachDay,
    dayEvents: {
      ...balance.dayEvents,
      candidates: [...balance.dayEvents.candidates],
      sampleRarities: [...balance.dayEvents.sampleRarities],
      // 試供品は、このランのショップに並びうるパーツのうち、指定したレア度のもの
      samplePool: shopPool
        .map((p) => p.partId)
        .filter((id) => {
          const rarity = balance.parts[id].rarity;
          return rarity !== null && balance.dayEvents.sampleRarities.includes(rarity);
        }),
    },
    baseShiftCount: balance.shifts.length,
    overtime: { ...balance.overtime },
    stages,
    // ランシードがない（床を使わない）組み立てでは、ボーナス床も湧かせない
    bonusFloors:
      runSeed === undefined
        ? undefined
        : {
            countWeights: [...balance.bonusFloors.countWeights],
            tileWeights: balance.bonusFloors.tileWeights.map((w) => ({ ...w })),
            fromShift: tutorial ? balance.shiftsPerDay : 0,
          },
    // ランシードがない（床を使わない）組み立てでは、配置権も出さない
    floorPermit:
      runSeed === undefined
        ? undefined
        : {
            ...balance.floorPermit,
            tileWeights: balance.floorPermit.tileWeights.map((w) => ({ ...w })),
            fromShift: tutorial ? balance.shiftsPerDay : 0,
          },
    bossPlan: planBosses(balance, board, bossSeed, stages?.days ?? []),
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
  stageDays: FloorLayer[],
): (BossPlanEntry | null)[] {
  const rng = createPrng(seed);
  let previous: BossModifierId | null = null;

  return balance.shifts.map((shift, index) => {
    if (shift.kind !== 'boss') return null;
    const stage = stageDays[Math.floor(index / balance.shiftsPerDay)];
    const entry = drawBoss(rng, balance.boss, board, previous, stage);
    previous = entry?.id ?? previous;
    return entry;
  });
}

/**
 * ボス修正ルールを1つ抽選する（直前の夜と同じルールは避ける）。
 * 延長戦でシフトを追加するときにも使う。
 * 床の補修工事の使用不可マスは、その日のステージの床がないマスから選ぶ
 */
export function drawBoss(
  rng: Prng,
  params: Balance['boss'],
  board: { width: number; height: number },
  previous: BossModifierId | null,
  stage?: FloorLayer,
): BossPlanEntry | null {
  const candidates = params.candidates;
  if (candidates.length === 0) return null;
  const pool = candidates.length > 1 ? candidates.filter((c) => c !== previous) : candidates;
  const id = pool[rng.nextInt(pool.length)]!;

  const blockedCells: number[] = [];
  if (id === 'repairWork') {
    // 候補から1つずつ抜き出す（候補が足りなければ、ある分だけ。無制限に引き直さない）
    const candidates: number[] = [];
    for (let i = 0; i < board.width * board.height; i++) if (!stage?.[i]) candidates.push(i);
    const count = Math.min(params.repairWorkCells, candidates.length);
    while (blockedCells.length < count) {
      blockedCells.push(candidates.splice(rng.nextInt(candidates.length), 1)[0]!);
    }
    blockedCells.sort((a, b) => a - b);
  }
  return { id, blockedCells };
}
