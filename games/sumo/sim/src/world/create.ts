/**
 * ゲーム開始時の相撲界（架空の部屋と力士の番付全体・自分の部屋・自分の親方）
 */
import { RECRUIT, TOSHIYORI } from '../balance/career';
import { GAME } from '../balance/game';
import { START_MONEY } from '../balance/money';
import { divisionCounts } from '../banzuke/rank';
import { emptyCareer, makeCandidate, rikishiFromCandidate } from '../career/create';
import { createPrng, deriveSeed, SEED, type Prng } from '../core/prng';
import { clamp, round1 } from '../core/math';
import { makeShikona, makeToshiyoriName } from '../core/names';
import type {
  Division,
  GameState,
  Oyakata,
  Rank,
  Rikishi,
  Stable,
  Style,
  Title,
} from '../model/types';
import { DIVISIONS } from '../balance/banzuke';
import { ranksOf } from '../banzuke/rank';
import { applyHighest, applyMochikyukinMinimum } from '../career/update';
import { makeCandidates } from '../game/recruit';
import { addNode } from '../lineage/family';
import { NO_FACILITIES } from '../money/facilities';

/**
 * 1: MVP / 2: 系譜図・分家（stables.branch・oyakata.since・player.family・pending.independence/takeOver）
 * 3: 設備と契約（player.facilities）
 * 4: 場所の結果に番付の上がり下がりと巡業（lastReport.banzukeChanges・jungyo）
 * 5: 三賞と優勝決定戦（career.sansho・lastReport.sansho・playoff）
 * 6: けがを押して出場（rikishi.playHurt）
 * 7: 番付の推移と歴代の力士（rikishi.track・player.alumni）
 * 8: 場所の間の出来事（pending.happening・rikishi.boost）
 */
export const SAVE_VERSION = 8;

/** 段ごとの強さの目安（上端 → 下端）と年齢の幅 */
const TIERS: Record<Division, { top: number; bottom: number; age: [number, number] }> = {
  makuuchi: { top: 80, bottom: 63, age: [23, 34] },
  juryo: { top: 62, bottom: 57, age: [21, 33] },
  makushita: { top: 56, bottom: 47, age: [19, 31] },
  sandanme: { top: 46, bottom: 38, age: [17, 29] },
  jonidan: { top: 37, bottom: 28, age: [15, 30] },
  jonokuchi: { top: 27, bottom: 20, age: [15, 22] },
};

const STYLES: Style[] = ['oshi', 'yotsu', 'waza'];

export interface NewGameOptions {
  seed: number;
  /** 自分の親方の現役時代の型（選ばなければ乱数） */
  oyakataStyle?: Style;
}

export function createGame(options: NewGameOptions): GameState {
  const { seed } = options;
  const rng = createPrng(deriveSeed(seed, SEED.world));
  const nameRng = createPrng(deriveSeed(seed, SEED.names));
  const usedNames = new Set<string>();
  const usedToshiyori = new Set<string>();
  let nextId = 1;

  // 部屋（0 番目が自分の部屋）
  const stables: Stable[] = [];
  const playerOyakataName = makeToshiyoriName(nameRng, usedToshiyori);
  usedToshiyori.add(playerOyakataName);
  const oyakataStyle = options.oyakataStyle ?? rng.pick(STYLES);
  const playerStable: Stable = {
    id: nextId++,
    name: playerOyakataName,
    isPlayer: true,
    style: oyakataStyle,
    branch: null,
  };
  stables.push(playerStable);
  for (let i = 0; i < GAME.npcStables; i++) {
    const name = makeToshiyoriName(nameRng, usedToshiyori);
    usedToshiyori.add(name);
    stables.push({ id: nextId++, name, isPlayer: false, style: rng.pick(STYLES), branch: null });
  }
  const npcStables = stables.slice(1);

  // 架空の力士で番付を埋める（自分の弟子は下に足す）
  const total = RECRUIT.npcPerYearTarget - GAME.startDisciples;
  const counts = divisionCounts(total + GAME.startDisciples);
  const rikishi: Rikishi[] = [];
  const foreignIn = new Set<number>();

  for (const division of DIVISIONS) {
    const n = division === 'jonokuchi' ? counts[division] - GAME.startDisciples : counts[division];
    const tier = TIERS[division];
    for (let i = 0; i < n; i++) {
      const t = n <= 1 ? tier.top : tier.top - ((tier.top - tier.bottom) * i) / (n - 1);
      const stable = rng.pick(npcStables);
      const foreign = !foreignIn.has(stable.id) && rng.chance(0.05);
      if (foreign) foreignIn.add(stable.id);
      const name = makeShikona(nameRng, usedNames);
      usedNames.add(name);
      rikishi.push(makeVeteran(rng, nextId++, name, stable.id, division, t, tier.age, foreign));
    }
  }

  // 自分の部屋の弟子（序ノ口の下）。親方の一字を入れた四股名
  const oyakataShikona = makeShikona(nameRng, usedNames);
  usedNames.add(oyakataShikona);
  for (let i = 0; i < GAME.startDisciples; i++) {
    const name = makeShikona(nameRng, usedNames, [...oyakataShikona][0]);
    usedNames.add(name);
    const c = makeCandidate(rng, nextId++, name, 0, false);
    const r = rikishiFromCandidate(c, playerStable.id, oyakataStyle);
    rikishi.push(r);
  }

  // 番付: 作った順（強い順）。幕内の地位は上から 横綱2・大関3・関脇2・小結2
  const banzuke = rikishi.map((r) => r.id);
  const titles: Record<number, Title> = {};
  const titleSlots: Title[] = ['Y', 'Y', 'O', 'O', 'O', 'S', 'S', 'K', 'K'];
  titleSlots.forEach((t, i) => (titles[banzuke[i]!] = t));
  const ranks = ranksOf(banzuke, titles);
  banzuke.forEach((id, i) => {
    const r = rikishi.find((x) => x.id === id)!;
    const rank = ranks.get(id)!;
    seedCareer(rng, r, rank);
    applyMochikyukinMinimum(r, rank);
    applyHighest(r, rank, i);
  });

  const oyakata: Oyakata = {
    id: nextId++,
    name: playerOyakataName,
    shikona: oyakataShikona,
    age: TOSHIYORI.startAge,
    stableId: playerStable.id,
    role: 'master',
    style: oyakataStyle,
    highestRank: {
      division: 'makuuchi',
      title: rng.pick(['S', 'K', 'K'] as const),
      number: 1,
      side: 'E',
    },
    generation: 1,
    fromRikishiId: null,
    waitingSince: null,
    since: 0,
  };

  const state: GameState = {
    version: SAVE_VERSION,
    seed,
    bashoIndex: 0,
    rikishi,
    banzuke,
    titles,
    stables,
    oyakata: [oyakata],
    player: {
      stableId: playerStable.id,
      oyakataId: oyakata.id,
      generation: 1,
      stableMoney: START_MONEY.stable,
      personalMoney: START_MONEY.personal,
      prestige: 0,
      kakun: [],
      lineage: [
        {
          generation: 1,
          oyakataId: oyakata.id,
          name: oyakata.name,
          shikona: oyakata.shikona,
          fromBashoIndex: 0,
          toBashoIndex: null,
          sekitori: 0,
          sanyaku: 0,
          yokozuna: 0,
          makuuchiYusho: 0,
        },
      ],
      family: [],
      facilities: { ...NO_FACILITIES },
      alumni: [],
    },
    toshiyoriFree: 4,
    nextId,
    pending: {
      candidates: [],
      retireRequests: [],
      successor: null,
      kakun: null,
      independence: null,
      takeOver: null,
      happening: null,
    },
    gameOver: null,
    lastReport: null,
  };
  addNode(state, {
    name: oyakata.name,
    shikona: oyakata.shikona,
    parentId: null,
    stableId: playerStable.id,
    kind: 'master',
    oyakataId: oyakata.id,
    fromBashoIndex: 0,
    toBashoIndex: null,
    highestRank: oyakata.highestRank,
  });
  state.pending.candidates = makeCandidates(state);
  return state;
}

/** 番付の位置に合う架空の力士（強さ t の目安に合わせる） */
function makeVeteran(
  rng: Prng,
  id: number,
  name: string,
  stableId: number,
  division: Division,
  t: number,
  ageRange: [number, number],
  foreign: boolean,
): Rikishi {
  const age = rng.range(ageRange[0], ageRange[1]);
  const style = rng.pick(STYLES);
  const height = rng.range(172, 194);
  const heavy = division === 'makuuchi' || division === 'juryo';
  const weight = clamp(rng.range(heavy ? 135 : 95, heavy ? 185 : 150), 70, height - 10);
  const x = t + rng.range(-3, 3) - clamp((weight - 140) * 0.08, -6, 6);
  const abilities = {
    oshi: round1(x - 4 + rng.range(0, 3)),
    yotsu: round1(x - 4 + rng.range(0, 3)),
    waza: round1(x - 4 + rng.range(0, 3)),
  };
  abilities[style] = round1(abilities[style] + 9);
  const peakAge = rng.range(25, 30);
  const best = Math.max(abilities.oshi, abilities.yotsu, abilities.waza);
  // 若い力士は伸びしろがある
  const talent = clamp(
    Math.round(best + (age < peakAge ? rng.range(2, 12) : rng.range(0, 3))),
    20,
    100,
  );
  return {
    id,
    name,
    stableId,
    age,
    height,
    weight,
    abilities,
    talent,
    peakAge,
    fragility: rng.range(10, 90) / 100,
    fatigue: rng.range(0, 30),
    injury: 0,
    foreign,
    policy: style,
    career: emptyCareer(),
    recent: [],
    exOzeki: false,
    playHurt: false,
    track: [],
    boost: 1,
  };
}

/** 開始時の経歴（年齢と地位からの目安。年寄名跡の資格などに使う） */
function seedCareer(rng: Prng, r: Rikishi, rank: Rank) {
  const years = Math.max(0, r.age - 16);
  const c = r.career;
  c.basho = years * 6;
  if (rank.division === 'makuuchi') {
    c.makuuchiBasho = rng.range(1, Math.max(1, (r.age - 22) * 5));
    c.sekitoriBasho = c.makuuchiBasho + rng.range(0, 12);
    if (rank.title && rank.title !== 'M') c.sanyakuBasho = rng.range(1, 15);
  } else if (rank.division === 'juryo') {
    c.sekitoriBasho = rng.range(1, Math.max(1, (r.age - 21) * 3));
  }
}
