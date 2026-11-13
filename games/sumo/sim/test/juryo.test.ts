import { describe, expect, it } from 'vitest';
import { juryoLine } from '../src/banzuke/make';
import type { Division, Rank } from '../src';

/** 小さな番付: 十両 jn 人の後に幕下。成績と並び（score）を与える */
function world(rows: { d: Division; n: number; wins: number; losses: number }[]) {
  const ranks = new Map<number, Rank>();
  const records = new Map<number, { wins: number; losses: number; absences: number }>();
  rows.forEach((r, i) => {
    ranks.set(i, { division: r.d, title: null, number: r.n, side: 'E' });
    records.set(i, { wins: r.wins, losses: r.losses, absences: 0 });
  });
  return { ranks, records, ids: rows.map((_, i) => i) };
}

describe('十両昇進の目安', () => {
  it('幕下16枚目より下は全勝でも上がらない。十両の負け越しが残る', () => {
    const w = world([
      { d: 'makushita', n: 27, wins: 7, losses: 0 }, // 成績の並びでは先頭でも上がらない
      { d: 'juryo', n: 13, wins: 6, losses: 9 },
      { d: 'juryo', n: 14, wins: 5, losses: 10 },
      { d: 'makushita', n: 8, wins: 5, losses: 2 },
    ]);
    const out = juryoLine(w.ids, 2, { ...w, byScore: (a, b) => a - b });
    expect(out.slice(0, 2).sort()).toEqual([1, 2]);
    expect(out.slice(2)).toEqual([0, 3]);
  });

  it('幕下15枚目以内の全勝は必ず上がる。幕下5枚目以内の勝ち越しは空いた枠まで', () => {
    const w = world([
      { d: 'juryo', n: 12, wins: 8, losses: 7 },
      { d: 'makushita', n: 3, wins: 4, losses: 3 },
      { d: 'juryo', n: 14, wins: 4, losses: 11 },
      { d: 'makushita', n: 14, wins: 7, losses: 0 }, // 並びでは枠の外でも上がる
    ]);
    const out = juryoLine(w.ids, 2, { ...w, byScore: (a, b) => a - b });
    expect(new Set(out.slice(0, 2))).toEqual(new Set([0, 3]));
    // 2枠: 十両の勝ち越し（0）と全勝（3）。幕下3枚目の勝ち越し（1）は枠がなく残る
    expect(out.slice(2)).toEqual([1, 2]);
  });

  it('候補が多くても、必ず上がる者は外さない', () => {
    const w = world([
      { d: 'makushita', n: 1, wins: 5, losses: 2 },
      { d: 'makushita', n: 2, wins: 4, losses: 3 },
      { d: 'makushita', n: 10, wins: 7, losses: 0 },
    ]);
    const out = juryoLine(w.ids, 1, { ...w, byScore: (a, b) => a - b });
    expect(out[0]).toBe(2);
  });

  it('上がった幕下は関取の一番下に（幕内まで飛ばない）', () => {
    const w = world([
      { d: 'makushita', n: 2, wins: 7, losses: 0 }, // 成績の並びでは先頭
      { d: 'makuuchi', n: 16, wins: 8, losses: 7 },
      { d: 'juryo', n: 1, wins: 9, losses: 6 },
      { d: 'juryo', n: 14, wins: 3, losses: 12 },
    ]);
    const out = juryoLine(w.ids, 3, { ...w, byScore: (a, b) => a - b });
    expect(out).toEqual([1, 2, 0, 3]);
  });
});
