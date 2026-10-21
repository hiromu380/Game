/**
 * ラン失敗のとき「どれだけ惜しかったか」と、次に試すことのひとこと（純粋関数）
 *
 * 最後のシフト（ノルマに届かなかったシフト）の記録だけを見て決める。
 * ヒントは当てはまるものの中で優先度の高い1つ（文言は i18n の `nearMiss.hint.<key>`）。
 * 優先度: 出荷ゼロ → 予算の使い残し → 夜の特殊ルール → 少し足りない → 出荷口が1つだけ → 倍率不足
 */
import { scoreFromString, type RunState } from '@chain-factory/sim';

export type NearMissHint = 'noShip' | 'unspent' | 'boss' | 'multiply' | 'sync' | 'close';

export interface NearMiss {
  /** ノルマまであと（出荷量の不足分） */
  gap: bigint;
  /** ノルマの何%まで届いたか（0〜99。切り捨て） */
  percent: number;
  hint: NearMissHint;
  /** 残っていた予算（unspent のヒントに使う） */
  budgetLeft: number;
}

/** この予算が残っていたら「使い切ろう」と伝える */
export const UNSPENT_BUDGET = 5;
/** ノルマのこの%以上届いていたら「あと少し」 */
const CLOSE_PERCENT = 40;

function docksOnBoard(run: RunState): number {
  return run.board.cells.filter((c) => c?.id === 'dock').length;
}

export function getNearMiss(run: RunState): NearMiss | null {
  if (run.phase !== 'failed') return null;
  const last = run.history.at(-1);
  if (!last || last.cleared) return null;
  const score = scoreFromString(last.score) as bigint;
  const quota = BigInt(last.quota);
  const gap = quota > score ? quota - score : 0n;
  const percent = quota > 0n ? Math.min(99, Number((score * 100n) / quota)) : 0;
  const hint: NearMissHint =
    score === 0n
      ? 'noShip'
      : run.budget >= UNSPENT_BUDGET
        ? 'unspent'
        : last.boss !== null
          ? 'boss'
          : percent >= CLOSE_PERCENT
            ? 'close'
            : // 出荷口が1つだけ: 同時出荷（口の数だけ倍）を知ってもらう
              docksOnBoard(run) === 1
              ? 'sync'
              : 'multiply';
  return { gap, percent, hint, budgetLeft: run.budget };
}
