/**
 * 幕内の優勝争い: 日ごとの先頭・千秋楽を前にした優勝の目・結びの一番（取組の結果から数える。乱数を使わない）
 */
import type { BoutResult, YushoRace } from '../model/types';

/** 先頭として名前を出す人数・優勝の目がある力士の数の上限 */
const SHOWN = { leaders: 4, contenders: 6, fromDay: 10, days: 15 } as const;

/**
 * group: 幕内の力士（番付の順）。winnerId: 優勝した力士。playoff: 優勝決定戦があったか
 * 関取は毎日1番（休場は負けと同じ）なので、星は「何日目までの勝ち数」で比べる
 */
export function yushoRace(
  group: readonly number[],
  bouts: readonly BoutResult[],
  winnerId: number,
  playoff: boolean,
): YushoRace {
  const order = new Map(group.map((id, i) => [id, i]));
  const mine = bouts.filter((b) => order.has(b.eastId) && order.has(b.westId));
  const winsBy = (day: number) => {
    const w = new Map(group.map((id) => [id, 0]));
    for (const b of mine) if (b.day <= day) w.set(b.winnerId, w.get(b.winnerId)! + 1);
    return w;
  };
  const boutsAfter = (day: number) => {
    const n = new Map(group.map((id) => [id, 0]));
    for (const b of mine) {
      if (b.day <= day) continue;
      n.set(b.eastId, n.get(b.eastId)! + 1);
      n.set(b.westId, n.get(b.westId)! + 1);
    }
    return n;
  };
  const byStar = (w: Map<number, number>) =>
    [...group].sort((a, b) => w.get(b)! - w.get(a)! || order.get(a)! - order.get(b)!);

  const leaders: YushoRace['leaders'] = [];
  for (let day = SHOWN.fromDay; day <= SHOWN.days; day++) {
    const w = winsBy(day);
    const top = Math.max(...w.values());
    leaders.push({
      day,
      wins: top,
      losses: day - top,
      ids: byStar(w)
        .filter((id) => w.get(id) === top)
        .slice(0, SHOWN.leaders),
    });
  }

  // 優勝が決まった日: 優勝者の勝ち数に、ほかの誰も残りを全部勝っても届かなくなった日
  let decidedDay = playoff ? SHOWN.days + 1 : SHOWN.days;
  if (!playoff) {
    for (let day = 1; day <= SHOWN.days; day++) {
      const w = winsBy(day);
      const rest = boutsAfter(day);
      const mineWins = w.get(winnerId) ?? 0;
      const caught = group.some((id) => id !== winnerId && w.get(id)! + rest.get(id)! >= mineWins);
      if (!caught) {
        decidedDay = day;
        break;
      }
    }
  }

  const w14 = winsBy(SHOWN.days - 1);
  const top14 = Math.max(...w14.values());
  const contenders = byStar(w14)
    .filter((id) => w14.get(id)! >= top14 - 1)
    .slice(0, SHOWN.contenders)
    .map((id) => ({ id, wins: w14.get(id)!, losses: SHOWN.days - 1 - w14.get(id)! }));

  const last = mine.filter((b) => b.day === SHOWN.days);
  const musubi =
    [...last].sort(
      (a, b) =>
        Math.min(order.get(a.eastId)!, order.get(a.westId)!) -
        Math.min(order.get(b.eastId)!, order.get(b.westId)!),
    )[0] ?? null;
  const deciding =
    decidedDay === SHOWN.days
      ? (last.find((b) => b.eastId === winnerId || b.westId === winnerId) ?? null)
      : null;
  return { decidedDay, leaders, contenders, musubi, deciding };
}
