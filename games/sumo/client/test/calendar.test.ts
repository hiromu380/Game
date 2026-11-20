import { describe, expect, it } from 'vitest';
import ja from '../src/i18n/ja.json';
import en from '../src/i18n/en.json';
import { yearPlan } from '../src/calendar';

describe('年間予定表', () => {
  it('6場所を並べ、今の場所と済んだ場所が分かる', () => {
    const rows = yearPlan(8); // 2年目の夏場所
    expect(rows.map((r) => r.bashoIndex)).toEqual([6, 7, 8, 9, 10, 11]);
    expect(rows.map((r) => r.state)).toEqual(['past', 'past', 'now', 'next', 'next', 'next']);
  });

  it('巡業・稽古総見・約束・年の終わりの時期', () => {
    const rows = yearPlan(0);
    expect(rows[0]!.before).toContain('pledge');
    expect(rows[0]!.before).toContain('soken');
    expect(rows[1]!.after).toEqual(['jungyo.spring']);
    expect(rows[1]!.before).toContain('shindeshiBig');
    expect(rows[3]!.after).toEqual(['jungyo.summer']);
    expect(rows[5]!.after).toEqual(['jungyo.winter', 'yearEnd']);
    expect(rows[0]!.after).not.toContain('election');
  });

  it('理事選挙は2年に1度、初場所の後', () => {
    expect(yearPlan(12)[0]!.after).toContain('election');
    expect(yearPlan(6)[0]!.after).not.toContain('election');
  });

  it('文言がある', () => {
    for (const r of [...yearPlan(12), ...yearPlan(0)])
      for (const e of [...r.before, ...r.after]) {
        expect(ja).toHaveProperty([`plan.ev.${e}`]);
        expect(en).toHaveProperty([`plan.ev.${e}`]);
      }
  });
});
