/**
 * 系譜図と分家（独立・分家の代替わり・閉鎖・分家を継ぐ）
 *
 * どれも state を直接変える（呼び出し側でコピー済み）。
 */
import { LINEAGE } from '../balance/lineage';
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

/** 独立を認める: 新しい部屋（分家）を開き、選んだ内弟子を連れて出る。親方はそのまま新しい部屋の師匠になる */
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
  // 部屋付きの節は分家の師匠の節に引き継ぐ（同じ人。系譜図では分家の節だけを見せる）
  if (node) state.player.family = state.player.family.filter((n) => n.id !== node.id);
  const parent = state.stables.find((s) => s.id === state.player.stableId)!;
  state.stables.push({
    id: stableId,
    name: oyakata.name,
    isPlayer: false,
    style: oyakata.style,
    ichimonId: parent.ichimonId,
    branch: { parentStableId: parent.id, nodeId: branchNode.id },
  });
  const allowed = new Set(takeIds.slice(0, LINEAGE.maxTakeDisciples));
  for (const r of state.rikishi) {
    if (r.stableId === state.player.stableId && allowed.has(r.id)) r.stableId = stableId;
  }
  oyakata.role = 'master';
  oyakata.stableId = stableId;
  oyakata.since = state.bashoIndex;
  state.pending.retireRequests = state.pending.retireRequests.filter((id) =>
    state.rikishi.some((r) => r.id === id && r.stableId === state.player.stableId),
  );
}

/**
 * 本家の跡継ぎがいないとき、分家を継ぐ: 本家は閉じ、力士と親方衆は分家へ移る。分家の師匠として次の代を操作する
 * （前の師匠は参与として分家に残るか、協会を去る）
 */
export function takeOverBranch(
  state: GameState,
  stableId: number,
  retireOld: (o: Oyakata) => void,
): void {
  const branch = state.stables.find((s) => s.id === stableId && s.branch);
  if (!branch?.branch) return;
  const master = state.oyakata.find((o) => o.stableId === stableId && o.role === 'master');
  if (!master) return;
  const oldStable = state.player.stableId;
  const oldMaster = state.oyakata.find((o) => o.id === state.player.oyakataId)!;
  closeNode(state, nodeOfOyakata(state, oldMaster.id));
  for (const r of state.rikishi) if (r.stableId === oldStable) r.stableId = stableId;
  for (const o of state.oyakata) if (o.stableId === oldStable) o.stableId = stableId;
  state.stables = state.stables.filter((s) => s.id !== oldStable);
  retireOld(oldMaster);
  const node = state.player.family.find((n) => n.id === branch.branch!.nodeId);
  if (node) {
    node.kind = 'master';
    node.oyakataId = master.id;
  }
  master.generation = state.player.generation + 1;
  branch.isPlayer = true;
  branch.branch = null;
  state.player.stableId = stableId;
  state.player.oyakataId = master.id;
}
