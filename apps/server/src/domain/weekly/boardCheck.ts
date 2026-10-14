/**
 * 公開前の自動検証: その週の盤面を貪欲ボットに遊ばせ、全シフトをクリアできるかを見る
 *
 * - 本番シードは秘密値から作るので検証時にはわからない。代わりに、週・候補・試行番号から作った
 *   検証用の本番シードで試す（試行ごとに違う乱数を試す）
 * - 価格は相場を入れる前（基準価格）で試す（相場は週の切り替えまで決まらないため）
 * - 貪欲ボットは軽い（1ラン約 0.15 秒）ので、Workers の CPU 上限の内側で動かせる。
 *   中級・探索ボットは重いので使わない（docs/plans/weekly-challenge-plan.md）
 */
import { playRun } from '@chain-factory/bots';
import {
  createRunWithConfig,
  deriveSeed,
  hashString,
  weeklyRunSeed,
  type RunConfig,
} from '@chain-factory/sim';

/** 検証用の本番シード（試行ごと・シフトごと） */
export function verifySeed(weekId: string, candidate: number, sample: number, shift: number) {
  return deriveSeed(hashString(`verify:${weekId}:${candidate}:${sample}`), shift);
}

/** 1試行: 貪欲ボットが全シフトをクリアしたら true */
export function checkSample(
  weekId: string,
  candidate: number,
  baseConfig: RunConfig,
  sample: number,
): boolean {
  // 代替設定（fallback）はここに来ない（検証済みとして扱う）。候補番号からランシードを作る
  const start = createRunWithConfig(weeklyRunSeed(weekId, candidate), baseConfig);
  const log = playRun(sample, 'greedy', {
    unlock: 'all',
    samples: 3,
    evalMode: 'mean',
    timeLimitMs: 0,
    maxRerolls: 3,
    start,
    commitSeed: (shift) => verifySeed(weekId, candidate, sample, shift),
  });
  return log.cleared;
}
