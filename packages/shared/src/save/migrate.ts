/**
 * セーブデータの作成と、古い形式からの変換
 *
 * 形式を変えたときは SAVE_VERSION を上げ、vN.ts を追加し、
 * migrateSave に「1つ前 → 新しい形式」の変換を足す（テストも必ず追加する）。
 */
import {
  BALANCE,
  buildRunConfig,
  createInitialAchievements,
  createInitialMeta,
  isAchievementId,
  seeds,
  SIM_VERSION,
  type AchievementProgress,
  type Board,
  type MetaProgress,
  type RunState,
  type ShopOffer,
} from '@chain-factory/sim';
import type { RunStateV1, SaveDataV1 } from './v1';
import type { SaveDataV2 } from './v2';
import type { SaveDataV3 } from './v3';
import type { SaveDataV4 } from './v4';
import type { SaveDataV5 } from './v5';

/** 現在のセーブデータのバージョン */
export const SAVE_VERSION = 5;

/** 最新バージョンのセーブデータ */
export type SaveData = SaveDataV5;

export function createSave(
  run: RunState | null,
  meta: MetaProgress = createInitialMeta(),
  achievements: AchievementProgress = createInitialAchievements(),
): SaveData {
  return { version: SAVE_VERSION, run, meta, achievements };
}

/**
 * 読み込んだデータを最新形式へ変換する。
 * 解釈できない場合は null（呼び出し側で新規扱いにする）。
 */
export function migrateSave(raw: unknown): SaveData | null {
  if (typeof raw !== 'object' || raw === null || !('version' in raw)) return null;
  switch ((raw as { version: unknown }).version) {
    case 1:
      return migrateSave(convertV1toV2(raw as SaveDataV1));
    case 2:
      return convertV4toV5(convertV3toV4(convertV2toV3(normalizeV2(raw as SaveDataV2))));
    case 3:
      return convertV4toV5(convertV3toV4(normalizeV3(raw as SaveDataV3)));
    case 4:
      return convertV4toV5(normalizeV3(raw as SaveDataV4));
    case 5:
      return normalizeV5(raw as SaveDataV5);
    default:
      return null;
  }
}

/**
 * v2 の中で後から増えた項目を補う（バージョンを上げるほどではない、項目の追加のみの変更）
 * - meta.records.bestShiftScore（2b: メタ進行）
 * - run.overtime / run.metaRecordedShifts / run.config.baseShiftCount / run.config.overtime（2b: 延長戦）
 */
function normalizeV2<T extends SaveDataV2 | SaveDataV3 | SaveDataV4 | SaveDataV5>(save: T): T {
  const initial = createInitialMeta();
  const meta = save.meta ?? initial;
  const run = save.run
    ? {
        ...save.run,
        overtime: save.run.overtime ?? false,
        metaRecordedShifts: save.run.metaRecordedShifts ?? 0,
        config: {
          ...save.run.config,
          baseShiftCount: save.run.config.baseShiftCount ?? save.run.config.shifts.length,
          overtime: save.run.config.overtime ?? { ...BALANCE.overtime },
          // フェーズ3で追加（保存済みのランは通常ラン扱い）
          simVersion: save.run.config.simVersion ?? SIM_VERSION,
          commitSeedMode: save.run.config.commitSeedMode ?? 'derived',
          globalModifier: save.run.config.globalModifier ?? null,
          mode: save.run.config.mode ?? 'normal',
          overtimeAllowed: save.run.config.overtimeAllowed ?? true,
        },
      }
    : null;
  return {
    ...save,
    run,
    meta: { ...initial, ...meta, records: { ...initial.records, ...meta.records } },
  };
}

/** v3 の読み込み: ラン・メタ進行は v2 と同じ補い方。実績は知らない ID・壊れた値を落とす */
function normalizeV3<T extends SaveDataV3 | SaveDataV4 | SaveDataV5>(save: T): T {
  const base = normalizeV2(save);
  const initial = createInitialAchievements();
  const raw: Partial<AchievementProgress> = save.achievements ?? {};
  return {
    ...base,
    achievements: {
      // 定義から消えた実績の ID は捨てる（Steam に送れないため）
      unlocked: Array.isArray(raw.unlocked)
        ? raw.unlocked.filter(isAchievementId)
        : initial.unlocked,
      dailyDays: Number.isInteger(raw.dailyDays) ? raw.dailyDays! : initial.dailyDays,
      lastDailyId: typeof raw.lastDailyId === 'string' ? raw.lastDailyId : initial.lastDailyId,
    },
  };
}

/** v5 の読み込み: v3 と同じ補い方 */
function normalizeV5(save: SaveDataV5): SaveDataV5 {
  return normalizeV3(save);
}

/**
 * v4 → v5（ランダム配置権）: 配置権を導入する前に始めたランは、配置権の出ないランとしてそのまま続ける
 * - RunConfig.floorPermit は足さない（無ければショップに出ない）
 * - RunState.items は空、itemFloors は null
 */
export function convertV4toV5(save: SaveDataV4): SaveDataV5 {
  const run = save.run
    ? { ...save.run, items: save.run.items ?? [], itemFloors: save.run.itemFloors ?? null }
    : null;
  return { ...save, version: 5, run };
}

/**
 * v3 → v4（床タイル）: 床を導入する前に始めたランは、床のないランとしてそのまま続ける
 * - RunConfig.stages・bonusFloors は足さない（無ければステージ・ボーナス床なし）
 * - RuleSet.floorParams は基準値を補う（床がないので結果には影響しない。文言の表示に使う）
 * - RunState.bonusFloor は null
 * 使用不可マスは RuleSet から床に移ったが、ボスの補修工事はボス計画（bossPlan）から床に重ねるので、そのまま効く
 */
export function convertV3toV4(save: SaveDataV3): SaveDataV4 {
  const run = save.run
    ? {
        ...save.run,
        bonusFloor: save.run.bonusFloor ?? null,
        config: {
          ...save.run.config,
          rules: {
            ...save.run.config.rules,
            floorParams: save.run.config.rules.floorParams ?? { ...BALANCE.floorParams },
          },
        },
      }
    : null;
  return { ...save, version: 4, run };
}

/**
 * v2 → v3: 実績は未解除から始める
 * （メタ進行の記録で満たしている実績は、起動時の判定で解除される: 累計・回数・工場拡張・全パーツ）
 */
export function convertV2toV3(save: SaveDataV2): SaveDataV3 {
  return { ...save, version: 3, achievements: createInitialAchievements() };
}

/**
 * v1 → v2
 * - ランは現在の balance/ で RunConfig を作って包む（v1 の 3シフト = 9シフト構成の1日目として続行）
 * - リロール・試運転の回数は 0、履歴の収入は 0・ボスなし
 * - メタ進行は初期値
 */
export function convertV1toV2(save: SaveDataV1): SaveDataV2 {
  return { version: 2, run: save.run ? convertRunV1(save.run) : null, meta: createInitialMeta() };
}

function convertRunV1(run: RunStateV1): RunState {
  return {
    seed: run.seed,
    config: buildRunConfig({ bossSeed: seeds.bossSeed(run.seed) }),
    shiftIndex: run.shiftIndex,
    phase: run.phase,
    budget: run.budget,
    board: run.board as Board,
    inventory: run.inventory as RunState['inventory'],
    shop: run.shop as ShopOffer[],
    rerollCount: 0,
    trialCount: 0,
    history: run.history.map((h) => ({ ...h, income: 0, boss: null })),
    overtime: false,
    metaRecordedShifts: 0,
  };
}
