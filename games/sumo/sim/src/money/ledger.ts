/**
 * 自分の部屋の会計（場所ごと）。金額は balance/money.ts（実際の値と推定）
 */
import { OYAKATA_PAY, STABLE_COSTS, STABLE_SUBSIDY, SUPPORTERS } from '../balance/money';
import { isSanyaku, isSekitori } from '../banzuke/rank';
import { KAKUN } from '../lineage/kakun';
import type { FacilityId, KakunId, MoneyLine, Rank } from '../model/types';
import { facilityUpkeep, NO_FACILITIES } from './facilities';

export interface Ledger {
  income: MoneyLine[];
  expenses: MoneyLine[];
  /** 親方個人の収支 */
  personal: MoneyLine[];
}

/** ranks: 部屋の力士の地位（番付に載っていない新弟子は null） */
export function settleBasho(
  ranks: readonly (Rank | null)[],
  prestige: number,
  kakun: readonly KakunId[],
  facilities: Record<FacilityId, number> = NO_FACILITIES,
  /** ちゃんこの方針による食費の倍率 */
  foodMultiplier = 1,
  /** 親方の月給（協会の役職で変わる） */
  oyakataMonthly: number = OYAKATA_PAY.monthly,
): Ledger {
  const n = ranks.length;
  const lower = ranks.filter((r) => r === null || !isSekitori(r)).length;
  const sekitori = ranks.filter((r): r is Rank => r !== null && isSekitori(r));
  const sanyaku = sekitori.filter(isSanyaku).length;
  const bonus = sekitori.reduce((sum, r) => {
    const y = STABLE_SUBSIDY.sekitoriBonusYearly;
    const yearly =
      r.title === 'Y'
        ? y.Y
        : r.title === 'O'
          ? y.O
          : r.title === 'S' || r.title === 'K'
            ? y.sanyaku
            : r.title === 'M'
              ? y.M
              : y.juryo;
    return sum + Math.round(yearly / 6);
  }, 0);
  const income: MoneyLine[] = [
    { key: 'trainee', amount: lower * STABLE_SUBSIDY.traineePerBasho },
    { key: 'upkeep', amount: n * STABLE_SUBSIDY.upkeepPerBasho },
    { key: 'dojo', amount: n * STABLE_SUBSIDY.dojoPerBasho },
    { key: 'sekitoriBonus', amount: bonus },
    {
      key: 'supporters',
      amount: Math.round(
        SUPPORTERS.base +
          sekitori.length * SUPPORTERS.perSekitori +
          sanyaku * SUPPORTERS.perSanyaku +
          prestige * SUPPORTERS.perPrestige,
      ),
    },
  ];
  const food =
    n *
    STABLE_COSTS.foodPerRikishi *
    foodMultiplier *
    (kakun.includes('chanko') ? KAKUN.chankoFoodCost : 1);
  const fixed = STABLE_COSTS.fixedPerBasho * (kakun.includes('thrift') ? KAKUN.thriftFixed : 1);
  const expenses: MoneyLine[] = [
    { key: 'food', amount: Math.round(food) },
    { key: 'fixed', amount: Math.round(fixed) },
    { key: 'staff', amount: STABLE_COSTS.staffPerBasho },
    { key: 'misc', amount: n * STABLE_COSTS.miscPerRikishi },
    { key: 'sekitoriCosts', amount: sekitori.length * STABLE_COSTS.perSekitori },
    { key: 'facilities', amount: facilityUpkeep(facilities) },
  ];
  const personal: MoneyLine[] = [
    { key: 'oyakataSalary', amount: oyakataMonthly * 2 },
    { key: 'living', amount: -OYAKATA_PAY.livingPerBasho },
  ];
  return { income, expenses, personal };
}

export const sum = (lines: readonly MoneyLine[]) => lines.reduce((n, l) => n + l.amount, 0);
