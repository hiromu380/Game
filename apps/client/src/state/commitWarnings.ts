/**
 * 本番の確認画面に出す注意（純粋関数）
 *
 * 本番はやり直せないので、押す前に気づける形で出す。押すこと自体は止めない（出荷量 0 の本番も遊び方の一つ）。
 * - noSwitch / noDock: 盤面にスイッチ・出荷口がない（信号が出ない・出荷できない）
 * - noTrial / staleTrial: まだ試運転していない・試運転の後に配置を変えた
 * - short: 直前の試運転ではノルマに届いていない
 * - risky: ランダムに動くパーツがあり、試運転でノルマに届かなかった回がある
 */
import type { RunState } from '@chain-factory/sim';
import type { TrialStatus } from './trialStatus';

export type CommitWarning =
  | { kind: 'noSwitch' }
  | { kind: 'noDock' }
  | { kind: 'noTrial' }
  | { kind: 'staleTrial' }
  | { kind: 'short'; amount: bigint }
  | { kind: 'risky' };

export function commitWarnings(run: RunState, trial: TrialStatus, quota: number): CommitWarning[] {
  const onBoard = (id: string) => run.board.cells.some((c) => c?.id === id);
  const warnings: CommitWarning[] = [];
  if (!onBoard('switch')) warnings.push({ kind: 'noSwitch' });
  if (!onBoard('dock')) warnings.push({ kind: 'noDock' });
  // 置き忘れがあるときは、試運転の注意は重ねない（まず置くことに気づいてほしい）
  if (warnings.length > 0) return warnings;
  if (trial.kind === 'none') return [{ kind: 'noTrial' }];
  if (trial.kind === 'stale') return [{ kind: 'staleTrial' }];
  const goal = BigInt(quota);
  if (trial.max < goal) return [{ kind: 'short', amount: goal - trial.max }];
  if (trial.min < goal) return [{ kind: 'risky' }];
  return [];
}
