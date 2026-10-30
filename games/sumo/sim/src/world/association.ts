/**
 * 協会: 年寄名跡・一門・すべての部屋の親方（師匠・部屋付き・参与）の一生
 *
 * - 名跡は 105。持つ人がいなくなる（参与が 70歳になる・部屋付きが定年で辞める）と空く
 * - 師匠が 65歳になると、部屋付きの親方が継ぐ（名跡を交換して部屋の名前を残す）。継ぐ人がいなければ部屋を閉じ、力士は同じ一門の部屋へ
 * - 定年の親方は、参与として 70歳まで残ることがある（名跡を持ったまま）
 * - 部屋付きの親方は、ときどき独立して部屋を開く（同じ一門。自分の系譜の部屋から出れば分家）
 *
 * どれも state を直接変える（呼び出し側でコピー済み）。自分の部屋の師匠の定年（跡継ぎ選び）は game/advance.ts。
 */
import { ASSOCIATION } from '../balance/association';
import { TOSHIYORI } from '../balance/career';
import { LINEAGE } from '../balance/lineage';
import { rankValue } from '../banzuke/rank';
import { makeShikona, makeToshiyoriName } from '../core/names';
import type { Prng } from '../core/prng';
import type { GameState, Ichimon, Oyakata, Rank, Stable, Style } from '../model/types';
import { addNode, closeNode } from '../lineage/family';
import { stableCapacity } from '../money/facilities';

const STYLES: Style[] = ['oshi', 'yotsu', 'waza'];

export function freeNames(state: GameState): string[] {
  return state.names.filter((n) => n.holderId === null).map((n) => n.name);
}

/** 空いている名跡を1つ取る（なければ null） */
export function takeName(state: GameState, oyakataId: number, rng: Prng): string | null {
  const free = state.names.filter((n) => n.holderId === null);
  if (free.length === 0) return null;
  const n = rng.pick(free);
  n.holderId = oyakataId;
  return n.name;
}

export function releaseName(state: GameState, oyakataId: number): void {
  for (const n of state.names) if (n.holderId === oyakataId) n.holderId = null;
}

/** 2人の名跡を交換する（師匠を継ぐとき。部屋の名前＝師匠の名跡を残すため） */
export function swapNames(state: GameState, a: Oyakata, b: Oyakata): void {
  const na = state.names.find((n) => n.holderId === a.id);
  const nb = state.names.find((n) => n.holderId === b.id);
  if (na) na.holderId = b.id;
  if (nb) nb.holderId = a.id;
  [a.name, b.name] = [b.name, a.name];
}

export function masterOf(state: GameState, stableId: number): Oyakata | undefined {
  return state.oyakata.find((o) => o.stableId === stableId && o.role === 'master');
}

/** 現役時代の最高位（架空の親方。三役〜前頭） */
function rollHighest(rng: Prng): Rank {
  const title = rng.pick(['S', 'K', 'K', 'M', 'M', 'M'] as const);
  return {
    division: 'makuuchi',
    title,
    number: title === 'M' ? rng.range(1, 15) : 1,
    side: rng.chance(0.5) ? 'E' : 'W',
  };
}

function newOyakata(
  state: GameState,
  rng: Prng,
  stableId: number,
  role: Oyakata['role'],
  age: number,
  name: string,
  style?: Style,
): Oyakata {
  const used = new Set([
    ...state.rikishi.map((r) => r.name),
    ...state.oyakata.map((o) => o.shikona),
  ]);
  const o: Oyakata = {
    id: state.nextId++,
    name,
    shikona: makeShikona(rng, used),
    age,
    stableId,
    role,
    style: style ?? rng.pick(STYLES),
    highestRank: rollHighest(rng),
    generation: null,
    fromRikishiId: null,
    waitingSince: null,
    since: 0,
  };
  state.oyakata.push(o);
  return o;
}

/**
 * 一門・名跡・架空の部屋の親方を作る（ゲーム開始時と、古いセーブの変換で使う）。
 * 部屋の名前と、すでにいる親方の名跡はそのまま名跡に入れ、残りを作る
 */
export function populateAssociation(state: GameState, rng: Prng, playerIchimon?: number): void {
  // 一門: 5つ。名前は本家（最初に入る部屋）の名前から
  const npc = state.stables.filter((s) => !s.isPlayer && !s.branch);
  const heads = npc.slice(0, ASSOCIATION.ichimon);
  state.ichimon = heads.map((s, i): Ichimon => ({ id: i + 1, name: s.name }));
  // 一門の大きさに差をつける（本家の大きい一門ほど部屋が多い）
  const weights = [13, 11, 8, 6, 5];
  npc.forEach((s, i) => {
    if (i < heads.length) s.ichimonId = i + 1;
    else {
      const total = weights.reduce((a, b) => a + b, 0);
      let roll = rng.nextInt(total);
      s.ichimonId = weights.findIndex((w) => (roll -= w) < 0) + 1;
    }
  });
  const player = state.stables.find((s) => s.isPlayer)!;
  player.ichimonId = playerIchimon ?? rng.range(1, ASSOCIATION.ichimon);
  for (const s of state.stables) if (s.branch) s.ichimonId = player.ichimonId;

  // 名跡: 部屋の名前・いる親方の名跡 → 残りを作る
  const used = new Set<string>();
  state.names = [];
  const addName = (name: string, holderId: number | null) => {
    if (!name || used.has(name)) return;
    used.add(name);
    state.names.push({ name, holderId });
  };
  for (const o of state.oyakata) addName(o.name, o.id);
  // 架空の部屋の師匠（部屋の名前 = 師匠の名跡）
  for (const s of state.stables) {
    if (s.isPlayer || masterOf(state, s.id)) continue;
    const m = newOyakata(
      state,
      rng,
      s.id,
      'master',
      rng.range(ASSOCIATION.masterAge[0], ASSOCIATION.masterAge[1]),
      s.name,
      s.style,
    );
    addName(s.name, m.id);
  }
  while (state.names.length < ASSOCIATION.names) {
    addName(makeToshiyoriName(rng, used), null);
  }
  // 参与と部屋付きの親方で名跡を埋める（いくつかは空きで残す）
  const free = () => state.names.filter((n) => n.holderId === null);
  const npcStables = state.stables.filter((s) => !s.isPlayer);
  for (let i = 0; i < ASSOCIATION.startSanyo && free().length > ASSOCIATION.startFreeNames; i++) {
    const n = rng.pick(free());
    const o = newOyakata(
      state,
      rng,
      rng.pick(npcStables).id,
      'sanyo',
      rng.range(TOSHIYORI.retireAge, ASSOCIATION.sanyoUntil - 1),
      n.name,
    );
    n.holderId = o.id;
  }
  while (free().length > ASSOCIATION.startFreeNames) {
    const n = rng.pick(free());
    // 大きい一門の本家ほど部屋付きの親方が多い
    const s = rng.chance(0.3) ? rng.pick(heads) : rng.pick(npcStables);
    const o = newOyakata(
      state,
      rng,
      s.id,
      'heyatsuki',
      rng.range(ASSOCIATION.heyatsukiAge[0], ASSOCIATION.heyatsukiAge[1]),
      n.name,
    );
    n.holderId = o.id;
  }
}

/** 部屋を閉じる: 力士と親方は、分家なら独立元（入りきらなければ同じ一門）、ほかは同じ一門の部屋へ移る */
export function closeStable(state: GameState, stableId: number, rng: Prng): void {
  const s = state.stables.find((x) => x.id === stableId);
  if (!s) return;
  const sameIchimon = state.stables.filter(
    (x) => x.id !== stableId && x.ichimonId === s.ichimonId && !x.isPlayer,
  );
  const anyOther = state.stables.filter((x) => x.id !== stableId && !x.isPlayer);
  const fallback = () => rng.pick(sameIchimon.length ? sameIchimon : anyOther);
  const parent = s.branch
    ? state.stables.find((x) => x.id === s.branch!.parentStableId)
    : undefined;
  let toPlayer = 0;
  const room =
    stableCapacity(state) -
    state.rikishi.filter((r) => r.stableId === state.player.stableId).length;
  for (const r of state.rikishi) {
    if (r.stableId !== stableId) continue;
    if (parent?.isPlayer && toPlayer < room) {
      r.stableId = parent.id;
      toPlayer++;
    } else {
      r.stableId = (parent && !parent.isPlayer ? parent : fallback()).id;
    }
  }
  for (const o of state.oyakata) {
    if (o.stableId === stableId) o.stableId = (parent ?? fallback()).id;
  }
  state.stables = state.stables.filter((x) => x.id !== stableId);
}

/** 架空の部屋（分家を含む）の師匠の定年: 部屋付きが継ぐか、部屋を閉じる */
function retireNpcMaster(state: GameState, master: Oyakata, rng: Prng): void {
  const stable = state.stables.find((s) => s.id === master.stableId)!;
  const heirs = state.oyakata
    .filter(
      (o) => o.stableId === stable.id && o.role === 'heyatsuki' && o.age < TOSHIYORI.retireAge,
    )
    .sort(
      (a, b) =>
        (a.highestRank ? rankValue(a.highestRank) : 1e9) -
          (b.highestRank ? rankValue(b.highestRank) : 1e9) || a.age - b.age,
    );
  const heir = heirs[0];
  const oldNode = stable.branch
    ? state.player.family.find((n) => n.id === stable.branch!.nodeId)
    : undefined;
  if (heir) {
    swapNames(state, heir, master);
    heir.role = 'master';
    heir.since = state.bashoIndex;
    if (stable.branch) {
      closeNode(state, oldNode);
      const node = addNode(state, {
        name: heir.name,
        shikona: heir.shikona,
        parentId: oldNode?.id ?? null,
        stableId: stable.id,
        kind: 'branch',
        oyakataId: null,
        fromBashoIndex: state.bashoIndex,
        toBashoIndex: null,
        highestRank: heir.highestRank,
      });
      stable.branch.nodeId = node.id;
    }
  } else {
    if (stable.branch) closeNode(state, oldNode);
    closeStable(state, stable.id, rng);
  }
  retireOrSanyo(state, master, rng);
}

/** 定年: 参与として残る（名跡を持ったまま）か、協会を去る（名跡が空く）。系譜図の節はここで閉じる */
export function retireOrSanyo(state: GameState, o: Oyakata, rng: Prng): void {
  closeNode(
    state,
    state.player.family.find((n) => n.oyakataId === o.id && n.toBashoIndex === null),
  );
  if (rng.chance(ASSOCIATION.sanyoChance)) {
    o.role = 'sanyo';
  } else {
    releaseName(state, o.id);
    state.oyakata = state.oyakata.filter((x) => x.id !== o.id);
  }
}

/** 架空の部屋の部屋付き親方の独立 */
function npcIndependence(state: GameState, rng: Prng): void {
  for (const o of [...state.oyakata]) {
    if (state.stables.length >= ASSOCIATION.maxStables) return;
    const from = state.stables.find((s) => s.id === o.stableId);
    if (!from || from.isPlayer) continue;
    if (
      o.role !== 'heyatsuki' ||
      o.age < LINEAGE.independenceAgeMin ||
      o.age > LINEAGE.independenceAgeMax ||
      state.bashoIndex - o.since < LINEAGE.independenceAfterBasho ||
      o.highestRank?.division !== 'makuuchi' ||
      !rng.chance(ASSOCIATION.npcIndependencePerYear)
    ) {
      continue;
    }
    const id = state.nextId++;
    const stable: Stable = {
      id,
      name: o.name,
      isPlayer: false,
      style: o.style,
      ichimonId: from.ichimonId,
      branch: null,
    };
    // 自分の系譜の部屋（分家）から出たなら、これも分家
    if (from.branch) {
      const parentNode = state.player.family.find((n) => n.id === from.branch!.nodeId);
      const node = addNode(state, {
        name: o.name,
        shikona: o.shikona,
        parentId: parentNode?.id ?? null,
        stableId: id,
        kind: 'branch',
        oyakataId: null,
        fromBashoIndex: state.bashoIndex,
        toBashoIndex: null,
        highestRank: o.highestRank,
      });
      stable.branch = { parentStableId: from.id, nodeId: node.id };
    }
    state.stables.push(stable);
    o.role = 'master';
    o.stableId = id;
    o.since = state.bashoIndex;
    const young = state.rikishi
      .filter((r) => r.stableId === from.id)
      .sort((a, b) => a.age - b.age)
      .slice(0, ASSOCIATION.npcTakeDisciples);
    for (const r of young) r.stableId = id;
  }
}

/**
 * 年の終わり（年齢を足した後）: 参与の退職・部屋付きの定年・架空の部屋の師匠の定年・独立。
 * 自分の部屋の師匠の定年は扱わない（跡継ぎ選びは game/advance.ts）
 */
export function yearEndAssociation(state: GameState, rng: Prng): void {
  for (const o of [...state.oyakata]) {
    if (!state.oyakata.includes(o)) continue;
    if (o.role === 'sanyo' && o.age >= ASSOCIATION.sanyoUntil) {
      releaseName(state, o.id);
      state.oyakata = state.oyakata.filter((x) => x.id !== o.id);
      continue;
    }
    if (o.role === 'heyatsuki' && o.age >= TOSHIYORI.retireAge) {
      retireOrSanyo(state, o, rng);
      continue;
    }
    if (o.role === 'master' && o.age >= TOSHIYORI.retireAge && o.id !== state.player.oyakataId) {
      retireNpcMaster(state, o, rng);
    }
  }
  npcIndependence(state, rng);
}

/** 架空の部屋の力士が引退するとき: 資格があり名跡が空いていれば部屋付きの親方として残る */
export function npcRetireeTakesName(
  state: GameState,
  stableId: number,
  shikona: string,
  highest: Rank | null,
  age: number,
  style: Style,
  rng: Prng,
): boolean {
  if (freeNames(state).length === 0) return false;
  const o = newOyakata(state, rng, stableId, 'heyatsuki', age, '', style);
  o.shikona = shikona;
  o.highestRank = highest;
  o.since = state.bashoIndex;
  o.name = takeName(state, o.id, rng)!;
  return true;
}
