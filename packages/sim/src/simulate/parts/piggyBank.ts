/**
 * 貯金箱（経済系）: 信号をそのまま自身の向きへ送り、次シフトの予算を piggyBankIncome 増やす
 *
 * 1回のシミュレーションで生める予算には上限がある（rules.maxIncomePerSim。simulate.ts で制限）。
 * 本番で生んだ分だけが次シフトに加算される（試運転の分は加算されない）。
 */
import { dir4ToDir8 } from '../../core/direction';
import type { PartBehavior } from './types';

export const piggyBankBehavior: PartBehavior = {
  react: ({ part, value, rules }) => ({
    emits: [{ dir: dir4ToDir8(part.dir), value }],
    income: rules.params.piggyBankIncome,
  }),
};
