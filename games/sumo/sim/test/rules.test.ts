import { describe, expect, it } from 'vitest';
import {
  advanceBasho,
  chooseSuccessor,
  createGame,
  eligibleForToshiyori,
  pickKakun,
  ranksOf,
  STABLE_SUBSIDY,
  type BashoRecord,
  type GameState,
  type Rank,
  type Rikishi,
} from '../src';
import { makeBanzuke } from '../src/banzuke/make';
import { emptyCareer } from '../src/career/create';
import { settleBasho } from '../src/money/ledger';
import { payFor } from '../src/career/update';
import { KENSHO } from '../src';

const M = (n: number): Rank => ({ division: 'makuuchi', title: 'M', number: n, side: 'E' });
const rec = (rank: Rank, wins: number, yusho = false, bashoIndex = 0): BashoRecord => ({
  bashoIndex,
  rank,
  wins,
  losses: 15 - wins,
  absences: 0,
  yusho,
});

/** 幕内42人だけの番付で編成を試す（上から Y1・O2・S2・K2・M35） */
function topBanzuke() {
  const banzuke = Array.from({ length: 42 }, (_, i) => i + 1);
  const titles: Record<number, 'Y' | 'O' | 'S' | 'K'> = {
    1: 'Y',
    2: 'O',
    3: 'O',
    4: 'S',
    5: 'S',
    6: 'K',
    7: 'K',
  };
  return { banzuke, titles, ranks: ranksOf(banzuke, titles) };
}

function run(
  wins: Record<number, number>,
  recent: Record<number, BashoRecord[]> = {},
  yushoId?: number,
) {
  const { banzuke, ranks } = topBanzuke();
  const records = new Map(
    banzuke.map((id) => [id, { wins: wins[id] ?? 8, losses: 15 - (wins[id] ?? 8), absences: 0 }]),
  );
  return makeBanzuke({
    banzuke,
    ranks,
    records,
    makuuchiYusho: yushoId,
    recentOf: (id) => recent[id] ?? [rec(ranks.get(id)!, wins[id] ?? 8, id === yushoId)],
    exOzeki: () => false,
    retired: new Set(),
    newcomers: [],
  });
}

describe('番付編成', () => {
  it('勝ち越した前頭は下がらず、負け越した前頭は上がらない', () => {
    const out = run({ 20: 9, 21: 6 });
    expect(out.banzuke.indexOf(20)).toBeLessThanOrEqual(19);
    expect(out.banzuke.indexOf(21)).toBeGreaterThanOrEqual(20);
  });

  it('大関は2場所続けて負け越すと関脇へ落ちる（1場所ならカド番で残る）', () => {
    const { ranks } = topBanzuke();
    const o = ranks.get(2)!;
    const once = run({ 2: 6 }, { 2: [rec(o, 6), rec(o, 9)] });
    expect(once.titles[2]).toBe('O');
    const twice = run({ 2: 6 }, { 2: [rec(o, 6), rec(o, 7)] });
    expect(twice.titles[2]).toBe('S');
    expect(twice.demotedOzeki).toEqual([2]);
  });

  it('大関で2場所連続優勝すれば横綱へ', () => {
    const { ranks } = topBanzuke();
    const o = ranks.get(3)!;
    const out = run({ 3: 14 }, { 3: [rec(o, 14, true), rec(o, 13, true)] }, 3);
    expect(out.titles[3]).toBe('Y');
    expect(out.newYokozuna).toEqual([3]);
  });

  it('関脇で三役3場所33勝（最後10勝以上）なら大関へ', () => {
    const { ranks } = topBanzuke();
    const s = ranks.get(4)!;
    const k: Rank = { ...s, title: 'K' };
    const out = run({ 4: 12 }, { 4: [rec(s, 12), rec(s, 11), rec(k, 10)] });
    expect(out.titles[4]).toBe('O');
    const short = run({ 4: 11 }, { 4: [rec(s, 11), rec(s, 11), rec(k, 10)] });
    expect(short.titles[4]).not.toBe('O');
  });

  it('関脇・小結は最低2人ずついる', () => {
    const out = run({ 4: 3, 5: 3, 6: 3, 7: 3 });
    const t = Object.values(out.titles);
    expect(t.filter((x) => x === 'S').length).toBeGreaterThanOrEqual(2);
    expect(t.filter((x) => x === 'K').length).toBeGreaterThanOrEqual(2);
  });
});

describe('年寄名跡の資格', () => {
  const r = (patch: Partial<Rikishi['career']>, foreign = false) =>
    ({ foreign, career: { ...emptyCareer(), ...patch } }) as Rikishi;
  it('三役1場所・幕内20場所・関取30場所のいずれか。外国籍は不可', () => {
    expect(eligibleForToshiyori(r({ sanyakuBasho: 1 }))).toBe(true);
    expect(eligibleForToshiyori(r({ makuuchiBasho: 20 }))).toBe(true);
    expect(eligibleForToshiyori(r({ sekitoriBasho: 30 }))).toBe(true);
    expect(eligibleForToshiyori(r({ sekitoriBasho: 29, makuuchiBasho: 19 }))).toBe(false);
    expect(eligibleForToshiyori(r({ sanyakuBasho: 5 }, true))).toBe(false);
  });
});

describe('お金（実際の金額）', () => {
  it('幕下以下1人: 養成費 14万（月7万×2）・部屋維持費 11.5万・稽古場維持費 4.5万', () => {
    const lower: Rank = { division: 'jonidan', title: null, number: 10, side: 'E' };
    const l = settleBasho([lower], 0, []);
    const get = (k: string) => l.income.find((x) => x.key === k)!.amount;
    expect(get('trainee')).toBe(140_000);
    expect(get('upkeep')).toBe(115_000);
    expect(get('dojo')).toBe(45_000);
    expect(get('sekitoriBonus')).toBe(0);
  });

  it('関取は養成費の対象外で、養成奨励金（年額の 1/6）が入る', () => {
    const l = settleBasho([M(5)], 0, []);
    expect(l.income.find((x) => x.key === 'trainee')!.amount).toBe(0);
    expect(l.income.find((x) => x.key === 'sekitoriBonus')!.amount).toBe(
      STABLE_SUBSIDY.sekitoriBonusYearly.M / 6,
    );
  });

  it('関取の場所ごとの収入: 月給2か月分＋褒賞金（持ち給金×4000）', () => {
    const r = rec(M(3), 9);
    // 前頭の月給 155万 × 2 ＋ 持ち給金 60円 × 4000
    expect(payFor(M(3), r, 120)).toBe(1_550_000 * 2 + 60 * 4000);
  });

  it('懸賞金: 1本7万円のうち力士は6万円（袋1万＋振り込み5万）', () => {
    expect(KENSHO.toRikishi).toBe(KENSHO.inEnvelope + KENSHO.toAccount);
    expect(KENSHO.perBanner).toBe(KENSHO.toRikishi + KENSHO.associationFee);
  });

  it('部屋の赤字は親方の個人のお金で埋める', () => {
    const s = createGame({ seed: 2 });
    s.player.stableMoney = -100;
    const next = advanceBasho(s);
    expect(next.player.stableMoney).toBeGreaterThanOrEqual(0);
  });
});

describe('定年と跡継ぎ', () => {
  const atRetirement = (withSuccessor: boolean): GameState => {
    const s = createGame({ seed: 9 });
    s.bashoIndex = 5; // 九州場所
    s.oyakata[0]!.age = 64;
    if (withSuccessor) {
      s.oyakata.push({
        id: 99999,
        name: '白浦',
        shikona: '白山',
        age: 38,
        stableId: s.player.stableId,
        role: 'heyatsuki',
        style: 'oshi',
        highestRank: M(1),
        generation: null,
        fromRikishiId: null,
        waitingSince: null,
        since: 0,
      });
    }
    return advanceBasho(s);
  };

  it('部屋付きの親方がいなければ、定年で一門が途絶える', () => {
    expect(atRetirement(false).gameOver).toBe('noSuccessor');
  });

  it('跡継ぎを選ぶと次の代になり、家訓を1つ書き加える', () => {
    const s = atRetirement(true);
    expect(s.pending.successor).toEqual([99999]);
    expect(advanceBasho(s)).toBe(s); // 選ぶまで進めない
    const next = chooseSuccessor(s, 99999);
    expect(next.player.generation).toBe(2);
    expect(next.player.oyakataId).toBe(99999);
    expect(next.player.lineage).toHaveLength(2);
    expect(next.pending.kakun).toHaveLength(3);
    const k = next.pending.kakun![0]!;
    const done = pickKakun(next, k);
    expect(done.player.kakun).toEqual([k]);
    expect(done.pending.kakun).toBeNull();
  });
});
