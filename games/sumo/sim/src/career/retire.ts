/**
 * 引退の判断（年齢・地位・成績から確率で）
 */
import { RETIRE } from '../balance/career';
import type { Prng } from '../core/prng';
import type { Rank, Rikishi } from '../model/types';
import { isSekitori } from '../banzuke/rank';

/** この場所の後に引退を考えるか（1場所あたりの確率で判定） */
export function wantsToRetire(r: Rikishi, rank: Rank, rng: Prng): boolean {
  if (r.age >= RETIRE.ageHard) return true;
  let perYear = RETIRE.basePerYear;
  if (r.age > RETIRE.ageSoft) perYear += (r.age - RETIRE.ageSoft) * RETIRE.perYearOverSoft;
  const wasSekitori = r.career.sekitoriBasho > 0;
  if (wasSekitori && !isSekitori(rank) && r.age >= 28) perYear += RETIRE.fallenSekitori;
  if (
    !wasSekitori &&
    r.age >= 24 &&
    (rank.division === 'jonidan' || rank.division === 'jonokuchi')
  ) {
    perYear += RETIRE.lowerStalled;
  }
  // 横綱は成績が続かなければ引退（2場所続けて負け越し・休場）
  if (rank.title === 'Y') {
    const [now, prev] = r.recent;
    const bad = (b: typeof now) => b !== undefined && b.wins < 8;
    if (bad(now) && bad(prev)) return rng.chance(0.6);
  }
  // 長いけがは引退のきっかけになる
  if (r.injury >= 2 && r.age >= 27) perYear += 0.2;
  return rng.chance(Math.min(0.95, perYear / 6));
}

/** 必ず引退（本人が決めている） */
export function mustRetire(r: Rikishi): boolean {
  return r.age >= RETIRE.ageHard;
}
