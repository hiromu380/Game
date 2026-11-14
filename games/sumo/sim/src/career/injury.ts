/**
 * けがの部位と治療・古傷（けがの数え方そのものは稽古・取組・出来事のまま。ここでは部位を付けて、治ったときを片付ける）
 */
import { INJURY, INJURY_PARTS, type InjuryPart, type Treatment } from '../balance/injury';
import { createPrng, deriveSeed, SEED } from '../core/prng';
import { note } from '../game/journal';
import type { GameState, Rikishi } from '../model/types';

/** 古傷の数ぶん、けがのしやすさに掛ける倍率 */
export function chronicFactor(r: Pick<Rikishi, 'oldInjuries'>): number {
  const n = Math.min(INJURY.chronicCountMax, r.oldInjuries?.length ?? 0);
  return 1 + INJURY.chronicFragility * n;
}

function pickPart(r: Rikishi, u: number): InjuryPart {
  const old = new Set(r.oldInjuries ?? []);
  const w = INJURY_PARTS.map((p) => INJURY.parts[p].weight * (old.has(p) ? INJURY.recurrence : 1));
  let x = u * w.reduce((a, b) => a + b, 0);
  for (let i = 0; i < w.length; i++) {
    x -= w[i]!;
    if (x < 0) return INJURY_PARTS[i]!;
  }
  return INJURY_PARTS[INJURY_PARTS.length - 1]!;
}

/**
 * 新しいけがに部位を付け、治ったけがを片付ける（古傷になるか）。
 * 自分の弟子の重いけがは、治療の方針（手術・保存療法）を聞く
 */
export function tagInjuries(state: GameState): void {
  for (const r of state.rikishi) {
    if (r.injury > 0 && !r.wound) {
      const rng = createPrng(deriveSeed(state.seed, SEED.wound, state.bashoIndex, r.id));
      const part = pickPart(r, rng.nextUint32() / 2 ** 32);
      const side = INJURY.parts[part].sided ? (rng.chance(0.5) ? 'L' : 'R') : null;
      r.wound = { part, side, total: r.injury, treatment: 'rest' };
      if (r.stableId === state.player.stableId && r.injury >= INJURY.treatmentMinTotal) {
        state.pending.treatment = [...state.pending.treatment.filter((x) => x !== r.id), r.id];
      }
    } else if (r.injury === 0 && r.wound) {
      const w = r.wound;
      const rng = createPrng(deriveSeed(state.seed, SEED.wound, state.bashoIndex, r.id, 1));
      const p =
        w.treatment === 'surgery'
          ? INJURY.chronicChance.surgery
          : w.total >= INJURY.treatmentMinTotal
            ? INJURY.chronicChance.rest
            : INJURY.chronicChance.minor;
      if (rng.chance(p)) {
        r.oldInjuries = [...new Set([...(r.oldInjuries ?? []), w.part])];
        if (r.stableId === state.player.stableId)
          note(state, { kind: 'injury', event: 'chronic', shikona: r.name, part: w.part });
      }
      delete r.wound;
    }
  }
  const alive = new Set(state.rikishi.filter((r) => r.injury > 0).map((r) => r.id));
  state.pending.treatment = state.pending.treatment.filter((id) => alive.has(id));
}

/** 治療の方針を決める（聞かれている弟子だけ）。手術は休みが延びるが、古傷になりにくい */
export function applyTreatment(state: GameState, id: number, treatment: Treatment): boolean {
  if (!state.pending.treatment.includes(id)) return false;
  const r = state.rikishi.find((x) => x.id === id);
  if (!r?.wound) return false;
  if (treatment === 'surgery') {
    r.injury += INJURY.surgeryExtra;
    r.wound.total += INJURY.surgeryExtra;
    r.playHurt = false;
    note(state, { kind: 'injury', event: 'surgery', shikona: r.name, part: r.wound.part });
  }
  r.wound.treatment = treatment;
  state.pending.treatment = state.pending.treatment.filter((x) => x !== id);
  return true;
}
