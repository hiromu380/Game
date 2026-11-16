/**
 * 横綱審議委員会の稽古総見（純粋関数。乱数を使わない）: 東京場所の前に、平幕中位以上の自分の弟子が出る。
 * 横綱・大関と胸を合わせて少し伸び、疲れる
 */
import { SOKEN } from '../balance/ceremony2';
import { ranksOf } from '../banzuke/rank';
import { clamp, round1 } from '../core/math';
import type { BashoReport, GameState, Style } from '../model/types';

/** この場所の前の稽古総見に出る自分の弟子（東京場所でなければ空） */
export function sokenAttendees(
  state: Pick<GameState, 'bashoIndex' | 'banzuke' | 'titles' | 'rikishi' | 'player'>,
): number[] {
  if (!(SOKEN.months as readonly number[]).includes(state.bashoIndex % 6)) return [];
  const ranks = ranksOf(state.banzuke, state.titles);
  return state.banzuke.filter((id) => {
    const k = ranks.get(id);
    const r = state.rikishi.find((x) => x.id === id);
    if (!k || !r || r.stableId !== state.player.stableId || r.injury > 0) return false;
    if (k.division !== 'makuuchi') return false;
    return k.title !== 'M' || k.number <= SOKEN.maegashiraWithin;
  });
}

/** 稽古総見を行う（場所の前の片付けで） */
export function holdSoken(state: GameState, report: BashoReport): void {
  const ids = sokenAttendees(state);
  if (ids.length === 0) return;
  for (const id of ids) {
    const r = state.rikishi.find((x) => x.id === id)!;
    const key: Style =
      r.policy === 'oshi' || r.policy === 'yotsu' || r.policy === 'waza' ? r.policy : 'yotsu';
    r.abilities[key] = round1(Math.min(r.talent, r.abilities[key] + SOKEN.gain));
    r.fatigue = clamp(r.fatigue + SOKEN.fatigue, 0, 100);
  }
  report.soken = ids;
}
