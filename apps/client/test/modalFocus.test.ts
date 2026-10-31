import { describe, expect, it } from 'vitest';
import { nextTabTarget } from '../src/input/modalFocus';

describe('ダイアログの中の Tab', () => {
  const items = ['a', 'b', 'c'];

  it('順に進み、最後から最初へ戻る', () => {
    expect(nextTabTarget(items, 'a', false)).toBe('b');
    expect(nextTabTarget(items, 'c', false)).toBe('a');
  });

  it('Shift+Tab は逆順に進み、最初から最後へ戻る', () => {
    expect(nextTabTarget(items, 'b', true)).toBe('a');
    expect(nextTabTarget(items, 'a', true)).toBe('c');
  });

  it('ダイアログの外（またはダイアログそのもの）にフォーカスがあれば、端から入る', () => {
    expect(nextTabTarget(items, null, false)).toBe('a');
    expect(nextTabTarget(items, 'outside', false)).toBe('a');
    expect(nextTabTarget(items, 'outside', true)).toBe('c');
  });

  it('押せるものがなければ何もしない', () => {
    expect(nextTabTarget([], null, false)).toBeNull();
  });
});
