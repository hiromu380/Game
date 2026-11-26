/**
 * 場所前の稽古と本場所の成績を並べる（純粋関数）。稽古が勝ちにつながったかを、場所の結果で見せる。
 * 成績は漏れなく重なりなく3つに分ける: 全休（1番も取らなかった）→ 勝ち越し → 負け越し
 */
import type { BashoReport, BashoRecord } from '@ichimon/sim';

export type Outcome = 'kyujo' | 'kachi' | 'make';

export interface PayoffRow {
  id: number;
  /** 4週の伸び（押し・四つ・技の合計。能力の目盛り） */
  gain: number;
  walls: number;
  weeks: number;
  record: BashoRecord;
  outcome: Outcome;
}

export interface Payoff {
  /** 稽古をつけた弟子（伸びた順） */
  rows: PayoffRow[];
  /** 稽古をつけた弟子のうち、取組のあった人数と勝ち越した人数 */
  trained: { n: number; kachi: number };
  /** 稽古をつけなかった弟子（比べるため） */
  others: { n: number; kachi: number };
}

export function outcomeOf(r: Pick<BashoRecord, 'wins' | 'losses' | 'absences'>): Outcome {
  if (r.wins + r.losses === 0) return 'kyujo';
  return r.wins * 2 > r.wins + r.losses + r.absences ? 'kachi' : 'make';
}

export function prepPayoff(report: Pick<BashoReport, 'prep' | 'mine'>): Payoff | null {
  const prep = report.prep ?? [];
  if (prep.length === 0) return null;
  const rec = new Map(report.mine.map((m) => [m.id, m.record]));
  const rows = prep.flatMap((p): PayoffRow[] => {
    const record = rec.get(p.id);
    return record ? [{ ...p, record, outcome: outcomeOf(record) }] : [];
  });
  if (rows.length === 0) return null;
  rows.sort((a, b) => b.gain - a.gain || a.id - b.id);
  const tally = (list: BashoRecord[]) => {
    const played = list.filter((r) => outcomeOf(r) !== 'kyujo');
    return { n: played.length, kachi: played.filter((r) => outcomeOf(r) === 'kachi').length };
  };
  const trainedIds = new Set(rows.map((r) => r.id));
  return {
    rows,
    trained: tally(rows.map((r) => r.record)),
    others: tally(report.mine.filter((m) => !trainedIds.has(m.id)).map((m) => m.record)),
  };
}
