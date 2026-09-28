/**
 * 盤面の評価
 *
 * ボットはプレイヤーと同じ条件で判断するため、本番シードは使わず試運転と同じ種類のシードで評価する。
 * ランダムな要素（ポンコツロボ）がある盤面は複数回試して平均をとる（＝試運転を繰り返すのと同じ）。
 */
import {
  getCurrentEconomy,
  getCurrentRules,
  seeds,
  simulate,
  type RunState,
} from '@chain-factory/sim';

export interface Evaluation {
  /** 出荷量の平均 */
  score: bigint;
  /** 収入の平均 */
  income: number;
  /** 信号の最大値の平均（出荷口に届く前の「伸びしろ」の目安） */
  maxValue: bigint;
  chainCount: number;
  /**
   * 見込み: 空きマスに入って消えた信号のうち、今の手持ちと予算で置ける出荷口の数だけ
   * 大きい順に足した値（平均）。「そこに出荷口を置けば出荷できた量」の目安で、
   * 探索ボットが準備の手（散布機を置いてから出荷口を足す等）を評価するのに使う
   */
  potential: bigint;
}

/** 評価に使う試運転シードの番号（プレイヤーの試運転回数と重ならないよう大きな値から使う） */
const EVAL_TRIAL_BASE = 100_000;

export function evaluate(state: RunState, samples: number): Evaluation {
  const rules = getCurrentRules(state);
  const hasRandom = state.board.cells.some((c) => c?.id === 'junkbot');
  const dockPrice = Math.max(1, getCurrentEconomy(state).prices.dock);
  const docksAvailable = (state.inventory.dock ?? 0) + Math.floor(state.budget / dockPrice);
  const n = hasRandom ? samples : 1;

  let score = 0n;
  let maxValue = 0n;
  let income = 0;
  let chainCount = 0;
  let potential = 0n;
  for (let k = 0; k < n; k++) {
    const result = simulate({
      board: state.board,
      seed: seeds.trialSeed(state.seed, state.shiftIndex, EVAL_TRIAL_BASE + k),
      rules,
    });
    score += result.score;
    maxValue += result.stats.maxValue;
    income += result.income;
    chainCount += result.stats.chainCount;

    const values = new Map<number, bigint>();
    const lost: bigint[] = [];
    for (const e of result.events) {
      if (e.type === 'emit') values.set(e.signalId, e.value);
      else if (e.type === 'vanish' && e.reason === 'emptyCell')
        lost.push(values.get(e.signalId) ?? 0n);
    }
    lost.sort((a, b) => (a > b ? -1 : a < b ? 1 : 0));
    for (const v of lost.slice(0, docksAvailable)) potential += v;
  }
  return {
    score: score / BigInt(n),
    maxValue: maxValue / BigInt(n),
    income: income / n,
    chainCount: chainCount / n,
    potential: potential / BigInt(n),
  };
}

/**
 * 評価の比較（大きいほど良い）: 出荷量 → 収入 → 最大値 の順
 * 出荷量が同じでも、値を大きく育てている盤面を高く見る（次の一手で出荷口に届けられるため）。
 * 連鎖数は比べない（ただ遠回りするだけの配置を良いと誤解しないため）
 */
export function compareEvaluation(a: Evaluation, b: Evaluation): number {
  if (a.score !== b.score) return a.score > b.score ? 1 : -1;
  if (a.income !== b.income) return a.income - b.income;
  if (a.maxValue !== b.maxValue) return a.maxValue > b.maxValue ? 1 : -1;
  return 0;
}

/**
 * 見込み込みの比較（探索ボット用）: (出荷量 + 見込み) → 出荷量 → 収入 → 最大値
 * 散布機を置いてから出荷口を足す、といった2手以上で効く配置を途中で捨てないため
 */
export function compareOutlook(a: Evaluation, b: Evaluation): number {
  const oa = a.score + a.potential;
  const ob = b.score + b.potential;
  if (oa !== ob) return oa > ob ? 1 : -1;
  return compareEvaluation(a, b);
}
