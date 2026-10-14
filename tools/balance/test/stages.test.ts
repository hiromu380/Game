/**
 * 日ごとのステージ: すべてのテンプレートで、ボットがクリアできる配置を見つけられる（合成テスト）
 *
 * 1シフトだけのランを、テンプレートを1日目のステージにして作り、中級ボットに1日目の朝のノルマを狙わせる。
 * 使用不可で盤面が使えなくなっていないか（スイッチから出荷口まで結べるか）を見る。
 * 1シフトの結果は乱数（ポンコツロボ・品ぞろえ）で揺れるので、シード 1〜5 のどれかでクリアできればよい。
 */
import { BALANCE, commitShift, createPrng, createRun, type Balance } from '@chain-factory/sim';
import { describe, expect, it } from 'vitest';
import { BOTS } from '@chain-factory/bots';

const QUOTA = BALANCE.shifts[0]!.quota;

function clearsOn(templateId: string, seed: number): boolean {
  const balance: Balance = {
    ...BALANCE,
    shifts: [{ quota: QUOTA, budget: 30, clearReward: 0, kind: 'normal' }],
    stages: { ...BALANCE.stages, dayBands: [[templateId]] },
    // ボーナス床は湧かせない（テンプレートだけの形を見る）
    bonusFloors: { ...BALANCE.bonusFloors, countWeights: [1] },
  };
  const run = createRun(seed, { balance, meta: {} });
  const plan = BOTS.mid.playShift(run, {
    samples: 2,
    evalMode: 'mean',
    timeLimitMs: 500,
    maxRerolls: 3,
    rng: createPrng(seed),
  });
  const committed = commitShift(plan.state);
  if ('error' in committed) throw new Error(committed.error);
  return committed.outcome.cleared;
}

describe('ステージのテンプレート', () => {
  it.each(Object.keys(BALANCE.stages.templates))(
    '%s: ボットがクリアできる配置を見つけられる',
    (id) => {
      expect([1, 2, 3, 4, 5].some((seed) => clearsOn(id, seed))).toBe(true);
    },
  );
});
