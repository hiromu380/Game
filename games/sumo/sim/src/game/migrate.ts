/**
 * セーブの変換（古い版 → 今の版）。読めない形なら null
 */
import type { FamilyNode, GameState } from '../model/types';
import { SAVE_VERSION } from '../world/create';
import { populateAssociation } from '../world/association';
import { createPrng, deriveSeed, SEED } from '../core/prng';

type Raw = Record<string, unknown> & { version?: number };

export function migrateSave(raw: unknown): GameState | null {
  if (typeof raw !== 'object' || raw === null) return null;
  let s = raw as Raw;
  if (s.version === 1) s = v1to2(s);
  if (s.version === 2) s = v2to3(s);
  if (s.version === 3) s = v3to4(s);
  if (s.version === 4) s = v4to5(s);
  if (s.version === 5) s = v5to6(s);
  if (s.version === 6) s = v6to7(s);
  if (s.version === 7) s = v7to8(s);
  if (s.version === 8) s = v8to9(s);
  return s.version === SAVE_VERSION ? (s as unknown as GameState) : null;
}

/**
 * 8 → 9: 協会。分家の師匠を親方として作り、一門・名跡・架空の部屋の親方を足す（ゲームのシードから決める）
 */
function v8to9(raw: Raw): Raw {
  const s = JSON.parse(JSON.stringify(raw)) as GameState & { toshiyoriFree?: number };
  const rng = createPrng(deriveSeed(s.seed, SEED.world, 9));
  delete s.toshiyoriFree;
  for (const st of s.stables) {
    st.ichimonId = 0;
    const b = st.branch as
      (typeof st.branch & { masterShikona?: string; masterAge?: number }) | null;
    if (b) {
      s.oyakata.push({
        id: s.nextId++,
        name: st.name,
        shikona: b.masterShikona ?? '',
        age: b.masterAge ?? 50,
        stableId: st.id,
        role: 'master',
        style: st.style,
        highestRank: null,
        generation: null,
        fromRikishiId: null,
        waitingSince: null,
        since: s.bashoIndex,
      });
      delete b.masterShikona;
      delete b.masterAge;
    }
  }
  s.names = [];
  s.ichimon = [];
  populateAssociation(s, rng);
  s.version = 9;
  return s as unknown as Raw;
}

/** 7 → 8: 場所の間の出来事（なし）と稽古の伸びの倍率（1） */
function v7to8(raw: Raw): Raw {
  const s = JSON.parse(JSON.stringify(raw)) as GameState;
  s.pending.happening = null;
  for (const r of s.rikishi) r.boost = 1;
  s.version = 8;
  return s as unknown as Raw;
}

/** 6 → 7: 番付の推移（これから記録）と歴代の力士（なし） */
function v6to7(raw: Raw): Raw {
  const s = JSON.parse(JSON.stringify(raw)) as GameState;
  for (const r of s.rikishi) r.track = [];
  s.player.alumni = [];
  s.version = 7;
  return s as unknown as Raw;
}

/** 5 → 6: 強行出場の判断（なし） */
function v5to6(raw: Raw): Raw {
  const s = JSON.parse(JSON.stringify(raw)) as GameState;
  for (const r of s.rikishi) r.playHurt = false;
  s.version = 6;
  return s as unknown as Raw;
}

/** 4 → 5: 三賞の回数（0）と、直近の結果の三賞・優勝決定戦（なし） */
function v4to5(raw: Raw): Raw {
  const s = JSON.parse(JSON.stringify(raw)) as GameState;
  for (const r of s.rikishi) r.career.sansho = { shukun: 0, kanto: 0, gino: 0 };
  if (s.lastReport) {
    s.lastReport.sansho = { shukun: [], kanto: [], gino: [] };
    s.lastReport.playoff = null;
  }
  s.version = 5;
  return s as unknown as Raw;
}

/** 3 → 4: 直近の場所の結果に、番付の上がり下がり（空）と巡業（なし）を足す */
function v3to4(raw: Raw): Raw {
  const s = JSON.parse(JSON.stringify(raw)) as GameState;
  if (s.lastReport) {
    s.lastReport.banzukeChanges = [];
    s.lastReport.jungyo = null;
  }
  s.version = 4;
  return s as unknown as Raw;
}

/** 2 → 3: 設備と契約（すべて 0） */
function v2to3(raw: Raw): Raw {
  const s = JSON.parse(JSON.stringify(raw)) as GameState;
  s.player.facilities = { dorm: 0, dojo: 0, trainer: 0, scout: 0 };
  s.version = 3;
  return s as unknown as Raw;
}

/** 1 → 2: 系譜図・分家（今いる親方から系譜図を作る） */
function v1to2(raw: Raw): Raw {
  const s = JSON.parse(JSON.stringify(raw)) as GameState;
  for (const st of s.stables) st.branch = null;
  for (const o of s.oyakata) o.since = 0;
  s.pending.independence = null;
  s.pending.takeOver = null;
  const family: FamilyNode[] = [];
  const master = s.oyakata.find((o) => o.id === s.player.oyakataId);
  const node = (
    o: GameState['oyakata'][number],
    kind: FamilyNode['kind'],
    parentId: number | null,
  ): FamilyNode => ({
    id: s.nextId++,
    name: o.name,
    shikona: o.shikona,
    parentId,
    stableId: o.stableId,
    kind,
    oyakataId: o.id,
    fromBashoIndex: 0,
    toBashoIndex: null,
    highestRank: o.highestRank,
    sekitori: 0,
    sanyaku: 0,
    yokozuna: 0,
    makuuchiYusho: 0,
  });
  const root = master ? node(master, 'master', null) : null;
  if (root) family.push(root);
  for (const o of s.oyakata) {
    if (o.id === s.player.oyakataId) continue;
    family.push(node(o, o.role === 'waiting' ? 'waiting' : 'heyatsuki', root?.id ?? null));
  }
  s.player.family = family;
  s.version = 2;
  return s as unknown as Raw;
}
