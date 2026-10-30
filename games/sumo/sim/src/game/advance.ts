/**
 * 1場所を進める（場所前の判断が終わった状態から、次の場所前まで）
 *
 * 1. 返事をしていない引退の申し出は受け入れる。来なかった入門希望者は帰る
 * 2. 本場所（全員の取組）
 * 3. 記録と本人の収入・引退・番付編成・年寄名跡
 * 4. 自分の部屋の会計
 * 5. 稽古（伸び・衰え・けが）
 * 6. 年の終わり: 年齢・名跡の空き・親方の定年（跡継ぎ選び）
 * 7. 次の場所の入門希望者
 *
 * 入力の state は変えない（コピーして返す）。
 */
import { RECRUIT, TOSHIYORI } from '../balance/career';
import { GAME } from '../balance/game';
import { runBasho } from '../basho/run';
import { makeBanzuke } from '../banzuke/make';
import { isSanyaku, isSekitori, ranksOf } from '../banzuke/rank';
import { NEUTRAL_GROWTH, npcPolicy, train, type GrowthContext } from '../career/growth';
import { mustRetire, wantsToRetire } from '../career/retire';
import { applyBasho, applyHighest, applyMochikyukinMinimum } from '../career/update';
import { createPrng, deriveSeed, SEED } from '../core/prng';
import { applyKakun } from '../lineage/kakun';
import { settleBasho, sum } from '../money/ledger';
import type { BashoRecord, BashoReport, GameState, Rank } from '../model/types';
import { makeCandidates, npcRecruits } from './recruit';
import { applyHappening, rollHappening } from './happening';
import { currentLineage, isBlocked, retireRikishi } from './state';
import { LINEAGE } from '../balance/lineage';
import { note } from './journal';
import { staffGrowth } from '../stable/staff';
import { ensureRival, rivalSignsCandidates, settleRival } from '../world/rival';
import { TRAITS } from '../balance/traits';
import { hasTrait } from '../career/traits';
import { DIETS, STAFF_EFFECTS } from '../balance/staff';
import { SANSHO } from '../balance/sansho';
import { selectSansho } from '../basho/sansho';
import { JUNGYO, JUNGYO_AFTER } from '../balance/events';
import { FACILITY_EFFECTS } from '../balance/facilities';
import { closeNode, masterNodeOf, nodeOfOyakata, rollIndependence } from '../lineage/family';
import { takeName, yearEndAssociation } from '../world/association';

export function advanceBasho(input: GameState): GameState {
  if (input.gameOver || isBlocked(input)) return input;
  const state: GameState = JSON.parse(JSON.stringify(input));
  const report: BashoReport = {
    bashoIndex: state.bashoIndex,
    yusho: {},
    mine: [],
    promotions: [],
    retired: [],
    injuries: [],
    banzukeChanges: [],
    jungyo: null,
    sansho: { shukun: [], kanto: [], gino: [] },
    playoff: null,
    income: [],
    expenses: [],
    personal: [],
  };
  const isMine = (id: number) => byId.get(id)?.stableId === state.player.stableId;

  // 1. 引退の申し出・入門希望者
  for (const id of state.pending.retireRequests) retireRikishi(state, id, report);
  state.pending.retireRequests = [];
  // 返事をしなかった独立の申し出は、引き留めたことにする。出来事は断ったことにする
  state.pending.independence = null;
  if (state.pending.happening) applyHappening(state, Number.MAX_SAFE_INTEGER);
  // 返事をしなかった取り合いの新弟子は、ライバルの部屋に入る
  rivalSignsCandidates(state);
  state.pending.candidates = [];
  let byId = new Map(state.rikishi.map((r) => [r.id, r]));

  // 架空の部屋の稽古の方針
  const styleOfStable = new Map(state.stables.map((s) => [s.id, s.style]));
  for (const r of state.rikishi) {
    if (r.stableId !== state.player.stableId)
      r.policy = npcPolicy(r, styleOfStable.get(r.stableId)!);
  }

  // 2. 本場所
  const outcome = runBasho(state.seed, state.bashoIndex, state.banzuke, state.titles, byId);
  const injuryRng = createPrng(deriveSeed(state.seed, SEED.injury, state.bashoIndex));
  for (const id of outcome.injured) {
    byId.get(id)!.injury = injuryRng.range(1, 2);
    if (isMine(id)) report.injuries.push(id);
  }
  const stableName = (stableId: number) => state.stables.find((s) => s.id === stableId)!.name;
  for (const [d, id] of outcome.yusho) {
    report.yusho[d] = id;
    const r = byId.get(id)!;
    if (masterNodeOf(state, r.stableId)) {
      note(state, {
        kind: 'yusho',
        shikona: r.name,
        stable: stableName(r.stableId),
        division: d,
        wins: outcome.records.get(id)!.wins,
      });
    }
  }
  report.playoff = outcome.playoff.get('makuuchi') ?? null;
  // 決まり手ごとの白星（得意技）
  for (const b of outcome.bouts) {
    if (b.fusen) continue;
    const c = byId.get(b.winnerId)!.career;
    c.kimarite ??= {};
    c.kimarite[b.kimarite] = (c.kimarite[b.kimarite] ?? 0) + 1;
  }

  // 3. 記録
  const yushoIds = new Set(outcome.yusho.values());
  for (const id of state.banzuke) {
    const r = byId.get(id)!;
    const rec = outcome.records.get(id)!;
    const rank = outcome.ranks.get(id)!;
    const record: BashoRecord = {
      bashoIndex: state.bashoIndex,
      rank,
      wins: rec.wins,
      losses: rec.losses,
      absences: rec.absences,
      yusho: yushoIds.has(id),
    };
    applyBasho(r, {
      record,
      kinboshi: outcome.kinboshi.get(id) ?? 0,
      kenshoYen: outcome.kenshoYen.get(id) ?? 0,
      zensho: rec.wins === 15,
    });
    if (isMine(id)) {
      r.track.push({ ...record, order: state.banzuke.indexOf(id), total: state.banzuke.length });
      report.mine.push({
        id,
        record,
        bouts: outcome.bouts.filter((b) => b.eastId === id || b.westId === id),
      });
    }
  }

  // 三賞（賞金は本人へ。自分の弟子なら部屋の名声）
  report.sansho = selectSansho(
    outcome.ranks,
    outcome.records,
    outcome.bouts,
    outcome.yusho.get('makuuchi'),
  );
  for (const kind of ['shukun', 'kanto', 'gino'] as const) {
    for (const id of report.sansho[kind]) {
      const r = byId.get(id)!;
      r.career.sansho[kind]++;
      r.career.earnings += SANSHO.prize;
      if (isMine(id)) {
        state.player.prestige += GAME.prestige.sansho;
        note(state, { kind: 'sansho', shikona: r.name, prize: kind });
      }
    }
  }

  // 引退（自分の弟子は申し出として次の場所前に聞く。年齢の上限は本人が決めている）
  const retireRng = createPrng(deriveSeed(state.seed, SEED.retire, state.bashoIndex));
  const retiring = new Set<number>();
  for (const id of state.banzuke) {
    const r = byId.get(id)!;
    const rank = outcome.ranks.get(id)!;
    if (isMine(id)) {
      if (mustRetire(r)) retiring.add(id);
      else if (wantsToRetire(r, rank, retireRng)) state.pending.retireRequests.push(id);
    } else if (wantsToRetire(r, rank, retireRng)) {
      retiring.add(id);
    }
  }

  // 新しく番付に載る力士: 自分の部屋で入門した新弟子（前相撲）＋ 架空の部屋の新弟子
  const onBanzuke = new Set(state.banzuke);
  const mineNew = state.rikishi.filter((r) => !onBanzuke.has(r.id)).map((r) => r.id);
  const kept = state.banzuke.length - retiring.size + mineNew.length;
  let npcCount = Math.min(Math.max(0, RECRUIT.npcPerYearTarget - kept), 80);
  // 番付の人数を偶数にする（奇数だと、毎日だれか1人が取組なしになる）
  if ((kept + npcCount) % 2 === 1) npcCount++;
  const npcNew = npcRecruits(state, npcCount);
  state.rikishi.push(...npcNew);
  byId = new Map(state.rikishi.map((r) => [r.id, r]));

  const made = makeBanzuke({
    banzuke: state.banzuke,
    ranks: outcome.ranks,
    records: outcome.records,
    makuuchiYusho: outcome.yusho.get('makuuchi'),
    recentOf: (id) => byId.get(id)!.recent,
    exOzeki: (id) => byId.get(id)!.exOzeki,
    retired: retiring,
    newcomers: [...mineNew, ...npcNew.map((r) => r.id)],
  });
  for (const id of retiring) retireRikishi(state, id, report);
  byId = new Map(state.rikishi.map((r) => [r.id, r]));
  state.banzuke = made.banzuke.filter((id) => byId.has(id));
  state.titles = made.titles;
  const demoted = new Set(made.demotedOzeki);
  const newRanks = ranksOf(state.banzuke, state.titles);
  const lineage = currentLineage(state);
  state.banzuke.forEach((id, i) => {
    const r = byId.get(id)!;
    const rank = newRanks.get(id)!;
    const before = r.career.highestRank;
    r.exOzeki = demoted.has(id);
    applyMochikyukinMinimum(r, rank);
    applyHighest(r, rank, i);
    const firstSekitori = isSekitori(rank) && (before === null || !isSekitori(before));
    const firstMakuuchi =
      rank.division === 'makuuchi' && (before === null || before.division !== 'makuuchi');
    const firstSanyaku = isSanyaku(rank) && (before === null || !isSanyaku(before));
    const promo = made.newYokozuna.includes(id)
      ? 'Y'
      : made.newOzeki.includes(id) && !(before?.title === 'O' || before?.title === 'Y')
        ? 'O'
        : firstMakuuchi
          ? 'makuuchi'
          : firstSekitori
            ? 'sekitori'
            : null;
    if (promo) report.promotions.push({ id, to: promo });
    // 一門の部屋（本家・分家）の成績は、師匠の系譜図の節と名声に数える（分家は名声の一部だけ）
    const node = masterNodeOf(state, r.stableId);
    if (node) {
      if (promo)
        note(state, {
          kind: 'promote',
          shikona: r.name,
          stable: stableName(r.stableId),
          to: promo,
        });
      const main = r.stableId === state.player.stableId;
      const share = main ? 1 : LINEAGE.branchPrestigeShare;
      if (firstSekitori) {
        node.sekitori++;
        if (main) lineage.sekitori++;
        state.player.prestige += GAME.prestige.newSekitori * share;
      }
      if (firstSanyaku) {
        node.sanyaku++;
        if (main) lineage.sanyaku++;
        state.player.prestige += GAME.prestige.newSanyaku * share;
      }
      if (made.newOzeki.includes(id)) state.player.prestige += GAME.prestige.newOzeki * share;
      if (made.newYokozuna.includes(id)) {
        node.yokozuna++;
        if (main) lineage.yokozuna++;
        state.player.prestige += GAME.prestige.newYokozuna * share;
      }
    }
  });
  const yushoMakuuchi = outcome.yusho.get('makuuchi');
  const yushoStable = yushoMakuuchi !== undefined ? byId.get(yushoMakuuchi)?.stableId : undefined;
  const yushoNode = yushoStable !== undefined ? masterNodeOf(state, yushoStable) : undefined;
  if (yushoNode) {
    const main = yushoStable === state.player.stableId;
    yushoNode.makuuchiYusho++;
    if (main) lineage.makuuchiYusho++;
    state.player.prestige += GAME.prestige.makuuchiYusho * (main ? 1 : LINEAGE.branchPrestigeShare);
  }

  // 番付発表: 自分の弟子の上がり下がり
  for (const m of report.mine) {
    report.banzukeChanges.push({ id: m.id, from: m.record.rank, to: newRanks.get(m.id) ?? null });
  }
  // ライバルの部屋との直接対決・ライバルの大きな出来事
  settleRival(state, outcome.bouts, report, newRanks, outcome.ranks);

  // 巡業（春・夏・秋・冬）: 関取が地方を回る。疲れるが、人気（名声）が上がる
  const jungyo = JUNGYO_AFTER[state.bashoIndex % 6] ?? null;
  report.jungyo = jungyo;
  if (jungyo) {
    for (const id of state.banzuke) {
      const rank = newRanks.get(id)!;
      if (!isSekitori(rank)) continue;
      const r = byId.get(id)!;
      r.fatigue = Math.min(100, r.fatigue + JUNGYO.fatigue);
      if (r.stableId === state.player.stableId) state.player.prestige += JUNGYO.prestigePerSekitori;
    }
  }

  // 4. 自分の部屋の会計
  const mine = state.rikishi.filter((r) => r.stableId === state.player.stableId);
  const mineRanks: (Rank | null)[] = mine.map((r) => newRanks.get(r.id) ?? null);
  const sekitoriNow = mineRanks.filter((r) => r !== null && isSekitori(r)).length;
  // 人気者の関取がいると、部屋の名声も少し上がる
  const popularSekitori = mine.filter(
    (r, i) => mineRanks[i] && isSekitori(mineRanks[i]!) && hasTrait(r, 'popular'),
  ).length;
  state.player.prestige =
    state.player.prestige * GAME.prestigeKeep +
    sekitoriNow * GAME.prestige.sekitoriPerBasho +
    popularSekitori * TRAITS.popular.prestigePerBasho;
  const ledger = settleBasho(
    mineRanks,
    state.player.prestige,
    state.player.kakun,
    state.player.facilities,
    DIETS[state.player.diet].food,
  );
  report.income = ledger.income;
  report.expenses = ledger.expenses;
  report.personal = ledger.personal;
  state.player.stableMoney += sum(ledger.income) - sum(ledger.expenses);
  state.player.personalMoney += sum(ledger.personal);
  // 部屋の赤字は親方の個人のお金で埋める
  if (state.player.stableMoney < 0) {
    state.player.personalMoney += state.player.stableMoney;
    state.player.stableMoney = 0;
  }
  if (state.player.personalMoney < 0) state.gameOver = 'bankrupt';

  // 5. 稽古
  const growthRng = createPrng(deriveSeed(state.seed, SEED.growth, state.bashoIndex));
  const master = state.oyakata.find((o) => o.id === state.player.oyakataId)!;
  const coaches = state.oyakata.filter(
    (o) => o.stableId === state.player.stableId && o.role === 'heyatsuki',
  ).length;
  const staff = staffGrowth(state);
  const playerCtx: GrowthContext = applyKakun(
    {
      ...NEUTRAL_GROWTH,
      oyakataStyle: master.style,
      coaches,
      growthMultiplier: 1 + state.player.facilities.dojo * FACILITY_EFFECTS.dojoGrowthPerLevel,
      injuryMultiplier:
        1 - state.player.facilities.trainer * FACILITY_EFFECTS.trainerInjuryCutPerLevel,
      extraRecovery:
        state.player.facilities.trainer * FACILITY_EFFECTS.trainerRecoveryPerLevel + staff.recovery,
      dietGainKg: staff.gainKg,
    },
    state.player.kakun,
  );
  playerCtx.injuryMultiplier *= staff.injury;
  // 若者頭は幕下以下の弟子を見る
  const lowerCtx: GrowthContext = {
    ...playerCtx,
    growthMultiplier: playerCtx.growthMultiplier * staff.lowerGrowth,
  };
  for (const r of state.rikishi) {
    const rank = newRanks.get(r.id);
    const ctx =
      r.stableId === state.player.stableId
        ? rank && isSekitori(rank)
          ? playerCtx
          : lowerCtx
        : { ...NEUTRAL_GROWTH, oyakataStyle: styleOfStable.get(r.stableId)! };
    train(r, ctx, growthRng);
  }

  // 強行出場の判断・出稽古の伸びは1場所かぎり
  for (const r of state.rikishi) {
    r.playHurt = false;
    r.boost = 1;
  }

  // 6. 年の終わり（九州場所の後）
  if (state.bashoIndex % 6 === 5) yearEnd(state);

  // 7. 次の場所へ
  state.bashoIndex++;
  if (!state.gameOver) {
    state.pending.candidates = makeCandidates(state);
    rollHappening(state);
  }
  state.lastReport = report;
  return state;
}

function yearEnd(state: GameState) {
  const rng = createPrng(deriveSeed(state.seed, SEED.toshiyori, state.bashoIndex));
  for (const r of state.rikishi) r.age++;
  for (const o of state.oyakata) o.age++;
  // 部屋の人も年をとり、定年で協会を去る
  for (const s of state.player.staff) s.age++;
  for (const s of state.player.staff.filter((x) => x.age >= STAFF_EFFECTS.retireAge)) {
    note(state, { kind: 'staffLeave', role: s.role, name: s.name, retired: true });
  }
  state.player.staff = state.player.staff.filter((x) => x.age < STAFF_EFFECTS.retireAge);
  // 協会: 参与の退職・部屋付きの定年・架空の部屋（分家を含む）の師匠の定年と継承・独立
  yearEndAssociation(state, rng);
  // ライバルの部屋が閉じていたら、新しいライバル
  ensureRival(state);
  // 空いた名跡は自分の部屋の名跡待ちに先に回す（前もって継承の話をつけている）。待ちすぎた者は協会を去る
  for (const o of state.oyakata.filter((x) => x.role === 'waiting')) {
    const node = nodeOfOyakata(state, o.id);
    const name = takeName(state, o.id, rng);
    if (name) {
      o.role = 'heyatsuki';
      o.name = name;
      o.waitingSince = null;
      o.since = state.bashoIndex;
      if (node) {
        node.kind = 'heyatsuki';
        node.name = name;
      }
    } else if (state.bashoIndex - o.waitingSince! >= TOSHIYORI.waitYears * 6) {
      state.oyakata = state.oyakata.filter((x) => x.id !== o.id);
      closeNode(state, node);
    }
  }
  // 部屋付きの親方の独立の申し出
  rollIndependence(state);
  // 自分の親方の定年: 跡継ぎ選び（部屋付きの親方から。いなければ分家を継ぐ）
  const master = state.oyakata.find((o) => o.id === state.player.oyakataId)!;
  if (master.age >= TOSHIYORI.retireAge) {
    const candidates = state.oyakata
      .filter((o) => o.stableId === state.player.stableId && o.role === 'heyatsuki')
      .map((o) => o.id);
    const branches = state.stables.filter((s) => s.branch).map((s) => s.id);
    if (candidates.length > 0) state.pending.successor = candidates;
    else if (branches.length > 0) state.pending.takeOver = branches;
    else state.gameOver = 'noSuccessor';
  }
}
