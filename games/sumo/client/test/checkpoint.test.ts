import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { advanceBasho, createGame, type GameState } from '@ichimon/sim';
import { isYearStart, loadCheckpoint, saveGame } from '../src/save';

/** テストの間だけの localStorage */
function fakeStorage() {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
  };
}

describe('年の初めの控え', () => {
  const g0 = globalThis as { localStorage?: unknown };
  let before: unknown;
  beforeEach(() => {
    before = g0.localStorage;
    g0.localStorage = fakeStorage();
  });
  afterEach(() => {
    g0.localStorage = before;
  });

  it('年の初めに控えを書き、同じゲームのその後の場所でだけ読める', () => {
    const g = createGame({ seed: 31 });
    expect(isYearStart(g)).toBe(true);
    saveGame(g);
    const later = advanceBasho(g);
    expect(isYearStart(later)).toBe(false);
    saveGame(later);
    expect(loadCheckpoint(later)?.bashoIndex).toBe(0);
    // 同じ場所・ほかのゲームでは出さない
    expect(loadCheckpoint(g)).toBeNull();
    const other: GameState = { ...later, seed: 32 };
    expect(loadCheckpoint(other)).toBeNull();
  });
});
