import { describe, expect, it } from 'vitest';
import { advanceBasho, ASSOCIATION, createGame, migrateSave, type GameState } from '../src';
import { autoStep } from './play';

/** 協会の決まりがいつも守られているか */
function checkInvariants(s: GameState) {
  expect(s.names).toHaveLength(ASSOCIATION.names);
  expect(new Set(s.names.map((n) => n.name)).size).toBe(ASSOCIATION.names);
  const byId = new Map(s.oyakata.map((o) => [o.id, o]));
  for (const n of s.names) {
    if (n.holderId !== null) expect(byId.get(n.holderId)?.name).toBe(n.name);
  }
  for (const o of s.oyakata) {
    const held = s.names.filter((n) => n.holderId === o.id);
    expect(held).toHaveLength(o.role === 'waiting' ? 0 : 1);
    expect(s.stables.some((st) => st.id === o.stableId)).toBe(true);
    if (o.role === 'sanyo') expect(o.age).toBeLessThan(ASSOCIATION.sanyoUntil);
  }
  for (const st of s.stables) {
    const masters = s.oyakata.filter((o) => o.stableId === st.id && o.role === 'master');
    expect(masters).toHaveLength(1);
    expect(masters[0]!.name).toBe(st.name);
    expect(s.ichimon.some((i) => i.id === st.ichimonId)).toBe(true);
  }
  for (const r of s.rikishi) expect(s.stables.some((st) => st.id === r.stableId)).toBe(true);
}

describe('協会: 名跡・一門・親方', () => {
  it('開始時: 名跡105・一門5・すべての部屋に師匠（部屋の名前 = 師匠の名跡）。空きが少しある', () => {
    const s = createGame({ seed: 1 });
    checkInvariants(s);
    expect(s.ichimon).toHaveLength(5);
    expect(s.names.filter((n) => n.holderId === null)).toHaveLength(ASSOCIATION.startFreeNames);
    expect(s.oyakata.filter((o) => o.role === 'heyatsuki').length).toBeGreaterThan(40);
  });

  it('自分の一門を選べる', () => {
    const s = createGame({ seed: 1, ichimonId: 3 });
    expect(s.stables.find((x) => x.isPlayer)!.ichimonId).toBe(3);
  });

  it('架空の部屋の師匠の定年: 部屋付きが名跡を交換して継ぐ。先代は参与か退職', () => {
    const s = createGame({ seed: 2 });
    s.bashoIndex = 5;
    const stable = s.stables.find(
      (st) => !st.isPlayer && s.oyakata.some((o) => o.stableId === st.id && o.role === 'heyatsuki'),
    )!;
    const master = s.oyakata.find((o) => o.stableId === stable.id && o.role === 'master')!;
    master.age = 64;
    for (const o of s.oyakata) if (o.stableId === stable.id && o.role === 'heyatsuki') o.age = 40;
    const next = advanceBasho(s);
    const newMaster = next.oyakata.find((o) => o.stableId === stable.id && o.role === 'master')!;
    expect(newMaster.id).not.toBe(master.id);
    expect(newMaster.name).toBe(stable.name);
    const old = next.oyakata.find((o) => o.id === master.id);
    if (old) expect(old.role).toBe('sanyo');
    checkInvariants(next);
  });

  it('継ぐ親方がいなければ部屋を閉じ、力士は同じ一門の部屋へ移る', () => {
    const s = createGame({ seed: 2 });
    s.bashoIndex = 5;
    const stable = s.stables.find(
      (st) =>
        !st.isPlayer && !s.oyakata.some((o) => o.stableId === st.id && o.role === 'heyatsuki'),
    );
    if (!stable) return;
    s.oyakata.find((o) => o.stableId === stable.id && o.role === 'master')!.age = 64;
    const ids = s.rikishi.filter((r) => r.stableId === stable.id).map((r) => r.id);
    const next = advanceBasho(s);
    expect(next.stables.some((x) => x.id === stable.id)).toBe(false);
    for (const id of ids) {
      const r = next.rikishi.find((x) => x.id === id);
      if (!r) continue; // 引退した
      expect(next.stables.find((x) => x.id === r.stableId)!.ichimonId).toBe(stable.ichimonId);
    }
    checkInvariants(next);
  });

  it('30年進めても協会の決まりが守られる（名跡の数・師匠・一門）', () => {
    let s = createGame({ seed: 17 });
    for (let i = 0; i < 180 && !s.gameOver; i++) {
      s = autoStep(s);
      if (i % 30 === 29) checkInvariants(s);
    }
    checkInvariants(s);
  }, 120_000);

  it('版8のセーブを今の版に変換できる（分家の師匠を親方として作る）', () => {
    const s = createGame({ seed: 5 });
    const v8 = JSON.parse(JSON.stringify(s));
    v8.version = 8;
    v8.oyakata = v8.oyakata.filter((o: { id: number }) => o.id === v8.player.oyakataId);
    delete v8.names;
    delete v8.ichimon;
    v8.toshiyoriFree = 2;
    for (const st of v8.stables) delete st.ichimonId;
    // 分家を1つ足す（版8の形）
    v8.stables.push({
      id: 999999,
      name: '仮浦',
      isPlayer: false,
      style: 'oshi',
      branch: {
        parentStableId: v8.player.stableId,
        masterShikona: '仮山',
        masterAge: 50,
        nodeId: 1,
      },
    });
    const m = migrateSave(v8)!;
    expect(m.version).toBe(12);
    expect(m.oyakata.find((o) => o.stableId === 999999)).toMatchObject({
      role: 'master',
      shikona: '仮山',
      age: 50,
    });
    checkInvariants(m);
    expect(advanceBasho(m).bashoIndex).toBe(1);
  });
});
