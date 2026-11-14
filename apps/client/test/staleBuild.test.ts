import { describe, expect, it } from 'vitest';
import { shouldReload } from '../src/boot/staleBuild';

describe('古い版のタブの読み込み直し', () => {
  it('はじめては読み込み直す', () => {
    expect(shouldReload(1_000_000, null)).toBe(true);
  });

  it('直前に読み込み直したばかりなら、くり返さない', () => {
    expect(shouldReload(1_000_000, 1_000_000 - 5_000)).toBe(false);
    expect(shouldReload(1_000_000, 1_000_000 - 60_000)).toBe(true);
  });
});
