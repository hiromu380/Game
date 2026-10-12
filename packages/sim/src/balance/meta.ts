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
  // 一度解放したら永続（セーブに記録。Steam 版は Steam Cloud で同期）。
  // 1回目のランで1種、2〜3回目と全クリアでさらに、延長戦や大きな連鎖でレアを、と段階的に増えるようにしている
  partUnlocks: [
    { partId: 'inspector', condition: { kind: 'bestShiftScore', value: 500 } },
    { partId: 'piggyBank', condition: { kind: 'runsPlayed', value: 3 } },
    { partId: 'turntable', condition: { kind: 'reachShift', value: 7 } },
    { partId: 'merger', condition: { kind: 'bestChain', value: 40 } },
    { partId: 'oiler', condition: { kind: 'clears', value: 1 } },
    { partId: 'copier', condition: { kind: 'totalShipped', value: 5_000_000 } },
    { partId: 'chainMeter', condition: { kind: 'bestChain', value: 80 } },
    // パーツ追加（SIM_VERSION 9）: 序盤に手に入るもの（曲がりレール・ブースター・隅の作業台）から、延長戦・大量出荷で手に入るレアまで
    { partId: 'bend', condition: { kind: 'runsPlayed', value: 2 } },
    { partId: 'booster', condition: { kind: 'bestShiftScore', value: 100 } },
    { partId: 'cornerBench', condition: { kind: 'reachShift', value: 4 } },
    { partId: 'crossSplitter', condition: { kind: 'bestChain', value: 25 } },
    { partId: 'magnet', condition: { kind: 'bestShiftScore', value: 20_000 } },
    { partId: 'cashier', condition: { kind: 'runsPlayed', value: 6 } },
    { partId: 'capacitor', condition: { kind: 'reachShift', value: 9 } },
    { partId: 'teleporter', condition: { kind: 'totalShipped', value: 50_000_000 } },
  ],
  boardExpansions: [
    { kind: 'clears', value: 2 },
    { kind: 'clears', value: 5 },
  ],
};
