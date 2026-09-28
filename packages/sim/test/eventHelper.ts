/**
 * テスト用: 今日の出来事（2日目以降の朝）を選ぶ前なら、最初の候補を選ぶ
 * （イベントそのもののテストは dayEvents.test.ts。ほかのテストは進行だけを見たいので、選んでから進める）
 */
import { chooseEvent, isEventPending, type RunState } from '../src';

export function skipEvent(run: RunState): RunState {
  if (!isEventPending(run)) return run;
  const result = chooseEvent(run, 0);
  if (!result.ok) throw new Error(result.error);
  return result.state;
}
