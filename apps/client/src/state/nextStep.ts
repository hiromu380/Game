/**
 * 次にすること（操作欄に出す1行の案内。純粋関数）
 *
 * 盤面・選択・試運転の結果から、いちばん先にやるべきことを1つだけ選ぶ。
 * 文言は i18n の `next.<kind>`（長い説明はメニューの「操作方法」に置く）
 */
import type { RunState } from '@chain-factory/sim';
import type { Selection } from './gameReducer';
import type { TrialStatus } from './trialStatus';

export type NextStep =
  /** 盤面にスイッチがない（手持ちにある） */
  | { kind: 'placeSwitch' }
  /** 盤面に出荷口がない（手持ちにある） */
  | { kind: 'placeDock' }
  /** 手持ちのパーツを選んでいる: 置くマスを選ぶ */
  | { kind: 'placing' }
  /** 盤面のパーツを選んでいる: 回転・移動・戻す */
  | { kind: 'cellSelected' }
  /** まだ試運転していない・試運転のあとに組み替えた */
  | { kind: 'trial' }
  /** 試運転でノルマに届かなかった */
  | { kind: 'short'; amount: bigint }
  /** ランダムなパーツがあり、試運転では届かないこともあった */
  | { kind: 'risky' }
  /** 試運転でノルマに届いた */
  | { kind: 'ready' };

export function nextStep(
  run: RunState,
  selection: Selection,
  trial: TrialStatus,
  quota: number,
): NextStep | null {
  if (run.phase !== 'building') return null;
  if (selection?.kind === 'inventory') return { kind: 'placing' };
  if (selection?.kind === 'cell') return { kind: 'cellSelected' };
  const onBoard = (id: string) => run.board.cells.some((c) => c?.id === id);
  const inHand = (id: string) => ((run.inventory as Record<string, number>)[id] ?? 0) > 0;
  if (!onBoard('switch') && inHand('switch')) return { kind: 'placeSwitch' };
  if (!onBoard('dock') && inHand('dock')) return { kind: 'placeDock' };
  if (trial.kind !== 'fresh') return { kind: 'trial' };
  const goal = BigInt(quota);
  if (trial.max < goal) return { kind: 'short', amount: goal - trial.max };
  if (trial.min < goal) return { kind: 'risky' };
  return { kind: 'ready' };
}
