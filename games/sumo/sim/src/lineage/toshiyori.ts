/**
 * 年寄名跡の襲名資格（docs/realism.md「親方（年寄）」）
 */
import { TOSHIYORI } from '../balance/career';
import type { Rikishi } from '../model/types';

/** 日本国籍＋（三役1場所・幕内通算20場所・十両以上通算30場所のいずれか） */
export function eligibleForToshiyori(r: Rikishi): boolean {
  if (r.foreign) return false;
  const c = r.career;
  return (
    c.sanyakuBasho >= TOSHIYORI.sanyakuBasho ||
    c.makuuchiBasho >= TOSHIYORI.makuuchiBasho ||
    c.sekitoriBasho >= TOSHIYORI.sekitoriBasho
  );
}

/** 年寄名跡の資格まで、それぞれあと何場所か（0 なら満たしている）。外国籍は null（帰化しないと継げない） */
export function toshiyoriProgress(
  r: Pick<Rikishi, 'foreign' | 'career'>,
): { sanyaku: number; makuuchi: number; sekitori: number } | null {
  if (r.foreign) return null;
  const c = r.career;
  return {
    sanyaku: Math.max(0, TOSHIYORI.sanyakuBasho - c.sanyakuBasho),
    makuuchi: Math.max(0, TOSHIYORI.makuuchiBasho - c.makuuchiBasho),
    sekitori: Math.max(0, TOSHIYORI.sekitoriBasho - c.sekitoriBasho),
  };
}
