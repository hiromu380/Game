/**
 * はじめての人向けの案内（純粋関数）。進み具合はユーザー設定（セーブとは別）に置く
 *
 * - 手引き: 最初の場所でやること。ゲームの状態から分かるもの（受け入れた・場所を進めた）と、
 *   画面で操作したもの（稽古の方針・取組を見た・帳簿を見た）の両方で済みにする
 * - タブの案内: そのタブを初めて開いたときだけ出す
 */
import type { GameState } from '@ichimon/sim';

export type GuideStep = 'accept' | 'policy' | 'basho' | 'bout' | 'ledger';
// 入門希望者は場所を進めると来るので、受け入れるのは後のほう
export const GUIDE_STEPS: readonly GuideStep[] = ['policy', 'basho', 'bout', 'accept', 'ledger'];
export type TipTab = 'stable' | 'banzuke' | 'ledger' | 'lineage' | 'association' | 'journal';

export interface GuideProgress {
  dismissed: boolean;
  /** 画面で済ませた手順 */
  done: GuideStep[];
  /** 案内を読んだタブ */
  tips: TipTab[];
}

/** この場所数を過ぎたら手引きを出さない（慣れた人の邪魔をしない） */
export const GUIDE_UNTIL_BASHO = 12;

/** 済んだ手順（ゲームの状態から分かるものを足す） */
export function doneSteps(game: GameState, g: GuideProgress): Set<GuideStep> {
  const done = new Set<GuideStep>(g.done);
  if (game.journal.some((e) => e.kind === 'join')) done.add('accept');
  if (game.bashoIndex >= 1) done.add('basho');
  return done;
}

/** 手引きを出すか */
export function showGuide(game: GameState, g: GuideProgress): boolean {
  if (g.dismissed || game.bashoIndex >= GUIDE_UNTIL_BASHO) return false;
  return doneSteps(game, g).size < GUIDE_STEPS.length;
}

export function withStep(g: GuideProgress, step: GuideStep): GuideProgress {
  return g.done.includes(step) ? g : { ...g, done: [...g.done, step] };
}

export function withTip(g: GuideProgress, tab: TipTab): GuideProgress {
  return g.tips.includes(tab) ? g : { ...g, tips: [...g.tips, tab] };
}
