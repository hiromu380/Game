/**
 * キーボード・コントローラー: キーの割り当てと、メニューのフォーカス移動の方向の選び方
 */
import { describe, expect, it } from 'vitest';
import { actionOfKey } from '../src/input/controls';
import { nearestInDirection } from '../src/input/menuNavigation';

const rect = (x: number, y: number, w = 10, h = 10) =>
  ({ left: x, top: y, width: w, height: h }) as DOMRect;
const el = (name: string) => ({ name }) as unknown as HTMLElement;

describe('キーの割り当て', () => {
  it('config/controls.ts の割り当てどおり（大文字でも同じ）', () => {
    expect(actionOfKey('ArrowUp')).toBe('up');
    expect(actionOfKey('R')).toBe('rotate');
    expect(actionOfKey('Escape')).toBe('cancel');
    expect(actionOfKey('x')).toBeNull();
  });
});

describe('フォーカス移動の方向', () => {
  // 3×2 に並んだボタン
  const a = el('a');
  const b = el('b');
  const c = el('c');
  const d = el('d');
  const grid = [
    { el: a, rect: rect(0, 0) },
    { el: b, rect: rect(20, 0) },
    { el: c, rect: rect(0, 20) },
    { el: d, rect: rect(40, 20) },
  ];

  it('その方向でいちばん近いもの（横ずれは重く数える）', () => {
    expect(nearestInDirection(rect(0, 0), grid.slice(1), [1, 0])).toBe(b);
    expect(nearestInDirection(rect(0, 0), grid.slice(1), [0, 1])).toBe(c);
    expect(nearestInDirection(rect(20, 0), [grid[0]!, grid[2]!, grid[3]!], [0, 1])).toBe(c);
  });

  it('その方向に何もなければ null', () => {
    expect(nearestInDirection(rect(0, 0), grid.slice(1), [0, -1])).toBeNull();
  });
});
