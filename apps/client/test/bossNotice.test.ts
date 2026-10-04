import { createRun } from '@chain-factory/sim';
import { describe, expect, it } from 'vitest';
import { hasBossTarget } from '../src/ui/BossNotice';

describe('夜シフトのルールの対象', () => {
  it('1種類に効くルールは、対象が手持ち・盤面・ショップのどこにもなければ「関係ない」', () => {
    const run = { ...createRun(1), shop: [], inventory: {} };
    expect(hasBossTarget(run, 'lowOil')).toBe(false);
    expect(hasBossTarget({ ...run, inventory: { conveyor: 1 } }, 'lowOil')).toBe(true);
    const cells = [...run.board.cells];
    cells[3] = { id: 'conveyor', dir: 0 };
    expect(hasBossTarget({ ...run, board: { ...run.board, cells } }, 'lowOil')).toBe(true);
    expect(
      hasBossTarget({ ...run, shop: [{ partId: 'conveyor', price: 1, sold: false }] }, 'lowOil'),
    ).toBe(true);
    expect(
      hasBossTarget({ ...run, shop: [{ partId: 'conveyor', price: 1, sold: true }] }, 'lowOil'),
    ).toBe(false);
  });

  it('全体に効くルールは常に関係ある', () => {
    const run = { ...createRun(1), shop: [], inventory: {} };
    expect(hasBossTarget(run, 'strictInspection')).toBe(true);
  });
});
