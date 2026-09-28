/**
 * ラン開始時のシード決定・通常ランの組み立て・保存済みランの復元
 *
 * URL に ?seed=123 を付けると、そのシードで新しいランを始める
 * （「同じシード・同じ配置なら同じスコア」の確認や、不具合の再現に使う）。
 */
import {
  createInitialAchievements,
  createInitialMeta,
  createRun,
  metaToModifiers,
  type AchievementProgress,
  type MetaProgress,
  type PartId,
  type RunState,
} from '@chain-factory/sim';
import { EDITION_CONFIG } from '../config/edition';
import { getMarket } from '../online/market';
import { achievementsOnLoad } from './achievements';
import { loadRun, loadSave } from './saveStore';
import { TUTORIAL_CONFIG } from '../config/tutorial';
import { loadSettings } from '../settings/settingsStore';

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
 * 新しい通常ランを始める。初回ガイドがまだなら、ガイド用のラン（決まったシード・初期パーツ・7×7。
 * config/tutorial.ts）にする。メタ進行の記録はガイドのランでもふだんどおり残る
 */
export function startNewNormalRun(meta: MetaProgress): RunState {
  return loadSettings().tutorialDone
    ? startNormalRun(createNewSeed(), meta)
    : startNormalRun(TUTORIAL_CONFIG.seed, createInitialMeta());
}

/** ガイド用のランか（シードと、ランの最初の条件で見分ける） */
export function isTutorialRun(run: RunState): boolean {
  return run.seed === TUTORIAL_CONFIG.seed && !run.overtime;
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
  // 体験版は「メタ進行が初期状態のまま」として扱う（メタ進行を渡さないと全パーツ解放になるため、初期値を渡す）
  const progress = EDITION_CONFIG.metaProgression ? meta : createInitialMeta();
  const run = createRun(seed, { meta: metaToModifiers(progress), prices });
  if (EDITION_CONFIG.overtime) return run;
  return { ...run, config: { ...run.config, overtimeAllowed: false } };
}

/**
 * 起動時の状態
 * - ラン: URL 指定シード > 保存済みラン > 新規
 * - メタ進行・実績: 保存済み > 初期値（実績はメタ進行の記録で満たしているものをここで解除する）
 */
export function createInitialState(): {
  run: RunState;
  meta: MetaProgress;
  achievements: AchievementProgress;
} {
  const save = loadSave();
  const meta = save?.meta ?? createInitialMeta();
  const achievements = achievementsOnLoad(save?.achievements ?? createInitialAchievements(), meta);
  const urlSeed = seedFromUrl();
  if (urlSeed !== null) return { run: startNormalRun(urlSeed, meta), meta, achievements };
  return { run: loadRun() ?? startNewNormalRun(meta), meta, achievements };
}
