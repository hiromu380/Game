import { describe, expect, it } from 'vitest';
import { isDebugAvailable } from '../src/config/debug';

describe('デバッグ表示', () => {
  it('ビルド（体験版・製品版）では出さず、開発サーバーか ?debug のときだけ出す', () => {
    expect(isDebugAvailable(false, '')).toBe(false);
    expect(isDebugAvailable(false, '?seed=5')).toBe(false);
    expect(isDebugAvailable(false, '?debug')).toBe(true);
    expect(isDebugAvailable(true, '')).toBe(true);
  });
});
