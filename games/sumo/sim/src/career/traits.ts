/**
 * 力士の個性と得意技（純粋関数）。個性は ID・素質・身長から決まり、変わらない
 */
import { KIMARITE_BY_ID } from '../balance/kimarite';
import { TRAIT_EXCLUSIVE, TRAIT_IDS, TRAITS, type TraitId } from '../balance/traits';
import type { Career, Rikishi } from '../model/types';

/** 小さな決定論の値（0〜1） */
function unit(n: number, salt: number): number {
  let x = (Math.imul(n ^ Math.imul(salt, 0x9e3779b1), 0x85ebca6b) ^ (n >>> 13)) >>> 0;
  x = Math.imul(x ^ (x >>> 16), 0xc2b2ae35) >>> 0;
  return ((x ^ (x >>> 15)) >>> 0) / 4294967296;
}

const cache = new Map<string, readonly TraitId[]>();

export function traitsOf(r: Pick<Rikishi, 'id' | 'talent' | 'height'>): readonly TraitId[] {
  const key = `${r.id}:${r.talent}:${r.height}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const seed = (r.id * 7919 + Math.round(r.talent * 13) * 104729 + r.height * 31) | 0;
  const roll = unit(seed, 1);
  const count = roll < TRAITS.none ? 0 : roll < TRAITS.none + TRAITS.one ? 1 : 2;
  const out: TraitId[] = [];
  for (let i = 0; out.length < count && i < 8; i++) {
    const t = TRAIT_IDS[Math.floor(unit(seed, 2 + i) * TRAIT_IDS.length)]!;
    if (out.includes(t)) continue;
    if (
      TRAIT_EXCLUSIVE.some(([a, b]) => (a === t && out.includes(b)) || (b === t && out.includes(a)))
    )
      continue;
    out.push(t);
  }
  if (cache.size > 5000) cache.clear();
  cache.set(key, out);
  return out;
}

export const hasTrait = (r: Pick<Rikishi, 'id' | 'talent' | 'height'>, t: TraitId) =>
  traitsOf(r).includes(t);

/** けがのしやすさ（体質を含む） */
export function fragilityOf(r: Rikishi): number {
  const t = traitsOf(r);
  return (
    r.fragility *
    (t.includes('tough') ? TRAITS.tough.fragility : 1) *
    (t.includes('fragileBody') ? TRAITS.fragileBody.fragility : 1)
  );
}

/** 得意技（なければ null）。非技は数えない */
export function tokuiWaza(career: Pick<Career, 'kimarite'>): string | null {
  const counts = career.kimarite;
  if (!counts) return null;
  let best: string | null = null;
  let bestN = 0;
  let total = 0;
  for (const [k, n] of Object.entries(counts)) {
    if (KIMARITE_BY_ID.get(k)?.group === 'hiwaza') continue;
    total += n;
    if (n > bestN) {
      best = k;
      bestN = n;
    }
  }
  return bestN >= TRAITS.tokuiMinWins && bestN >= total * TRAITS.tokuiShare ? best : null;
}
