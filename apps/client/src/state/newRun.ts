/**
 * ラン開始時のシード決定・通常ランの組み立て・保存済みランの復元
 *
 * URL に ?seed=123 を付けると、そのシードで新しいランを始める
 * （「同じシード・同じ配置なら同じスコア」の確認や、不具合の再現に使う）。
 */
import {
  createInitialMeta,
  createRun,
  metaToModifiers,
  type MetaProgress,
  type PartId,
  type RunState,
} from '@chain-factory/sim';
import { EDITION_CONFIG } from '../config/edition';
import { getMarket } from '../online/market';
import { loadSave } from './saveStore';

/** URL で指定されたシード（なければ null） */
function seedFromUrl(): number | null {
  const value = new URLSearchParams(window.location.search).get('seed');
  if (value === null || !/^\d+$/.test(value)) return null;
  return Number(value) >>> 0;
}

/** 新しいランのシード。シミュレーション外なので Math.random を使ってよい */
export function createNewSeed(): number {
  return Math.floor(Math.random() * 2 ** 32) >>> 0;
}

/**
 * 通常ランを始める
 * - 製品版: メタ進行（解放済みパーツ・工場拡張）を反映する。体験版: 初期パーツ・7×7・延長戦なし
 * - 価格: オンラインで取得できていれば最新の相場（RunConfig に固定される）、なければ基準価格
 */
export function startNormalRun(
  seed: number,
  meta: MetaProgress,
  prices: Partial<Record<PartId, number>> | undefined = getMarket()?.prices,
): RunState {
  const run = createRun(seed, {
    meta: EDITION_CONFIG.metaProgression ? metaToModifiers(meta) : undefined,
    prices,
  });
  if (EDITION_CONFIG.overtime) return run;
  return { ...run, config: { ...run.config, overtimeAllowed: false } };
}

/**
 * 起動時の状態
 * - ラン: URL 指定シード > 保存済みラン > 新規
 * - メタ進行: 保存済み > 初期値
 */
export function createInitialState(): { run: RunState; meta: MetaProgress } {
  const save = loadSave();
  const meta = save?.meta ?? createInitialMeta();
  const urlSeed = seedFromUrl();
  if (urlSeed !== null) return { run: startNormalRun(urlSeed, meta), meta };
  return { run: save?.run ?? startNormalRun(createNewSeed(), meta), meta };
}
