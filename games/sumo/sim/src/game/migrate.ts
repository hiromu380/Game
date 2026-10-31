/**
 * セーブの変換（古い版 → 今の版）。読めない形なら null
 */
import type { FamilyNode, GameState, JournalEntry } from '../model/types';
import { SAVE_VERSION } from '../world/create';
import { populateAssociation } from '../world/association';
import { ensureRival } from '../world/rival';
import { initialOffice } from '../world/office';
import { initKoenkai } from '../stable/koenkai';
import { ranksOf } from '../banzuke/rank';
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
  if (s.version === 9) s = v9to10(s);
  if (s.version === 10) s = v10to11(s);
  if (s.version === 11) s = v11to12(s);
  if (s.version === 12) s = v12to13(s);
  if (s.version === 13) s = v13to14(s);
  if (s.version === 14) s = v14to15(s);
  if (s.version === 15) s = v15to16(s);
  if (s.version === 16) s = v16to17(s);
  return s.version === SAVE_VERSION ? (s as unknown as GameState) : null;
}

/**
 * 16 → 17: けがの治療の方針（まだ聞いていない）。今のけがの部位は次の場所の後に付く
 */
function v16to17(raw: Raw): Raw {
  const s = JSON.parse(JSON.stringify(raw)) as GameState;
  s.pending.treatment = [];
  s.version = 17;
  return s as unknown as Raw;
}

/**
 * 15 → 16: スカウト回り（まだ出ていない）
 */
function v15to16(raw: Raw): Raw {
  const s = JSON.parse(JSON.stringify(raw)) as GameState;
  s.player.scoutedAt = null;
  s.version = 16;
  return s as unknown as Raw;
}

/**
 * 14 → 15: 後援会（いまの名声と関取の数から会員数を決め、地元の後援者が1人）
 */
function v14to15(raw: Raw): Raw {
  const s = JSON.parse(JSON.stringify(raw)) as GameState;
  s.player.koenkai = initKoenkai(s, ranksOf(s.banzuke, s.titles));
  s.version = 15;
  return s as unknown as Raw;
}

/**
 * 13 → 14: 協会の役職（親方の年齢から）・理事会（次の選挙まではなし）
 */
function v13to14(raw: Raw): Raw {
  const s = JSON.parse(JSON.stringify(raw)) as GameState;
  const master = s.oyakata.find((o) => o.id === s.player.oyakataId);
  s.player.office = { rank: initialOffice(master?.age ?? 40), since: s.bashoIndex };
  s.board = null;
  s.pending.election = null;
  s.version = 14;
  return s as unknown as Raw;
}

/**
 * 12 → 13: ライバルの部屋（同期の親方の部屋を選ぶ）
 */
function v12to13(raw: Raw): Raw {
  const s = JSON.parse(JSON.stringify(raw)) as GameState;
  s.rival = null;
  ensureRival(s);
  s.version = 13;
  return s as unknown as Raw;
}

/**
 * 11 → 12: 部屋の人（まだいない）とちゃんこの方針（ふつう）
 */
function v11to12(raw: Raw): Raw {
  const s = JSON.parse(JSON.stringify(raw)) as GameState;
  s.player.diet = 'standard';
  s.player.staff = [];
  s.version = 12;
  return s as unknown as Raw;
}

/**
 * 10 → 11: 出来事の記録（最近起きたもの）。起きている出来事は、今の版の出来事として残す（同じ鍵）
 */
function v10to11(raw: Raw): Raw {
  const s = JSON.parse(JSON.stringify(raw)) as GameState;
  s.happeningLog = [];
  s.version = 11;
  return s as unknown as Raw;
}

/**
 * 9 → 10: 部屋の日誌。歴代の師匠・独立した分家・引退した弟子から、主な出来事だけを作り直す
 */
function v9to10(raw: Raw): Raw {
  const s = JSON.parse(JSON.stringify(raw)) as GameState;
  const events: JournalEntry[] = [{ bashoIndex: 0, kind: 'earlier' }];
  for (const l of s.player.lineage) {
    events.push(
      l.generation === 1
        ? { bashoIndex: l.fromBashoIndex, kind: 'open', stable: l.name, shikona: l.shikona }
        : {
            bashoIndex: l.fromBashoIndex,
            kind: 'successor',
            generation: l.generation,
            stable: l.name,
            shikona: l.shikona,
          },
    );
  }
  for (const n of s.player.family) {
    if (n.kind !== 'branch') continue;
    events.push({
      bashoIndex: n.fromBashoIndex,
      kind: 'independence',
      stable: n.name,
      shikona: n.shikona,
    });
  }
  for (const a of s.player.alumni) {
    events.push({
      bashoIndex: a.retiredBashoIndex,
      kind: 'retire',
      shikona: a.name,
      age: a.retiredAge,
      highest: a.career.highestRank,
      oyakata: a.becameOyakata ? '' : null,
    });
  }
  // 同じ場所の中は作った順のまま（安定ソート）
  s.journal = events.sort((a, b) => a.bashoIndex - b.bashoIndex);
  s.version = 10;
  return s as unknown as Raw;
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
