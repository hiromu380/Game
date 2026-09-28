/**
 * セーブデータの作成と、古い形式からの変換
 *
 * 形式を変えたときは SAVE_VERSION を上げ、vN.ts を追加し、
 * migrateSave に「1つ前 → 新しい形式」の変換を足す（テストも必ず追加する）。
 */
import {
  buildRunConfig,
  createInitialMeta,
  seeds,
  type Board,
  type MetaProgress,
  type RunState,
  type ShopOffer,
} from '@chain-factory/sim';
import type { RunStateV1, SaveDataV1 } from './v1';
import type { SaveDataV2 } from './v2';

/** 現在のセーブデータのバージョン */
export const SAVE_VERSION = 2;

/** 最新バージョンのセーブデータ */
export type SaveData = SaveDataV2;

export function createSave(
  run: RunState | null,
  meta: MetaProgress = createInitialMeta(),
): SaveData {
  return { version: SAVE_VERSION, run, meta };
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
      return normalizeV2(raw as SaveDataV2);
    default:
      return null;
  }
}

/**
 * v2 の中で後から増えた項目を補う（バージョンを上げるほどではない、項目の追加のみの変更）
 * - meta.records.bestShiftScore（2b で追加）
 */
function normalizeV2(save: SaveDataV2): SaveDataV2 {
  const initial = createInitialMeta();
  const meta = save.meta ?? initial;
  return {
    ...save,
    meta: { ...initial, ...meta, records: { ...initial.records, ...meta.records } },
  };
}

/**
 * v1 → v2
 * - ランは現在の balance.ts で RunConfig を作って包む（v1 の 3シフト = 9シフト構成の1日目として続行）
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
  };
}
