/**
 * 時間操作のルールの検証（プロンプトの「必ず検証すること」）
 */
import { describe, expect, it } from 'vitest';
import { BALANCE, SLOT_TABLE } from '../src/config/balance';
import { payoutFor } from '../src/core/items';
import {
  bankAndLeave,
  bankedAmount,
  buyItem,
  confirmSpin,
  createRun,
  machineById,
  maxBet,
  pullLever,
  startRewind,
  update,
} from '../src/core/run';
import { basePayout, outcomeAt, TOTAL_WEIGHT } from '../src/core/slot';
import type { Machine, RunState } from '../src/core/types';

/** 台の前に立たせる */
function standAt(state: RunState, m: Machine) {
  state.room = m.room;
  state.player.pos = { x: m.x + 0.5, y: m.y + 1.5 };
}

/** 結果が出るまで進める */
function spinToResult(state: RunState) {
  for (let i = 0; i < 20 && state.spin?.phase === 'spinning'; i++) update(state, 0.1);
}

function rewindFully(state: RunState) {
  expect(startRewind(state)).toBe(true);
  for (let i = 0; i < 20 && state.phase === 'rewinding'; i++) update(state, 0.1);
}

function collectAll(state: RunState) {
  for (let i = 0; i < 100 && state.spin?.phase === 'collecting'; i++) update(state, 0.1);
}

const normalMachine = (s: RunState) => s.machines.find((m) => !m.broken && m.room === 'entrance')!;
const brokenMachine = (s: RunState) => s.machines.find((m) => m.broken)!;

describe('抽選', () => {
  it('同じ台・同じ抽選位置なら必ず同じ結果（賭け金に関わらない）', () => {
    for (let i = 0; i < 50; i++) expect(outcomeAt(1234, i)).toEqual(outcomeAt(1234, i));
    const a = createRun(7);
    const b = createRun(7);
    const ma = normalMachine(a);
    const mb = normalMachine(b);
    standAt(a, ma);
    standAt(b, mb);
    pullLever(a, ma.id, 1);
    pullLever(b, mb.id, Math.min(5, maxBet(b, mb)));
    expect(a.spin!.result).toEqual(b.spin!.result);
  });

  it('出現率は抽選表どおり（10万回）', () => {
    const counts: Record<string, number> = {};
    for (let i = 0; i < 100000; i++) {
      const o = outcomeAt(99, i).outcome;
      counts[o] = (counts[o] ?? 0) + 1;
    }
    for (const o of SLOT_TABLE) {
      expect(Math.abs(counts[o.id]! / 100000 - o.weight / TOTAL_WEIGHT)).toBeLessThan(0.005);
    }
  });

  it('払い戻しは元金込みの整数（切り捨て）。利益 = 払い戻し − 賭け金', () => {
    expect(basePayout(3, 'small')).toBe(4); // 3 × 1.5 = 4.5 → 4
    expect(basePayout(10, 'jackpot')).toBe(1000);
    const p = payoutFor(7, 'medium', []);
    expect(p).toMatchObject({ bet: 7, base: 21, total: 21, profit: 14, safe: 0 });
    expect(payoutFor(5, 'miss', []).profit).toBe(-5);
  });
});

describe('巻き戻し', () => {
  it('壊れた台: 1枚で777 → 巻き戻す → 全額で同じ777 → 大量の払い出しを受け取って使える', () => {
    const s = createRun(1);
    const m = brokenMachine(s);
    standAt(s, m);
    expect(pullLever(s, m.id, 1)).toBe(true);
    spinToResult(s);
    expect(s.spin!.result.outcome).toBe('jackpot');
    expect(s.chips).toBe(BALANCE.startChips - 1);

    rewindFully(s);
    expect(s.chips).toBe(BALANCE.startChips); // 支出が戻る
    expect(s.knowledge[m.id]).toMatchObject({ index: 0, outcome: 'jackpot' }); // 記憶は残る
    expect(s.rewinds).toBe(1);

    const all = maxBet(s, m);
    expect(all).toBe(BALANCE.brokenMachine.limit);
    pullLever(s, m.id, all);
    spinToResult(s);
    expect(s.spin!.result.outcome).toBe('jackpot');
    expect(confirmSpin(s)).toBe(true);
    collectAll(s);
    expect(s.chips).toBe(BALANCE.startChips - all + all * 100);
    expect(s.introDone).toBe(true);
    expect(machineById(s, m.id).broken).toBe('dead');

    // 得た金で道具を買える
    s.room = 'workshop';
    s.player.pos = { x: 6.5, y: 4.6 };
    const before = s.chips;
    expect(buyItem(s, 0)).toBe(true);
    expect(s.chips).toBeLessThan(before);
    expect(s.items).toHaveLength(1);
  });

  it('悪い結果を見て戻しても、同じ台・同じ位置なら同じ結果になる', () => {
    const s = createRun(3);
    const m = normalMachine(s);
    standAt(s, m);
    pullLever(s, m.id, 1);
    spinToResult(s);
    const first = s.spin!.result;
    rewindFully(s);
    pullLever(s, m.id, Math.min(4, maxBet(s, m)));
    spinToResult(s);
    expect(s.spin!.result).toEqual(first);
  });

  it('確定したら抽選位置が進み、もう巻き戻せない（二重に受け取れない）', () => {
    const s = createRun(5);
    const m = normalMachine(s);
    standAt(s, m);
    pullLever(s, m.id, 1);
    spinToResult(s);
    const index = m.index;
    confirmSpin(s);
    expect(machineById(s, m.id).index).toBe(index + 1);
    expect(startRewind(s)).toBe(false);
    expect(confirmSpin(s)).toBe(false);
  });

  it('通常の警備は記録時点へ戻り、支配人の位置と巻き戻した回数・痕跡は残る', () => {
    const s = createRun(11);
    const m = normalMachine(s);
    standAt(s, m);
    // 支配人が同じ部屋にいる状態にする
    s.trace = BALANCE.nox.appearAt;
    s.rewinds = BALANCE.safeRewinds;
    s.nox = { active: true, room: s.room, pos: { x: 10, y: 7 }, travel: 0, entering: 0, slow: 0, facing: { x: 0, y: 1 } };
    const guard = s.guards[0]!;
    guard.room = s.room;
    guard.pos = { x: 9, y: 3 };
    const guardBefore = { ...guard.pos };

    pullLever(s, m.id, 1);
    spinToResult(s);
    guard.pos = { x: 3, y: 6 }; // 抽選のあいだに動いた
    const noxBefore = { ...s.nox.pos };
    rewindFully(s);
    expect(s.guards[0]!.pos).toEqual(guardBefore);
    expect(s.nox.pos).not.toEqual(noxBefore); // 巻き戻しのあいだも歩き続ける
    expect(s.rewinds).toBe(BALANCE.safeRewinds + 1);
    expect(s.trace).toBe(BALANCE.nox.appearAt + 1);
  });

  it('最初の2回の巻き戻しは痕跡を残さない', () => {
    const s = createRun(2);
    const m = normalMachine(s);
    standAt(s, m);
    for (let i = 0; i < BALANCE.safeRewinds; i++) {
      pullLever(s, m.id, 1);
      spinToResult(s);
      rewindFully(s);
    }
    expect(s.trace).toBe(0);
    pullLever(s, m.id, 1);
    spinToResult(s);
    rewindFully(s);
    expect(s.trace).toBe(1);
  });
});

describe('ポーズ・逃走・捕獲', () => {
  it('時間を進めなければ支配人も動かない（ポーズ中は update を呼ばない）', () => {
    const s = createRun(4);
    s.trace = BALANCE.nox.appearAt;
    s.nox = { active: true, room: s.room, pos: { x: 10, y: 7 }, travel: 0, entering: 0, slow: 0, facing: { x: 0, y: 1 } };
    const before = structuredClone(s.nox);
    update(s, 0); // ポーズ中は経過時間 0
    expect(s.nox.pos).toEqual(before.pos);
    update(s, 0.5);
    expect(s.nox.pos).not.toEqual(before.pos);
  });

  it('捕まると持ち帰っていない利益を失い、退避用の領収書の分だけ残る', () => {
    const s = createRun(6);
    s.items = ['receipt'];
    const m = brokenMachine(s);
    standAt(s, m);
    pullLever(s, m.id, 10);
    spinToResult(s);
    confirmSpin(s);
    const safe = s.safe;
    expect(safe).toBe(Math.floor(((1000 - 10) * BALANCE.items.receipt.safePercent) / 100));
    s.nox = { active: true, room: s.room, pos: { ...s.player.pos }, travel: 0, entering: 0, slow: 0, facing: { x: 0, y: 1 } };
    update(s, 0.05);
    expect(s.phase).toBe('caught');
    expect(s.caughtBy).toBe('nox');
    expect(bankedAmount(s)).toBe(safe);
  });

  it('搬出ロビーの窓口で持ち帰ると、所持チップと安全保管の分を持ち帰る', () => {
    const s = createRun(8);
    s.room = 'lobby';
    s.player.pos = { x: 7.5, y: 3.6 };
    s.chips = 500;
    s.safe = 40;
    expect(bankAndLeave(s)).toBe(true);
    expect(s.phase).toBe('escaped');
    expect(bankedAmount(s)).toBe(540);
  });

  it('結果を確定するまで部屋から出られない', () => {
    const s = createRun(9);
    const m = normalMachine(s);
    standAt(s, m);
    pullLever(s, m.id, 1);
    spinToResult(s);
    const door = s.rooms.entrance!.doors[0]!;
    s.player.pos = { x: door.x + 0.5, y: door.y + 0.5 };
    const dir = { n: { x: 0, y: -1 }, s: { x: 0, y: 1 }, w: { x: -1, y: 0 }, e: { x: 1, y: 0 } }[door.side];
    update(s, 0.3, { move: dir, dodge: false, shockwave: false });
    expect(s.room).toBe('entrance');
    confirmSpin(s);
    collectAll(s);
    s.player.pos = { x: door.x + 0.5, y: door.y + 0.5 };
    update(s, 0.3, { move: dir, dodge: false, shockwave: false });
    expect(s.room).toBe(door.to);
  });
});

describe('道具', () => {
  it('追い賭け手袋: 予知済みの抽選だけ上限が上がる', () => {
    const s = createRun(12);
    s.items = ['glove'];
    s.chips = 10000;
    const m = normalMachine(s);
    standAt(s, m);
    expect(maxBet(s, m)).toBe(m.limit);
    pullLever(s, m.id, 1);
    spinToResult(s);
    rewindFully(s);
    expect(maxBet(s, m)).toBe(m.limit * BALANCE.items.glove.limitMul);
  });

  it('割れた鏡: 隣の台の次の結果も覗け、回数が減る', () => {
    const s = createRun(13);
    s.items = ['mirror'];
    s.mirrorCharges = 1;
    const m = normalMachine(s);
    standAt(s, m);
    pullLever(s, m.id, 1);
    spinToResult(s);
    const known = Object.keys(s.knowledge);
    expect(known.length).toBe(2);
    expect(s.mirrorCharges).toBe(0);
    const other = machineById(s, known.find((id) => id !== m.id)!);
    expect(s.knowledge[other.id]!.outcome).toBe(outcomeAt(other.seed, other.index, other.broken === 'fixed' ? 'jackpot' : undefined).outcome);
  });

  it('残響コイン・白紙の契約は払い出しを増やし、表示と同じ計算になる', () => {
    const base = payoutFor(10, 'big', []);
    const echo = payoutFor(10, 'big', ['echo']);
    const contract = payoutFor(10, 'big', ['contract']);
    expect(echo.total).toBe(base.total + Math.floor((base.base * BALANCE.items.echo.bonusPercent) / 100));
    expect(contract.total).toBe(Math.floor((base.total * BALANCE.items.contract.payoutPercent) / 100));
    expect(payoutFor(10, 'miss', ['echo', 'contract']).total).toBe(0);
  });
});
