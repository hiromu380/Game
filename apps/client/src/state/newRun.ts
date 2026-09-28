/**
 * ラン開始時のシード決定と、保存済みランの復元
 *
 * URL に ?seed=123 を付けると、そのシードで新しいランを始める
 * （「同じシード・同じ配置なら同じスコア」の確認や、不具合の再現に使う）。
 */
import {
  createInitialMeta,
  createRun,
  metaToModifiers,
  type MetaProgress,
  type RunState,
} from '@chain-factory/sim';
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
 * 起動時の状態
 * - ラン: URL 指定シード > 保存済みラン > 新規
 * - メタ進行: 保存済み > 初期値
 */
export function createInitialState(): { run: RunState; meta: MetaProgress } {
  const save = loadSave();
  const meta = save?.meta ?? createInitialMeta();
  const modifiers = { meta: metaToModifiers(meta) };
  const urlSeed = seedFromUrl();
  if (urlSeed !== null) return { run: createRun(urlSeed, modifiers), meta };
  return { run: save?.run ?? createRun(createNewSeed(), modifiers), meta };
}
