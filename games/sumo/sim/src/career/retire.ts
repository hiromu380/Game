/**
 * 引退の判断（年齢・地位・成績から確率で）
 */
import { RETIRE } from '../balance/career';
import type { Prng } from '../core/prng';
import type { Rank, Rikishi } from '../model/types';
import { isSekitori } from '../banzuke/rank';
import { TRAITS } from '../balance/traits';
import { hasTrait } from './traits';

/** この場所の後に引退を考えるか（1場所あたりの確率で判定） */
export function wantsToRetire(r: Rikishi, rank: Rank, rng: Prng): boolean {
  if (r.age >= RETIRE.ageHard) return true;
  let perYear = RETIRE.basePerYear;
  if (r.age > RETIRE.ageSoft) perYear += (r.age - RETIRE.ageSoft) * RETIRE.perYearOverSoft;
  const wasSekitori = r.career.sekitoriBasho > 0;
  if (wasSekitori && !isSekitori(rank) && r.age >= 28) perYear += RETIRE.fallenSekitori;
  if (!wasSekitori) perYear += RETIRE.neverSekitoriPerYear;
  if (
    !wasSekitori &&
    r.age >= RETIRE.lowerStalledFromAge &&
    (rank.division === 'jonidan' || rank.division === 'jonokuchi')
  ) {
    perYear += RETIRE.lowerStalled;
  }
  // 横綱は成績が続かなければ引退（負け越し・休場が続くと。3場所続けば多くが引退）
  if (rank.title === 'Y') {
    const [now, prev, prev2] = r.recent;
    const bad = (b: typeof now) => b !== undefined && b.wins < 8;
    if (bad(now) && bad(prev))
      return rng.chance(bad(prev2) ? RETIRE.yokozunaBad3 : RETIRE.yokozunaBad2);
  }
  // 繊細な力士は、関取になる前は辞めたくなりやすい
  if (!wasSekitori && hasTrait(r, 'sensitive')) perYear += TRAITS.sensitive.retirePerYear;
  // 長いけがは引退のきっかけになる
  if (r.injury >= 2 && r.age >= 27) perYear += 0.2;
  return rng.chance(Math.min(0.95, perYear / 6));
}

/** 必ず引退（本人が決めている） */
export function mustRetire(r: Rikishi): boolean {
  return r.age >= RETIRE.ageHard;
}
