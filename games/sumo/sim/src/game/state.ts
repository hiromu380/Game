/**
 * 状態の補助と、プレイヤーの操作（場所前の判断）
 *
 * 操作はどれも入力の state を変えず、コピーして返す。
 */
import { TOSHIYORI } from '../balance/career';
import { FACILITIES } from '../balance/facilities';
import { GAME } from '../balance/game';
import { rikishiFromCandidate } from '../career/create';
import { createPrng, deriveSeed, SEED } from '../core/prng';
import { KAKUN_IDS } from '../lineage/kakun';
import {
  addNode,
  approveIndependence,
  closeNode,
  nodeOfOyakata,
  takeOverBranch,
} from '../lineage/family';
import { eligibleForToshiyori } from '../lineage/toshiyori';
import { makeToshiyoriName } from '../core/names';
import { styleOf } from '../career/create';
import type {
  BashoReport,
  FacilityId,
  GameState,
  KakunId,
  LineageEntry,
  Policy,
} from '../model/types';
import { nextBuildCost, stableCapacity } from '../money/facilities';

const clone = (s: GameState): GameState => JSON.parse(JSON.stringify(s));

/** 跡継ぎ・家訓の選択が済むまで場所を進められない */
export function isBlocked(state: GameState): boolean {
  return (
    state.pending.successor !== null ||
    state.pending.kakun !== null ||
    state.pending.takeOver !== null
  );
}

export function currentLineage(state: GameState): LineageEntry {
  return state.player.lineage[state.player.lineage.length - 1]!;
}

/**
 * 力士を引退させる（state を直接変える）。
 * 年寄名跡の資格があれば親方として協会に残る:
 * - 自分の弟子: 名跡が空いていれば部屋付きの親方。空いていなければ「名跡待ち」（空いたら先に回る。待てる年数に上限）
 * - 他の部屋の資格者: 名跡が空いていれば一定の確率で取る
 */
export function retireRikishi(state: GameState, id: number, report: BashoReport | null): void {
  const r = state.rikishi.find((x) => x.id === id);
  if (!r) return;
  const mine = r.stableId === state.player.stableId;
  let becameOyakata = false;
  if (eligibleForToshiyori(r) && mine) {
    const free = state.toshiyoriFree > 0;
    const oyakataId = state.nextId++;
    state.oyakata.push({
      id: oyakataId,
      name: free ? newToshiyoriName(state, id) : '',
      shikona: r.name,
      age: r.age,
      stableId: r.stableId,
      role: free ? 'heyatsuki' : 'waiting',
      style: styleOf(r.abilities),
      highestRank: r.career.highestRank,
      generation: null,
      fromRikishiId: r.id,
      waitingSince: free ? null : state.bashoIndex,
      since: state.bashoIndex,
    });
    addNode(state, {
      name: state.oyakata[state.oyakata.length - 1]!.name,
      shikona: r.name,
      parentId: nodeOfOyakata(state, state.player.oyakataId)?.id ?? null,
      stableId: r.stableId,
      kind: free ? 'heyatsuki' : 'waiting',
      oyakataId,
      fromBashoIndex: state.bashoIndex,
      toBashoIndex: null,
      highestRank: r.career.highestRank,
    });
    if (free) state.toshiyoriFree--;
    becameOyakata = true;
  } else if (eligibleForToshiyori(r) && state.toshiyoriFree > 0) {
    const rng = createPrng(deriveSeed(state.seed, SEED.toshiyori, state.bashoIndex, id));
    if (rng.chance(TOSHIYORI.npcTakeChance)) {
      state.toshiyoriFree--;
      becameOyakata = true;
    }
  }
  report?.retired.push({ id, name: r.name, stableId: r.stableId, becameOyakata });
  if (mine && r.career.basho > 0) {
    state.player.alumni.push({
      id: r.id,
      name: r.name,
      retiredAge: r.age,
      retiredBashoIndex: state.bashoIndex,
      generation: state.player.generation,
      becameOyakata,
      foreign: r.foreign,
      career: r.career,
      track: r.track,
    });
  }
  state.rikishi = state.rikishi.filter((x) => x.id !== id);
  state.banzuke = state.banzuke.filter((x) => x !== id);
  delete state.titles[id];
  state.pending.retireRequests = state.pending.retireRequests.filter((x) => x !== id);
}

export function newToshiyoriName(state: GameState, salt: number): string {
  const rng = createPrng(deriveSeed(state.seed, SEED.toshiyori, state.bashoIndex, salt));
  const used = new Set([...state.oyakata.map((o) => o.name), ...state.stables.map((s) => s.name)]);
  return makeToshiyoriName(rng, used);
}

/** 稽古の方針を決める（自分の弟子だけ） */
export function setPolicy(input: GameState, id: number, policy: Policy): GameState {
  const state = clone(input);
  const r = state.rikishi.find((x) => x.id === id);
  if (r && r.stableId === state.player.stableId) r.policy = policy;
  return state;
}

/** けがをしている自分の弟子を、次の場所に出すか（強行出場）休ませるか */
export function setPlayHurt(input: GameState, id: number, playHurt: boolean): GameState {
  const r = input.rikishi.find((x) => x.id === id);
  if (!r || r.stableId !== input.player.stableId || r.injury === 0) return input;
  const state = clone(input);
  state.rikishi.find((x) => x.id === id)!.playHurt = playHurt;
  return state;
}

/** 入門希望者を受け入れる（次の場所は前相撲、その次から番付に載る） */
export function acceptCandidate(input: GameState, candidateId: number): GameState {
  const state = clone(input);
  const c = state.pending.candidates.find((x) => x.id === candidateId);
  if (!c) return input;
  const mine = state.rikishi.filter((r) => r.stableId === state.player.stableId);
  if (c.foreign && mine.some((r) => r.foreign)) return input; // 外国出身は1部屋1人
  if (mine.length >= stableCapacity(state)) return input; // 部屋に住めない
  const master = state.oyakata.find((o) => o.id === state.player.oyakataId)!;
  state.rikishi.push(rikishiFromCandidate(c, state.player.stableId, master.style));
  state.pending.candidates = state.pending.candidates.filter((x) => x.id !== candidateId);
  return state;
}

export function declineCandidate(input: GameState, candidateId: number): GameState {
  const state = clone(input);
  state.pending.candidates = state.pending.candidates.filter((x) => x.id !== candidateId);
  return state;
}

/** 引退の申し出に答える（受け入れる → すぐ引退。慰留 → もう少し続ける） */
export function answerRetirement(input: GameState, id: number, accept: boolean): GameState {
  const state = clone(input);
  if (!state.pending.retireRequests.includes(id)) return input;
  if (accept) retireRikishi(state, id, null);
  else state.pending.retireRequests = state.pending.retireRequests.filter((x) => x !== id);
  return state;
}

/** 定年: 跡継ぎを選ぶ。選んだ親方が次の代として部屋を継ぐ */
export function chooseSuccessor(input: GameState, oyakataId: number): GameState {
  if (!input.pending.successor?.includes(oyakataId)) return input;
  const state = clone(input);
  const prev = state.player.oyakataId;
  const lineage = currentLineage(state);
  lineage.toBashoIndex = state.bashoIndex;
  closeNode(state, nodeOfOyakata(state, prev));
  state.oyakata = state.oyakata.filter((o) => o.id !== prev);
  const next = state.oyakata.find((o) => o.id === oyakataId)!;
  next.role = 'master';
  const nextNode = nodeOfOyakata(state, next.id);
  if (nextNode) nextNode.kind = 'master';
  state.player.generation++;
  next.generation = state.player.generation;
  state.player.oyakataId = next.id;
  state.player.lineage.push({
    generation: state.player.generation,
    oyakataId: next.id,
    name: next.name,
    shikona: next.shikona,
    fromBashoIndex: state.bashoIndex,
    toBashoIndex: null,
    sekitori: 0,
    sanyaku: 0,
    yokozuna: 0,
    makuuchiYusho: 0,
  });
  state.pending.successor = null;
  offerKakun(state);
  return state;
}

/** 本家の跡継ぎがいないとき、分家を継ぐ（次の代はその分家の親方） */
export function chooseTakeOver(input: GameState, stableId: number): GameState {
  if (!input.pending.takeOver?.includes(stableId)) return input;
  const state = clone(input);
  currentLineage(state).toBashoIndex = state.bashoIndex;
  takeOverBranch(state, stableId);
  const master = state.oyakata.find((o) => o.id === state.player.oyakataId)!;
  state.player.generation++;
  state.player.lineage.push({
    generation: state.player.generation,
    oyakataId: master.id,
    name: master.name,
    shikona: master.shikona,
    fromBashoIndex: state.bashoIndex,
    toBashoIndex: null,
    sekitori: 0,
    sanyaku: 0,
    yokozuna: 0,
    makuuchiYusho: 0,
  });
  state.pending.takeOver = null;
  offerKakun(state);
  return state;
}

/** 部屋付きの親方の独立の申し出に答える（認めるなら連れて行く内弟子を選ぶ） */
export function answerIndependence(
  input: GameState,
  accept: boolean,
  takeIds: readonly number[] = [],
): GameState {
  if (input.pending.independence === null) return input;
  const state = clone(input);
  const o = state.oyakata.find((x) => x.id === state.pending.independence);
  state.pending.independence = null;
  if (accept && o) approveIndependence(state, o, takeIds);
  return state;
}

/** 建物を1段上げる（部屋の口座から払う。足りなければ何もしない） */
export function buildFacility(input: GameState, id: FacilityId): GameState {
  const cost = nextBuildCost(input.player.facilities, id);
  if (cost === null || input.player.stableMoney < cost) return input;
  const state = clone(input);
  state.player.stableMoney -= cost;
  state.player.facilities[id]++;
  return state;
}

/** 契約のレベルを決める（0 で解約。費用は場所ごとに帳簿から払う） */
export function setContract(input: GameState, id: FacilityId, level: number): GameState {
  const def = FACILITIES[id];
  if (def.kind !== 'contract' || level < 0 || level > def.costs.length) return input;
  const state = clone(input);
  state.player.facilities[id] = level;
  return state;
}

/** 家訓の候補（まだ持っていないものから3つ） */
function offerKakun(state: GameState): void {
  const rng = createPrng(deriveSeed(state.seed, SEED.kakun, state.bashoIndex));
  const pool = KAKUN_IDS.filter((k) => !state.player.kakun.includes(k));
  const picks: KakunId[] = [];
  while (picks.length < 3 && pool.length > 0)
    picks.push(pool.splice(rng.nextInt(pool.length), 1)[0]!);
  state.pending.kakun = picks.length ? picks : null;
}

/** 家訓を書き加える（枠がいっぱいなら replaceIndex の家訓と入れ替える。書かないなら null） */
export function pickKakun(
  input: GameState,
  kakun: KakunId | null,
  replaceIndex?: number,
): GameState {
  if (!input.pending.kakun) return input;
  const state = clone(input);
  if (kakun && state.pending.kakun!.includes(kakun)) {
    if (state.player.kakun.length < GAME.kakunSlots) state.player.kakun.push(kakun);
    else if (
      replaceIndex !== undefined &&
      replaceIndex >= 0 &&
      replaceIndex < state.player.kakun.length
    ) {
      state.player.kakun[replaceIndex] = kakun;
    }
  }
  state.pending.kakun = null;
  return state;
}
