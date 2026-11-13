/**
 * 本番の前の確認: このまま押すと失敗しそうな理由（画面に依存しない純粋な関数。表示は ui/CommitConfirm.tsx）
 *
 * 本番はやり直せず、ノルマに届かなければランが終わる。うっかり押して終わらないよう、
 * 盤面と直前の試運転から分かる「危ない理由」を確認の画面に出す。ゲームのルールは変えない（押せば本番は走る）。
 */
import {
  getCurrentShift,
  scoreCompare,
  scoreFromString,
  scoreOf,
  type Board,
  type RunState,
} from '@chain-factory/sim';

/** 直前の試運転（その盤面・シフトで出た出荷量） */
export interface TrialRecord {
  board: Board;
  shiftIndex: number;
  /** 出荷量（数字の文字列） */
  score: string;
}

export type CommitWarning =
  /** 盤面にスイッチがない（信号が出ないので出荷量は 0） */
  | { kind: 'noSwitch' }
  /** 盤面に出荷口がない（出荷量は 0） */
  | { kind: 'noDock' }
  /** 今の並びではまだ試運転していない */
  | { kind: 'untested' }
  /** 直前の試運転がノルマに届いていない */
  | { kind: 'short'; score: string; quota: number };

export function commitWarnings(run: RunState, lastTrial: TrialRecord | null): CommitWarning[] {
  const cells = run.board.cells;
  const hasSwitch = cells.some((c) => c?.id === 'switch');
  const hasDock = cells.some((c) => c?.id === 'dock');
  // 置いていないものがあれば、試運転するまでもなく 0 なので、それだけを伝える
  if (!hasSwitch || !hasDock) {
    return [
      ...(hasSwitch ? [] : [{ kind: 'noSwitch' as const }]),
      ...(hasDock ? [] : [{ kind: 'noDock' as const }]),
    ];
  }
  // 盤面は作り直すたびに新しいオブジェクトになるので、同じオブジェクトなら同じ並び
  const tested =
    lastTrial && lastTrial.board === run.board && lastTrial.shiftIndex === run.shiftIndex;
  if (!tested) return [{ kind: 'untested' }];
  const quota = getCurrentShift(run).quota;
  if (scoreCompare(scoreFromString(lastTrial.score), scoreOf(quota)) < 0) {
    return [{ kind: 'short', score: lastTrial.score, quota }];
  }
  return [];
}
