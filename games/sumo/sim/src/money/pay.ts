/**
 * 親方の行動で払うお金（スカウト回り・胸を借りる・出稽古・建物）: 部屋の口座から払い、足りない分は親方の貯金から出す。
 * 口座が空でも、貯金があれば部屋のために使える（親方が私財を部屋へ入れる。場所の精算で口座のマイナスを貯金で埋めるのと同じ向き）
 */
import type { GameState } from '../model/types';

/** 部屋の口座と親方の貯金を合わせて払えるか */
export function canAfford(state: Pick<GameState, 'player'>, yen: number): boolean {
  return Math.max(0, state.player.stableMoney) + Math.max(0, state.player.personalMoney) >= yen;
}

/** そのうち親方の貯金から出る額（口座で足りれば 0） */
export function fromSavings(state: Pick<GameState, 'player'>, yen: number): number {
  return Math.max(0, yen - Math.max(0, state.player.stableMoney));
}

/** 払う（state を直接変える）。口座から、足りない分は貯金から。払えなければ何もしないで false */
export function pay(state: GameState, yen: number): boolean {
  if (!canAfford(state, yen)) return false;
  const savings = fromSavings(state, yen);
  state.player.stableMoney -= yen - savings;
  state.player.personalMoney -= savings;
  return true;
}
