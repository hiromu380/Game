/**
 * 本命（応援予想）: 場所の前に選んだ弟子が勝ち越したかを、場所の後に見る（乱数を使わない）
 * 本命は外すまで次の場所にも残る。本命が部屋からいなくなったら外れる
 */
import { HONMEI } from '../balance/honmei';
import type { BashoReport, GameState } from '../model/types';

/** 本命を選ぶ（null で外す）。自分の部屋の弟子だけ。場所の前ならいつでも（結果は場所の前に決まらないので、見てから選び直せない） */
export function setHonmei(input: GameState, id: number | null): GameState {
  if (id !== null) {
    const r = input.rikishi.find((x) => x.id === id);
    if (!r || r.stableId !== input.player.stableId) return input;
  }
  if (input.player.honmei === id) return input;
  const state: GameState = JSON.parse(JSON.stringify(input));
  state.player.honmei = id;
  return state;
}

/** 場所の後: 本命が勝ち越したら名声。番付で取った弟子だけ（休場で全休なら外れ） */
export function settleHonmei(state: GameState, report: BashoReport): void {
  const id = state.player.honmei;
  if (id === null) return;
  const m = report.mine.find((x) => x.id === id);
  if (m) {
    const { wins, losses, absences } = m.record;
    const hit = wins * 2 > wins + losses + absences;
    report.honmei = { id, hit };
    if (hit) state.player.prestige += HONMEI.prestige;
  }
  // 引退・移籍で部屋にいなくなったら外す
  const r = state.rikishi.find((x) => x.id === id);
  if (!r || r.stableId !== state.player.stableId) state.player.honmei = null;
}
