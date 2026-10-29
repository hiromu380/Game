/**
 * 系譜図と分家（独立・分家の代替わり・閉鎖・分家を継ぐ）
 *
 * どれも state を直接変える（呼び出し側でコピー済み）。
 */
import { TOSHIYORI } from '../balance/career';
import { stableCapacity } from '../money/facilities';
import { LINEAGE } from '../balance/lineage';
import { makeShikona } from '../core/names';
import { createPrng, deriveSeed, SEED } from '../core/prng';
import type { FamilyNode, GameState, Oyakata } from '../model/types';

export function addNode(
  state: GameState,
  node: Omit<FamilyNode, 'id' | 'sekitori' | 'sanyaku' | 'yokozuna' | 'makuuchiYusho'>,
): FamilyNode {
  const full: FamilyNode = {
    ...node,
    id: state.nextId++,
    sekitori: 0,
    sanyaku: 0,
    yokozuna: 0,
    makuuchiYusho: 0,
  };
  state.player.family.push(full);
  return full;
}

export function nodeOfOyakata(state: GameState, oyakataId: number): FamilyNode | undefined {
  return state.player.family.find((n) => n.oyakataId === oyakataId && n.toBashoIndex === null);
}

/** その部屋の今の師匠の節（一門の部屋でなければ undefined） */
export function masterNodeOf(state: GameState, stableId: number): FamilyNode | undefined {
  if (stableId === state.player.stableId) return nodeOfOyakata(state, state.player.oyakataId);
  const s = state.stables.find((x) => x.id === stableId);
  return s?.branch ? state.player.family.find((n) => n.id === s.branch!.nodeId) : undefined;
}

export function closeNode(state: GameState, node: FamilyNode | undefined): void {
  if (!node) return;
  node.kind = 'gone';
  node.toBashoIndex = state.bashoIndex;
}

/** 年の終わりに、部屋付きの親方から独立の申し出があるか */
export function rollIndependence(state: GameState): void {
  if (state.pending.independence !== null) return;
  const rng = createPrng(deriveSeed(state.seed, SEED.lineage, state.bashoIndex, 0));
  const ready = state.oyakata.filter(
    (o) =>
      o.stableId === state.player.stableId &&
      o.role === 'heyatsuki' &&
      o.age >= LINEAGE.independenceAgeMin &&
      o.age <= LINEAGE.independenceAgeMax &&
      state.bashoIndex - o.since >= LINEAGE.independenceAfterBasho &&
      o.highestRank?.division === LINEAGE.independenceMinDivision,
  );
  for (const o of ready) {
    if (rng.chance(LINEAGE.independenceChancePerYear)) {
      state.pending.independence = o.id;
      return;
    }
  }
}

/** 独立を認める: 新しい部屋（分家）を開き、選んだ内弟子を連れて出る */
export function approveIndependence(
  state: GameState,
  oyakata: Oyakata,
  takeIds: readonly number[],
): void {
  const stableId = state.nextId++;
  const node = nodeOfOyakata(state, oyakata.id);
  const branchNode = addNode(state, {
    name: oyakata.name,
    shikona: oyakata.shikona,
    parentId: node?.parentId ?? null,
    stableId,
    kind: 'branch',
    oyakataId: null,
    fromBashoIndex: state.bashoIndex,
    toBashoIndex: null,
    highestRank: oyakata.highestRank,
  });
  // 部屋付きの節はここで閉じ、分家の師匠の節に引き継ぐ（同じ人。系譜図では分家の節だけを見せる）
  if (node) {
    branchNode.parentId = node.parentId;
    state.player.family = state.player.family.filter((n) => n.id !== node.id);
  }
  state.stables.push({
    id: stableId,
    name: oyakata.name,
    isPlayer: false,
    style: oyakata.style,
    branch: {
      parentStableId: state.player.stableId,
      masterShikona: oyakata.shikona,
      masterAge: oyakata.age,
      nodeId: branchNode.id,
    },
  });
  const allowed = new Set(takeIds.slice(0, LINEAGE.maxTakeDisciples));
  for (const r of state.rikishi) {
    if (r.stableId === state.player.stableId && allowed.has(r.id)) r.stableId = stableId;
  }
  state.oyakata = state.oyakata.filter((o) => o.id !== oyakata.id);
  state.pending.retireRequests = state.pending.retireRequests.filter((id) =>
    state.rikishi.some((r) => r.id === id && r.stableId === state.player.stableId),
  );
}

/** 年の終わり: 分家の親方の年齢と、定年のときの代替わり・閉鎖 */
export function ageBranches(state: GameState): void {
  const rng = createPrng(deriveSeed(state.seed, SEED.lineage, state.bashoIndex, 1));
  for (const s of [...state.stables]) {
    if (!s.branch) continue;
    s.branch.masterAge++;
    if (s.branch.masterAge < TOSHIYORI.retireAge) continue;
    const old = state.player.family.find((n) => n.id === s.branch!.nodeId);
    closeNode(state, old);
    if (rng.chance(LINEAGE.branchSuccessionChance)) {
      const used = new Set(state.rikishi.map((r) => r.name));
      const shikona = makeShikona(rng, used);
      const next = addNode(state, {
        name: s.name,
        shikona,
        parentId: old?.id ?? null,
        stableId: s.id,
        kind: 'branch',
        oyakataId: null,
        fromBashoIndex: state.bashoIndex,
        toBashoIndex: null,
        highestRank: null,
      });
      s.branch.masterShikona = shikona;
      s.branch.masterAge = rng.range(LINEAGE.branchSuccessorAge[0], LINEAGE.branchSuccessorAge[1]);
      s.branch.nodeId = next.id;
    } else {
      closeBranch(state, s.id);
    }
  }
}

/** 分家を閉じる: 力士は本家（入りきらなければ他の部屋）へ移る */
export function closeBranch(state: GameState, stableId: number): void {
  const rng = createPrng(deriveSeed(state.seed, SEED.lineage, state.bashoIndex, stableId));
  const others = state.stables.filter((x) => !x.isPlayer && !x.branch && x.id !== stableId);
  let mine = state.rikishi.filter((r) => r.stableId === state.player.stableId).length;
  for (const r of state.rikishi) {
    if (r.stableId !== stableId) continue;
    if (mine < stableCapacity(state)) {
      r.stableId = state.player.stableId;
      mine++;
    } else {
      r.stableId = rng.pick(others).id;
    }
  }
  state.stables = state.stables.filter((x) => x.id !== stableId);
}

/** 本家の跡継ぎがいないとき、分家を継ぐ: 本家は閉じ、力士は分家へ移る。分家の親方として次の代を操作する */
export function takeOverBranch(state: GameState, stableId: number): void {
  const branch = state.stables.find((s) => s.id === stableId && s.branch);
  if (!branch?.branch) return;
  const oldStable = state.player.stableId;
  closeNode(state, nodeOfOyakata(state, state.player.oyakataId));
  state.oyakata = state.oyakata.filter((o) => o.stableId !== oldStable);
  for (const r of state.rikishi) if (r.stableId === oldStable) r.stableId = stableId;
  state.stables = state.stables.filter((s) => s.id !== oldStable);
  const oyakataId = state.nextId++;
  const node = state.player.family.find((n) => n.id === branch.branch!.nodeId);
  state.oyakata.push({
    id: oyakataId,
    name: branch.name,
    shikona: branch.branch.masterShikona,
    age: branch.branch.masterAge,
    stableId,
    role: 'master',
    style: branch.style,
    highestRank: node?.highestRank ?? null,
    generation: state.player.generation + 1,
    fromRikishiId: null,
    waitingSince: null,
    since: node?.fromBashoIndex ?? state.bashoIndex,
  });
  if (node) {
    node.kind = 'master';
    node.oyakataId = oyakataId;
  }
  branch.isPlayer = true;
  branch.branch = null;
  state.player.stableId = stableId;
  state.player.oyakataId = oyakataId;
}
