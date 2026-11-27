/**
 * 日ごとの幕間（約 8 秒。1日をクリアしたとき・初回だけ）: 前進
 * 毎日同じ型「工場長が部品を吊って渡す → ボルトが取り付ける」で見せ、日ごとに出来事を変える。
 * ロケットは上部の背景と同じ段階の絵（1日目の終わり = 3/9、2日目の終わり = 6/9）
 * 絵コンテ: docs/story/storyboard.html#interlude1・#interlude2
 */
import type { ActorValue, Scene } from '../timeline';
import { actor, at, BOLT_H, CHIEF_H, GROUND, H, hop, key, prop, rocketBox, W, walk } from './build';

const bolt = (pose: string, x: number, extra: Partial<ActorValue> = {}): ActorValue => ({
  pose,
  x,
  y: GROUND,
  height: BOLT_H,
  ...extra,
});
const chief = (pose: string, x: number): ActorValue => ({ pose, x, y: GROUND, height: CHIEF_H });

/** 夜の工場の外（共通の背景） */
const night = () => [
  prop('sky', 'story:night-sky', [key(0, at(0, 0, W, H))]),
  prop('town', 'story:town', [key(0, at(0, 320, W, 300))]),
  prop('ground', 'story:roof', [key(0, at(0, GROUND - 4, W, 200))]),
];

/** ロケット: from 段階から to 段階へ、部品を1つずつ取り付ける（times 秒に1段階ずつ） */
const rocket = (from: number, times: number[]) =>
  prop('rocket', `rocket-${from}`, [
    key(0, rocketBox(700, GROUND, 330)),
    ...times.map((t, i) =>
      key(t, { ...rocketBox(700, GROUND, 330), asset: `rocket-${from + i + 1}` }),
    ),
  ]);

const fadeInOut = (duration: number) => [
  key(0, { color: '#000000', alpha: 1 }),
  key(0.5, { color: '#000000', alpha: 0 }),
  key(duration - 0.5, { color: '#000000', alpha: 0 }),
  key(duration, { color: '#000000', alpha: 1 }),
];

/**
 * ボルトがフックの下へ歩いて部品を受け取り、ロケットへ運んで取り付ける（毎日同じ型）。
 * heavy: 2日目（部品が重く、受け取るとよろけ、ゆっくり運ぶ）。stages: 取り付けで1段階ずつ進む時刻
 */
function receiveAndInstall(heavy: boolean, from: number): Scene['tracks'] {
  // 工場長のフックの下（offer のポーズで部品が下がる位置）と、ロケットの右（取り付ける位置）
  const HOOK_X = 1150;
  const INSTALL_X = 805;
  const face = heavy ? 'tired' : 'happy';
  const take = heavy ? 2.4 : 2.3;
  const carryEnd = heavy ? 4.3 : 3.6;
  const lift = carryEnd + 0.3;
  const stages = [lift + 0.3, lift + 0.6, lift + 0.9];
  return [
    rocket(from, stages),
    actor('chief', 'chief', [
      key(0, chief('offer', 990)),
      key(take, chief('offer', 990)),
      key(take + 0.3, chief('neutral', 990)),
    ]),
    actor('bolt', 'bolt', [
      key(0, bolt('walk', 260)),
      ...walk(0.4, take - 0.2, 260, HOOK_X, (p, x) => bolt(p, x)),
      key(take, bolt(heavy ? 'stagger' : 'carry', HOOK_X, { face })),
      ...(heavy
        ? [
            key(take + 0.6, bolt('stagger', HOOK_X - 20)),
            key(take + 0.9, bolt('carryWalk', HOOK_X - 20, { flip: true })),
            ...walk(
              take + 0.9,
              carryEnd,
              HOOK_X - 20,
              INSTALL_X,
              (p, x) => bolt(p, x, { flip: true }),
              0.45,
              'carryWalk',
            ),
          ]
        : [
            key(take + 0.4, bolt('carryWalk', HOOK_X, { flip: true })),
            ...walk(
              take + 0.4,
              carryEnd,
              HOOK_X,
              INSTALL_X,
              (p, x) => bolt(p, x, { flip: true }),
              0.34,
              'carryWalk',
            ),
          ]),
      key(lift, bolt('install', INSTALL_X, { flip: true })),
      key(stages[2]! + 0.1, bolt('install', INSTALL_X, { flip: true })),
      key(stages[2]! + 0.4, bolt(heavy ? 'wipe' : 'stand', INSTALL_X, { face })),
      ...(heavy
        ? [
            key(6.4, bolt('wipe', INSTALL_X)),
            ...hop(6.5, (p, l) => bolt(p, INSTALL_X, { y: GROUND + l, face }), 'wave', 22),
          ]
        : [
            ...hop(5.6, (p, l) => bolt(p, INSTALL_X, { y: GROUND + l, face }), 'guts'),
            key(6.6, bolt('wave', INSTALL_X, { face })),
          ]),
    ]),
  ];
}

/** 1日目: いつもの型（受け取る → 運ぶ → 取り付ける → 跳ねて喜ぶ） */
export const interlude1: Scene = {
  id: 'interlude1',
  duration: 8,
  background: '#0b0d12',
  tracks: [...night(), ...receiveAndInstall(false, 0)],
  tint: fadeInOut(8),
  sounds: [
    { t: 0.3, key: 'craneWinch' },
    ...[0.6, 1.2, 1.8].map((t) => ({ t, key: 'footstep' })),
    { t: 2.3, key: 'boltBeep' },
    { t: 4.2, key: 'clank' },
    { t: 4.5, key: 'clank' },
    { t: 4.8, key: 'clank' },
    { t: 5.8, key: 'boltHappy' },
  ],
};

/** 2日目: 部品が大きく重くなり、よろけながら運ぶ。汗をぬぐって小さく跳ねる */
export const interlude2: Scene = {
  id: 'interlude2',
  duration: 8,
  background: '#0b0d12',
  tracks: [...night(), ...receiveAndInstall(true, 3)],
  tint: fadeInOut(8),
  sounds: [
    { t: 0.3, key: 'craneWinch' },
    ...[0.6, 1.2, 1.8].map((t) => ({ t, key: 'footstep' })),
    { t: 2.4, key: 'landing' },
    { t: 2.5, key: 'boltQuestion' },
    { t: 4.9, key: 'clank' },
    { t: 5.2, key: 'clank' },
    { t: 5.5, key: 'clank' },
    { t: 6.6, key: 'boltBeep' },
  ],
};
