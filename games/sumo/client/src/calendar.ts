/**
 * 年間予定表: 1年の6場所と、その前後の行事（純粋関数。場所の番号だけから決まる）
 * 行事の時期は sim の決まり（巡業・稽古総見・理事選挙・後援会との約束）に合わせる。docs/realism.md「一年の行事」
 */
import { JUNGYO_AFTER, OFFICE, SOKEN } from '@ichimon/sim';

export type PlanEvent =
  | 'banzuke'
  | 'shindeshi'
  | 'shindeshiBig'
  | 'soken'
  | 'pledge'
  | 'jungyo.spring'
  | 'jungyo.summer'
  | 'jungyo.autumn'
  | 'jungyo.winter'
  | 'election'
  | 'yearEnd';

export interface PlanRow {
  bashoIndex: number;
  /** 0〜5（初・春・夏・名古屋・秋・九州） */
  slot: number;
  /** 場所の前・後の行事 */
  before: PlanEvent[];
  after: PlanEvent[];
  state: 'past' | 'now' | 'next';
}

/** 今の場所（次に行う場所）の年の6場所 */
export function yearPlan(bashoIndex: number): PlanRow[] {
  const first = bashoIndex - (bashoIndex % 6);
  return [0, 1, 2, 3, 4, 5].map((slot) => {
    const i = first + slot;
    const before: PlanEvent[] = ['banzuke', slot === 1 ? 'shindeshiBig' : 'shindeshi'];
    if ((SOKEN.months as readonly number[]).includes(slot)) before.push('soken');
    if (slot === 0) before.unshift('pledge');
    const after: PlanEvent[] = [];
    const j = JUNGYO_AFTER[slot];
    if (j) after.push(`jungyo.${j}`);
    if (i > 0 && i % OFFICE.electionEveryBasho === 0) after.push('election');
    if (slot === 5) after.push('yearEnd');
    return {
      bashoIndex: i,
      slot,
      before,
      after,
      state: i < bashoIndex ? 'past' : i === bashoIndex ? 'now' : 'next',
    };
  });
}
