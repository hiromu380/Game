import { describe, expect, it } from 'vitest';
import { advanceBasho, answerElection, createGame, migrateSave, type GameState } from '../src';
import { holdElection, initialOffice, scheduleElection, yearEndOffice } from '../src/world/office';

const M1 = { division: 'makuuchi' as const, title: 'Y' as const, number: 1, side: 'E' as const };

/** 選挙の場所の前の状態（自分の親方をベテランにする） */
function beforeElection(seed: number, patch: (s: GameState) => void = () => {}): GameState {
  const s = createGame({ seed });
  s.bashoIndex = 12;
  patch(s);
  scheduleElection(s);
  return s;
}

const master = (s: GameState) => s.oyakata.find((o) => o.id === s.player.oyakataId)!;

describe('協会の役職', () => {
  it('開始と代替わりの役職は年齢から', () => {
    expect(initialOffice(40)).toBe('toshiyori');
    expect(initialOffice(46)).toBe('shunin');
    expect(initialOffice(52)).toBe('iin');
    expect(createGame({ seed: 1 }).player.office.rank).toBe('toshiyori');
  });

  it('年の終わりに、年齢と名声で上がる（日誌に残る）', () => {
    const s = createGame({ seed: 1 });
    master(s).age = 45;
    yearEndOffice(s);
    expect(s.player.office.rank).toBe('shunin');
    master(s).age = 50;
    yearEndOffice(s);
    expect(s.player.office.rank).toBe('iin');
    expect(s.journal.filter((e) => e.kind === 'office')).toHaveLength(2);
  });

  it('役職で親方の給与が変わる', () => {
    const s = createGame({ seed: 1 });
    s.player.office = { rank: 'iin', since: 0 };
    const pay = advanceBasho(s).lastReport!.personal.find((l) => l.key === 'oyakataSalary')!;
    expect(pay.amount).toBe(1_001_000 * 2);
  });
});

describe('理事選挙', () => {
  it('2年に1度、初場所の前に知らせが来る。委員より下なら返事はいらない', () => {
    const s = beforeElection(2);
    expect(s.pending.election).toEqual({ recommended: null, choice: 'stay' });
    expect(answerElection(s, 'run')).toBe(s);
    const t = createGame({ seed: 2 });
    t.bashoIndex = 6;
    scheduleElection(t);
    expect(t.pending.election).toBeNull();
  });

  it('理事10人・副理事3人・理事長1人が、参与でない親方から選ばれる', () => {
    const s = beforeElection(3);
    holdElection(s);
    const b = s.board!;
    expect(b.riji).toHaveLength(10);
    expect(b.fukuRiji).toHaveLength(3);
    expect(new Set([...b.riji, ...b.fukuRiji]).size).toBe(13);
    expect(b.riji).toContain(b.rijicho);
    for (const id of [...b.riji, ...b.fukuRiji])
      expect(s.oyakata.find((o) => o.id === id)!.role).not.toBe('sanyo');
  });

  it('格の高い親方は一門の推薦を受け、立候補すれば当選（無投票）。辞退もできる', () => {
    const veteran = (s: GameState) => {
      Object.assign(master(s), { age: 60, highestRank: M1 });
      s.player.office = { rank: 'yakuinTaiguu', since: 0 };
      s.player.prestige = 400;
    };
    const s = beforeElection(4, veteran);
    expect(s.pending.election!.recommended).not.toBeNull();
    const run = answerElection(s, 'run');
    holdElection(run);
    expect(['riji', 'fukuRiji', 'rijicho']).toContain(run.player.office.rank);
    expect(run.journal.at(-1)).toMatchObject({ kind: 'election', result: 'elected', rebel: false });
    const stay = answerElection(s, 'stay');
    holdElection(stay);
    expect([...stay.board!.riji, ...stay.board!.fukuRiji]).not.toContain(stay.player.oyakataId);
    expect(stay.board!.riji).toHaveLength(10);
  });

  it('推薦がなくても立候補できる（造反）。当選・落選で名声が動く', () => {
    const results = [1, 2, 3, 4, 5, 6, 7, 8].map((seed) => {
      const s = beforeElection(seed, (x) => {
        x.player.office = { rank: 'iin', since: 0 };
        x.player.prestige = 50;
      });
      if (s.pending.election!.recommended) return null;
      const run = answerElection(s, 'run');
      holdElection(run);
      const e = run.journal.at(-1)!;
      expect(e).toMatchObject({ kind: 'election', rebel: true });
      expect(run.player.prestige - 50).toBe(
        (e as { result: string }).result === 'elected' ? 3 : -3,
      );
      return (e as { result: string }).result;
    });
    expect(results.filter((r) => r !== null).length).toBeGreaterThan(0);
  });

  it('場所を進めると、選挙の場所の後に理事会が決まる', () => {
    let s = createGame({ seed: 6 });
    for (let i = 0; i < 13; i++) s = advanceBasho(s);
    expect(s.board).not.toBeNull();
    expect(s.board!.electedAt).toBe(12);
  });

  it('版13のセーブは、役職を年齢から決めて読む', () => {
    const v13 = JSON.parse(JSON.stringify(createGame({ seed: 1 })));
    v13.version = 13;
    delete v13.player.office;
    delete v13.board;
    delete v13.pending.election;
    const m = migrateSave(v13)!;
    expect(m.version).toBe(15);
    expect(m.player.office.rank).toBe('toshiyori');
    expect(m.board).toBeNull();
  });
});
