/**
 * 部屋の人（元弟子の若者頭・世話人）とちゃんこの方針の効果
 */
import { DIETS, STAFF, STAFF_EFFECTS } from '../balance/staff';
import type { Alumnus, GameState, StaffMember, StaffRole } from '../model/types';

/** 元弟子の今の年齢 */
export function alumnusAge(state: GameState, a: Alumnus): number {
  return a.retiredAge + Math.floor((state.bashoIndex - a.retiredBashoIndex) / 6);
}

/** 最高位から決まる腕前（幕内 3・十両 2・幕下 1） */
export function staffSkill(a: Alumnus): number {
  const d = a.career.highestRank?.division;
  return d === 'makuuchi' ? 3 : d === 'juryo' ? 2 : 1;
}

/** その役に雇える元弟子（親方になっていない・定年前・最高位と場所数の条件・まだ雇っていない） */
export function staffCandidates(state: GameState, role: StaffRole): Alumnus[] {
  const def = STAFF[role];
  const hired = new Set(state.player.staff.map((s) => s.alumnusId));
  return state.player.alumni.filter((a) => {
    const d = a.career.highestRank?.division;
    return (
      !a.becameOyakata &&
      !hired.has(a.id) &&
      alumnusAge(state, a) < STAFF_EFFECTS.retireAge &&
      a.career.basho >= def.minBasho &&
      d !== undefined &&
      (def.divisions as readonly string[]).includes(d)
    );
  });
}

export function staffOf(state: GameState, role: StaffRole): StaffMember | undefined {
  return state.player.staff.find((s) => s.role === role);
}

/** 稽古への効果: 若者頭（幕下以下の伸び）・世話人（回復・けが）・ちゃんこ */
export function staffGrowth(state: GameState): {
  lowerGrowth: number;
  recovery: number;
  injury: number;
  gainKg: number;
} {
  const diet = DIETS[state.player.diet];
  const w = staffOf(state, 'wakaimonogashira');
  const s = staffOf(state, 'sewanin');
  return {
    lowerGrowth: 1 + (w ? w.skill * STAFF_EFFECTS.lowerGrowthPerSkill : 0),
    recovery: diet.recovery + (s ? s.skill * STAFF_EFFECTS.recoveryPerSkill : 0),
    injury: diet.injury * (1 - (s ? s.skill * STAFF_EFFECTS.injuryCutPerSkill : 0)),
    gainKg: diet.gainKg,
  };
}
