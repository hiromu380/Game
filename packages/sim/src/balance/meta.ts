/**
 * メタ進行: 最初から使えるパーツ・パーツの解放条件・工場拡張の条件
 */
import type { Balance } from './types';

export const META: Balance['meta'] = {
  initialUnlocked: [
    'conveyor',
    'dock',
    'junkbot',
    'gear',
    'press',
    'splitter',
    'barrel',
    'rebooter',
    'spreader',
    'reflector',
    'coil',
    'solar',
  ],
  // 1回目のランで1〜2種、全クリアや延長戦でさらに、と段階的に増えるようにしている
  partUnlocks: [
    { partId: 'inspector', condition: { kind: 'bestShiftScore', value: 100 } },
    { partId: 'piggyBank', condition: { kind: 'runsPlayed', value: 2 } },
    { partId: 'turntable', condition: { kind: 'reachShift', value: 6 } },
    { partId: 'merger', condition: { kind: 'bestChain', value: 25 } },
    { partId: 'oiler', condition: { kind: 'reachShift', value: 9 } },
    { partId: 'copier', condition: { kind: 'totalShipped', value: 1_000_000 } },
    { partId: 'chainMeter', condition: { kind: 'bestChain', value: 50 } },
  ],
  boardExpansions: [
    { kind: 'clears', value: 1 },
    { kind: 'clears', value: 3 },
  ],
};
