/**
 * 決定論: 同じ入力なら必ず同じ結果になる
 */
import { describe, expect, it } from 'vitest';
import { createPrng, DEFAULT_RULES, simulate } from '../src';
import { board } from './helpers';

/** シード付き乱数でランダムな盤面を作る（テスト用） */
function randomBoard(seed: number) {
  const rng = createPrng(seed);
  const codes = ['..', '..', 'C', 'Y', 'G', 'P', 'B', 'J', 'R', 'D'];
  const dirs = ['^', '>', 'v', '<'];
  const rows: string[] = [];
  for (let y = 0; y < 7; y++) {
    const row: string[] = [];
    for (let x = 0; x < 7; x++) {
      const code = codes[rng.nextInt(codes.length)]!;
      row.push(code === '..' ? '..' : code + dirs[rng.nextInt(4)]!);
    }
    rows.push(row.join(' '));
  }
  // スイッチを1つ置く
  rows[3] = 'S>' + rows[3]!.slice(2);
  return board(rows);
}

/** 盤面のディープコピー（盤面は JSON で表現できる） */
const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

describe('決定論', () => {
  it('同じ盤面・シードなら結果（スコア・イベント・統計）が完全に一致する', () => {
    for (let i = 0; i < 50; i++) {
      const b = randomBoard(i);
      const a = simulate({ board: b, seed: 1234, rules: DEFAULT_RULES });
      const c = simulate({ board: clone(b), seed: 1234, rules: DEFAULT_RULES });
      expect(c).toEqual(a);
    }
  });

  it('ポンコツロボの方向はシードで決まり、同じシードなら同じ', () => {
    const rows = [
      '.. .. D> .. ..',
      '.. .. .. .. ..',
      'D> S> J> .. D>',
      '.. .. .. .. ..',
      '.. .. D> .. ..',
    ];
    const b = board(rows);
    const results = new Set<string>();
    for (let seed = 0; seed < 20; seed++) {
      const first = simulate({ board: b, seed, rules: DEFAULT_RULES });
      const second = simulate({ board: b, seed, rules: DEFAULT_RULES });
      expect(second.events).toEqual(first.events);
      results.add(
        JSON.stringify(first.events, (_, v) => (typeof v === 'bigint' ? v.toString() : v)),
      );
    }
    // シードが違えば結果が変わることもある（全シードで同一ではない）
    expect(results.size).toBeGreaterThan(1);
  });

  it('入力の盤面を書き換えない', () => {
    const b = randomBoard(7);
    const snapshot = clone(b);
    simulate({ board: b, seed: 1, rules: DEFAULT_RULES });
    expect(b).toEqual(snapshot);
  });
});
