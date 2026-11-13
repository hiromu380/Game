/**
 * 収支の見込み: 今の部屋のまま次の場所を終えたら、お金がどう動くか（純粋関数。状態は変えない）
 * 場所の精算（settleBasho）と同じ式に、今の番付・後援会の会員・タニマチの関係・千秋楽パーティー・設備と契約・ちゃんこを入れる。
 * 場所の成績で動く分（会員の増減・タニマチの関係・昇進）は入れない目安
 */
import { KOENKAI } from '../balance/koenkai';
import { OFFICE } from '../balance/office';
import { DIETS } from '../balance/staff';
import { ranksOf } from '../banzuke/rank';
import type { GameState, Rank } from '../model/types';
import { giftOf } from '../stable/koenkai';
import { settleBasho, sum, type Ledger } from './ledger';

export interface Projection extends Ledger {
  /** 部屋の口座の動き（収入 − 支出） */
  stableNet: number;
  /** 親方個人の動き（給与 − 生活費） */
  personalNet: number;
  /**
   * このままだと、部屋の口座と親方の貯金を合わせたお金が尽きるまでの場所の数。減っていかなければ null
   */
  runway: number | null;
}

/** override: 地位を差し替える弟子（「十両に上がったら」の見積もり） */
export function projectLedger(
  state: GameState,
  override: ReadonlyMap<number, Rank> = new Map(),
): Projection {
  const ranks = ranksOf(state.banzuke, state.titles);
  const mine = state.rikishi
    .filter((r) => r.stableId === state.player.stableId)
    .map((r) => override.get(r.id) ?? ranks.get(r.id) ?? null);
  const k = state.player.koenkai;
  const ledger = settleBasho(
    mine,
    state.player.prestige,
    state.player.kakun,
    state.player.facilities,
    DIETS[state.player.diet].food,
    OFFICE.monthly[state.player.office.rank],
    {
      dues: Math.round(
        (k.members * KOENKAI.memberDuesPerYear + k.corporate * KOENKAI.corporateDuesPerYear) / 6,
      ),
      patrons: k.patrons.reduce((n, p) => n + giftOf(p), 0),
      party: KOENKAI.party[k.party].cost,
    },
  );
  const stableNet = sum(ledger.income) - sum(ledger.expenses);
  const personalNet = sum(ledger.personal);
  const change = stableNet + personalNet;
  const total = state.player.stableMoney + state.player.personalMoney;
  return {
    ...ledger,
    stableNet,
    personalNet,
    runway: change >= 0 ? null : Math.max(0, Math.floor(total / -change)),
  };
}

/**
 * 弟子1人が十両（関取）に上がったら、部屋の口座の動きが1場所あたりいくら変わるか。
 * 養成奨励金・養成費・関取の費用に加え、関取で増える後援会の会員と法人会員（目安に近づいた後）の会費を入れる
 */
export function sekitoriGain(state: GameState, id: number): number {
  const base = projectLedger(state).stableNet;
  const juryo: Rank = { division: 'juryo', title: null, number: 14, side: 'W' };
  const supporters = Math.round(
    (KOENKAI.memberPerSekitori * KOENKAI.memberDuesPerYear +
      KOENKAI.corporatePerSekitori * KOENKAI.corporateDuesPerYear) /
      6,
  );
  return projectLedger(state, new Map([[id, juryo]])).stableNet - base + supporters;
}
