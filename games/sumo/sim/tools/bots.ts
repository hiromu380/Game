/**
 * 自動で遊ぶ親方（バランス計測とテストで使う）
 *
 * - careful: 素質の見立てが3以上の入門希望者だけ受け入れる。疲れたら休ませ、軽い弟子は体づくり、ほかは親方の型。
 *   お金に余裕があれば稽古場・寮・トレーナー・スカウトに使う。けがは休ませる
 * - passive: 入門希望者はみな受け入れ（部屋に入るだけ）、稽古の方針は変えない。設備も使わない
 */
import {
  acceptCandidate,
  answerIndependence,
  answerRetirement,
  buildFacility,
  chooseSuccessor,
  chooseTakeOver,
  nextBuildCost,
  pickKakun,
  setContract,
  setPolicy,
  stableCapacity,
  type GameState,
} from '../src';

export type BotKind = 'careful' | 'passive';

function decide(s: GameState, kind: BotKind): GameState {
  let state = s;
  if (state.pending.successor) {
    // 一番若い部屋付きの親方に継がせる（長く続くように）
    const youngest = [...state.pending.successor].sort(
      (a, b) =>
        state.oyakata.find((o) => o.id === a)!.age - state.oyakata.find((o) => o.id === b)!.age,
    )[0]!;
    state = chooseSuccessor(state, youngest);
  }
  if (state.pending.takeOver) state = chooseTakeOver(state, state.pending.takeOver[0]!);
  if (state.pending.kakun) state = pickKakun(state, state.pending.kakun[0]!, 0);
  if (state.pending.independence !== null)
    state = answerIndependence(state, kind === 'careful', []);
  for (const id of state.pending.retireRequests) state = answerRetirement(state, id, true);
  for (const c of state.pending.candidates) {
    if (kind === 'passive' || c.scoutGrade >= 3) state = acceptCandidate(state, c.id);
  }
  if (kind === 'careful') {
    const master = state.oyakata.find((o) => o.id === state.player.oyakataId)!;
    for (const r of state.rikishi.filter((x) => x.stableId === state.player.stableId)) {
      const policy = r.fatigue >= 55 ? 'rest' : r.weight < 120 ? 'body' : master.style;
      if (r.policy !== policy) state = setPolicy(state, r.id, policy);
    }
    // 余裕があれば設備（口座の半分以下で払えるもの）
    for (const id of ['dojo', 'dorm'] as const) {
      const cost = nextBuildCost(state.player.facilities, id);
      if (cost !== null && state.player.stableMoney > cost * 2) state = buildFacility(state, id);
    }
    const mine = state.rikishi.filter((r) => r.stableId === state.player.stableId).length;
    const rich = state.player.stableMoney > 30_000_000;
    state = setContract(state, 'trainer', rich ? 1 : 0);
    state = setContract(state, 'scout', rich && mine < stableCapacity(state) ? 1 : 0);
  }
  return state;
}

export { decide };
