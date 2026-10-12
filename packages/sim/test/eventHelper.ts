/**
 * テスト用: 今日の出来事（2日目以降の朝）・レリック（夜をクリアした次のシフト）を選ぶ前なら、最初の候補を選ぶ
 * （イベント・レリックそのもののテストは dayEvents.test.ts・relics.test.ts。ほかのテストは進行だけを見たいので、選んでから進める）
 */
import { applyOp, chooseEvent, isEventPending, isRelicPending, type RunState } from '../src';

export function skipEvent(run: RunState): RunState {
  let state = run;
  if (isEventPending(state)) {
    const result = chooseEvent(state, 0);
    if (!result.ok) throw new Error(result.error);
    state = result.state;
  }
  if (isRelicPending(state)) {
    const result = applyOp(state, { op: 'pickRelic', index: 0 });
    if (!result.ok) throw new Error(result.error);
    state = result.state;
  }
  return state;
}
