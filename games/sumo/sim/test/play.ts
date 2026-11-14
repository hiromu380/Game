/** 自動で場所を進める（テストと計測で使う） */
import {
  acceptCandidate,
  advanceBasho,
  answerIndependence,
  answerRetirement,
  chooseSuccessor,
  chooseTakeOver,
  createGame,
  pickKakun,
  type GameState,
} from '../src';

/** 簡単な方針: 入門希望者は素質の目安3以上を受け入れ、引退の申し出は受け入れ、跡継ぎは最初の候補 */
export function autoStep(s: GameState): GameState {
  let state = s;
  if (state.pending.successor) state = chooseSuccessor(state, state.pending.successor[0]!);
  if (state.pending.takeOver) state = chooseTakeOver(state, state.pending.takeOver[0]!);
  if (state.pending.independence !== null) state = answerIndependence(state, true, []);
  if (state.pending.kakun) state = pickKakun(state, state.pending.kakun[0]!, 0);
  for (const c of state.pending.candidates) {
    if (c.scoutGrade >= 3) state = acceptCandidate(state, c.id);
  }
  for (const id of state.pending.retireRequests) state = answerRetirement(state, id, true);
  return advanceBasho(state);
}

export function play(seed: number, basho: number): GameState {
  let state = createGame({ seed });
  for (let i = 0; i < basho && !state.gameOver; i++) state = autoStep(state);
  return state;
}
