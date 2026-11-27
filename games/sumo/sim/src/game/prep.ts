/**
 * 場所前の4週間: 親方が毎週1つ行動を選ぶ（個別指導・申し合い・出稽古・休ませる・挨拶回り・スカウト回り・いつも通り）。
 * 結果はその場で弟子に効き、state.prep.log に残る。場所を進めると、はじめからになる（advance.ts）。
 * 乱数は用途別の流れ（SEED.prep。場所と週で決まる）。本場所・稽古の乱数の並びは変えない
 */
import { GROWTH } from '../balance/growth';
import { KOENKAI } from '../balance/koenkai';
import { PREP } from '../balance/prep';
import { isSekitori, ranksOf } from '../banzuke/rank';
import { extraTraining } from '../career/growth';
import { tagInjuries } from '../career/injury';
import { fragilityOf } from '../career/traits';
import { WALL } from '../balance/wall';
import { breakWall } from '../career/wall';
import { clamp, round1 } from '../core/math';
import { createPrng, deriveSeed, SEED } from '../core/prng';
import type { GameState, PrepAction, Rikishi, Style, WeekResult } from '../model/types';
import { canVisit } from '../stable/koenkai';
import { playerGrowth } from './advance';
import { note } from './journal';
import { canScout, goScouting } from './recruit';
import { isBlocked } from './state';
import { canAfford, pay } from '../money/pay';
import { tideDef, tideOf } from './tide';

const STYLES: Style[] = ['oshi', 'yotsu', 'waza'];

/** 残りの週 */
export function prepLeft(state: Pick<GameState, 'prep'>): number {
  return Math.max(0, PREP.weeks - state.prep.week);
}

const mine = (state: GameState, id: number): Rikishi | undefined =>
  state.rikishi.find((r) => r.id === id && r.stableId === state.player.stableId);

/** 稽古に出られる（けがをしていない） */
const fit = (r: Rikishi | undefined): r is Rikishi => r !== undefined && r.injury === 0;

/** 今週の費用（好機でただになることがある） */
export function costOf(
  state: Pick<GameState, 'seed' | 'bashoIndex' | 'prep'>,
  kind: 'mune' | 'degeiko',
): number {
  return tideDef(tideOf(state, state.prep.week + 1))?.free === kind ? 0 : PREP[kind].cost;
}

/** その行動を今週選べるか（週が残っていて、相手・お金・条件がそろっている） */
export function canPrep(state: GameState, action: PrepAction): boolean {
  if (state.gameOver || isBlocked(state) || prepLeft(state) === 0) return false;
  switch (action.kind) {
    case 'coach':
      return fit(mine(state, action.id)) && mine(state, action.id)!.policy !== 'rest';
    case 'spar':
      return action.a !== action.b && fit(mine(state, action.a)) && fit(mine(state, action.b));
    case 'mune':
      return (
        fit(mine(state, action.id)) &&
        mine(state, action.id)!.policy !== 'rest' &&
        canAfford(state, costOf(state, 'mune'))
      );
    case 'degeiko':
      return (
        canAfford(state, costOf(state, 'degeiko')) &&
        state.rikishi.some((r) => r.stableId === state.player.stableId && r.injury === 0)
      );
    case 'visit': {
      const p = state.player.koenkai.patrons.find((x) => x.id === action.patronId);
      return (
        p !== undefined &&
        canVisit(p, state.bashoIndex) &&
        state.player.personalMoney >= KOENKAI.visitCost
      );
    }
    case 'scout':
      return canScout(state, action.trip);
    case 'rest':
    case 'usual':
      return true;
  }
}

/** 今週の行動をする。選べない行動なら、何も変えない */
export function doPrep(input: GameState, action: PrepAction): GameState {
  if (!canPrep(input, action)) return input;
  const state: GameState = JSON.parse(JSON.stringify(input));
  const week = state.prep.week + 1;
  const rng = createPrng(deriveSeed(state.seed, SEED.prep, state.bashoIndex, week));
  const { playerCtx, lowerCtx } = playerGrowth(state);
  const ranks = ranksOf(state.banzuke, state.titles);
  const ctxOf = (r: Rikishi) => {
    const rank = ranks.get(r.id);
    return rank && isSekitori(rank) ? playerCtx : lowerCtx;
  };
  // 今週の好機・逆風（効く行動の伸び・疲れ・けがに掛かる）
  const tideId = tideOf(state, week);
  const tide = tideDef(tideId);
  const hard =
    action.kind === 'coach' ||
    action.kind === 'spar' ||
    action.kind === 'mune' ||
    action.kind === 'degeiko';
  const mult = hard ? (tide?.[action.kind as 'coach' | 'spar' | 'mune' | 'degeiko'] ?? 1) : 1;
  const tired = tide?.fatigue ?? 1;
  const risky = tide?.injury ?? 1;
  const result: WeekResult = {
    week,
    action,
    gains: [],
    injured: [],
    ...(tideId ? { tide: tideId } : {}),
  };
  /** 弟子に稽古をつけて、動いた量を残す */
  const work = (r: Rikishi, f: () => void, fatigue: number) => {
    const before = { ...r.abilities, weight: r.weight, fatigue: r.fatigue };
    f();
    r.fatigue = clamp(r.fatigue + fatigue * (fatigue > 0 ? tired : (tide?.rest ?? 1)), 0, 100);
    result.gains.push({
      id: r.id,
      oshi: round1(r.abilities.oshi - before.oshi),
      yotsu: round1(r.abilities.yotsu - before.yotsu),
      waza: round1(r.abilities.waza - before.waza),
      weight: round1(r.weight - before.weight),
      fatigue: Math.round(r.fatigue - before.fatigue),
    });
  };
  const all = state.rikishi.filter((r) => r.stableId === state.player.stableId);
  /** 壁に当たった弟子に負荷をかけると、素質が上がる（稽古の後・けがの前に見る） */
  const wall = (r: Rikishi, amount: number) => {
    const inc = breakWall(r, amount * mult);
    if (inc > 0) result.walls = [...(result.walls ?? []), { id: r.id, inc }];
  };
  switch (action.kind) {
    case 'coach': {
      const r = mine(state, action.id)!;
      work(
        r,
        () => {
          if (r.policy === 'body') {
            const cap = r.height - GROWTH.weightCapOffset;
            if (r.age < 32) r.weight = round1(Math.min(cap, r.weight + PREP.coach.bodyKg));
            for (const s of STYLES) extraTraining(r, ctxOf(r), s, PREP.coach.bodyGain * mult);
          } else if (r.policy !== 'rest') {
            extraTraining(r, ctxOf(r), r.policy, PREP.coach.gain * mult);
          }
        },
        PREP.coach.fatigue,
      );
      wall(r, WALL.coach);
      break;
    }
    case 'spar': {
      const a = mine(state, action.a)!;
      const b = mine(state, action.b)!;
      const power = (r: Rikishi) => r.abilities.oshi + r.abilities.yotsu + r.abilities.waza;
      const [pa, pb] = [power(a), power(b)];
      for (const [r, stronger] of [
        [a, pb > pa],
        [b, pa > pb],
      ] as const) {
        const key: Style = r.policy === 'body' || r.policy === 'rest' ? 'yotsu' : r.policy;
        work(
          r,
          () =>
            extraTraining(
              r,
              ctxOf(r),
              key,
              PREP.spar.gain * mult * (stronger ? PREP.spar.strongerBonus : 1),
            ),
          PREP.spar.fatigue,
        );
        wall(r, WALL.spar);
        // 申し合いのけが
        if (rng.chance(PREP.spar.injury * risky * fragilityOf(r) * ctxOf(r).injuryMultiplier)) {
          r.injury = rng.range(GROWTH.injuryBashoMin, GROWTH.injuryBashoMax);
          result.injured.push(r.id);
        }
      }
      tagInjuries(state);
      break;
    }
    case 'mune': {
      const r = mine(state, action.id)!;
      pay(state, costOf(input, 'mune'));
      const key: Style = r.policy === 'body' || r.policy === 'rest' ? 'yotsu' : r.policy;
      work(r, () => extraTraining(r, ctxOf(r), key, PREP.mune.gain * mult), PREP.mune.fatigue);
      wall(r, WALL.mune);
      if (rng.chance(PREP.mune.injury * risky * fragilityOf(r) * ctxOf(r).injuryMultiplier)) {
        r.injury = rng.range(GROWTH.injuryBashoMin, GROWTH.injuryBashoMax);
        result.injured.push(r.id);
        tagInjuries(state);
      }
      break;
    }
    case 'degeiko':
      pay(state, costOf(input, 'degeiko'));
      for (const r of all) {
        if (r.injury > 0) continue;
        work(
          r,
          () => {
            for (const s of STYLES) extraTraining(r, ctxOf(r), s, PREP.degeiko.gain * mult);
          },
          PREP.degeiko.fatigue,
        );
      }
      break;
    case 'rest':
      for (const r of all) work(r, () => {}, PREP.rest.fatigue);
      break;
    case 'visit': {
      const p = state.player.koenkai.patrons.find((x) => x.id === action.patronId)!;
      p.favor = Math.min(100, p.favor + KOENKAI.visitFavor * (tide?.visit ?? 1));
      p.visitedAt = state.bashoIndex;
      state.player.personalMoney -= KOENKAI.visitCost;
      break;
    }
    case 'scout': {
      result.met = goScouting(state, action.trip, {
        talent: tide?.scoutTalent,
        count: tide?.scoutCount,
      });
      note(state, { kind: 'scout', trip: action.trip, count: result.met });
      break;
    }
    case 'usual':
      break;
  }
  state.prep = { week, log: [...state.prep.log, result] };
  return state;
}

/**
 * 場所前の4週間の稽古の要約（場所の結果に残す。場所を進めると state.prep は空に戻るので）。
 * 休ませる・挨拶回り・スカウト・いつも通りの週は数えない。伸びは押し・四つ・技の合計
 */
export function prepSummary(
  log: readonly WeekResult[],
): { id: number; gain: number; walls: number; weeks: number }[] {
  const by = new Map<number, { id: number; gain: number; walls: number; weeks: number }>();
  for (const w of log) {
    const k = w.action.kind;
    if (k !== 'coach' && k !== 'spar' && k !== 'mune' && k !== 'degeiko') continue;
    for (const g of w.gains) {
      const x = by.get(g.id) ?? { id: g.id, gain: 0, walls: 0, weeks: 0 };
      x.gain = Math.round((x.gain + g.oshi + g.yotsu + g.waza) * 10) / 10;
      x.weeks++;
      by.set(g.id, x);
    }
    for (const wall of w.walls ?? []) {
      const x = by.get(wall.id);
      if (x) x.walls++;
    }
  }
  return [...by.values()];
}
