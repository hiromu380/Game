import { describe, expect, it } from 'vitest';
import { keyTarget } from '../src/keys';

/** querySelector の文字列ごとに返すものを決めた、小さな偽の document */
function fakeDoc(map: Record<string, unknown>) {
  const body = { tagName: 'BODY' };
  return {
    body,
    querySelector: (q: string) => (map[q] as object | undefined) ?? null,
    querySelectorAll: (q: string) => (map[q] as object[] | undefined) ?? [],
  } as unknown as Document;
}
const ev = (key: string, target?: object) =>
  ({
    key,
    target,
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    isComposing: false,
  }) as unknown as KeyboardEvent;

describe('キー操作', () => {
  const main = { id: 'main' };
  const c1 = { id: 'c1', tagName: 'BUTTON' };
  const c2 = { id: 'c2', tagName: 'BUTTON' };
  const back = { id: 'back' };
  const map = {
    '.actionbar .button--primary:not(:disabled)': main,
    '#prep-panel .prep__cmd': [c1, c2],
    '#prep-panel [data-key="back"]': back,
  };

  it('Enter は下の帯の主ボタン、数字は場所前のコマンド、Backspace は戻る', () => {
    const doc = fakeDoc(map);
    expect(keyTarget(ev('Enter', doc.body), doc)).toBe(main);
    expect(keyTarget(ev('2', doc.body), doc)).toBe(c2);
    expect(keyTarget(ev('9', doc.body), doc)).toBeNull();
    expect(keyTarget(ev('Backspace', doc.body), doc)).toBe(back);
  });

  it('窓が開いているとき・ボタンにフォーカスがあるとき・文字を打っているときは使わない', () => {
    const doc = fakeDoc(map);
    expect(keyTarget(ev('Enter', c1), doc)).toBeNull();
    expect(keyTarget(ev('1', { tagName: 'INPUT' }), doc)).toBeNull();
    const withModal = fakeDoc({ ...map, '.modal': {} });
    expect(keyTarget(ev('1', withModal.body), withModal)).toBeNull();
  });
});
