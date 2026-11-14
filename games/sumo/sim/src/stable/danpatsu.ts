/**
 * 引退相撲・断髪式: 関取だった元弟子の髷を、引退の後に落とす（乱数を使わない）
 */
import { DANPATSU, type DanpatsuTier, type DanpatsuVenue } from '../balance/danpatsu';
import { isSanyaku } from '../banzuke/rank';
import { note } from '../game/journal';
import type { Alumnus, BashoReport, GameState } from '../model/types';

export interface DanpatsuPlan {
  bashoIndex: number;
  venue: DanpatsuVenue;
}

/** 最高位の区分（関取でなければ null） */
export function danpatsuTier(a: Pick<Alumnus, 'career'>): DanpatsuTier | null {
  const top = a.career.highestRank;
  if (!top || a.career.sekitoriBasho === 0) return null;
  if (top.title === 'Y') return 'Y';
  if (top.title === 'O') return 'O';
  if (isSanyaku(top)) return 'sanyaku';
  return top.division === 'makuuchi' ? 'makuuchi' : 'juryo';
}

/** 断髪式の予定（この場所の後に行う）。関取にならなかった元弟子は部屋で静かに落とすので、なし */
export function danpatsuPlan(a: Alumnus): DanpatsuPlan | null {
  if (danpatsuTier(a) === null) return null;
  if (a.career.sekitoriBasho < DANPATSU.kokugikanSekitoriBasho) {
    return { bashoIndex: a.retiredBashoIndex + DANPATSU.hotelDelay, venue: 'hotel' };
  }
  let t = a.retiredBashoIndex + DANPATSU.kokugikanDelay;
  while (!DANPATSU.tokyoBasho.includes(t % 6)) t++;
  return { bashoIndex: t, venue: 'kokugikan' };
}

/** はさみを入れる人数（力士ごとに決まる） */
export function hasamiCount(a: Alumnus, venue: DanpatsuVenue): number {
  const tier = danpatsuTier(a);
  if (!tier) return 0;
  const base = DANPATSU.hasami[tier] * (venue === 'hotel' ? DANPATSU.hotelShare : 1);
  // ID から決まるばらつき（-spread〜+spread）
  const u = (((a.id * 2654435761) >>> 0) % 1001) / 1000;
  return Math.round(base * (1 + DANPATSU.spread * (2 * u - 1)));
}

/** この場所の後の断髪式を行う（名声・後援会・タニマチ・日誌・場所の結果） */
export function holdDanpatsu(state: GameState, report: BashoReport): void {
  for (const a of state.player.alumni) {
    const plan = danpatsuPlan(a);
    if (!plan || plan.bashoIndex !== state.bashoIndex) continue;
    const tier = danpatsuTier(a)!;
    const share = plan.venue === 'hotel' ? DANPATSU.hotelShare : 1;
    const hasami = hasamiCount(a, plan.venue);
    const k = state.player.koenkai;
    state.player.prestige += DANPATSU.prestige[tier] * share;
    k.members += Math.round(DANPATSU.members[tier] * share);
    for (const p of k.patrons) {
      p.favor = Math.min(100, p.favor + DANPATSU.patronFavor[plan.venue]);
    }
    const patrons = [...k.patrons]
      .sort((x, y) => y.favor - x.favor || x.id - y.id)
      .slice(0, DANPATSU.patronsShown)
      .map((p) => p.surname);
    const rival = state.rival
      ? (state.stables.find((s) => s.id === state.rival!.stableId)?.name ?? null)
      : null;
    (report.danpatsu ??= []).push({
      alumnusId: a.id,
      venue: plan.venue,
      hasami,
      patrons,
      rival,
    });
    note(state, { kind: 'danpatsu', shikona: a.name, venue: plan.venue, hasami });
  }
}
