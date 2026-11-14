import { describe, expect, it } from 'vitest';
import { wrapFocus } from '../src/dialogs';

// 要素の代わりに、同じものと分かるだけの物を使う
const items = [{ id: 'a' }, { id: 'b' }, { id: 'c' }] as unknown as HTMLElement[];

describe('ダイアログの中の Tab', () => {
  it('最後で Tab を押すと最初へ、最初で Shift+Tab を押すと最後へ回る', () => {
    expect(wrapFocus(items, items[2]!, false)).toBe(items[0]);
    expect(wrapFocus(items, items[0]!, true)).toBe(items[2]);
  });

  it('途中ではブラウザに任せる（回さない）', () => {
    expect(wrapFocus(items, items[0]!, false)).toBeNull();
    expect(wrapFocus(items, items[1]!, true)).toBeNull();
  });

  it('ダイアログの外にフォーカスがあれば、中の端へ入れる。押せる物がなければ何もしない', () => {
    expect(wrapFocus(items, null, false)).toBe(items[0]);
    expect(wrapFocus(items, null, true)).toBe(items[2]);
    expect(wrapFocus([], null, false)).toBeNull();
  });
});
