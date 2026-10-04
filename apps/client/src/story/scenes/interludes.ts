/**
 * 日ごとの幕間（約 8 秒。1日をクリアしたとき・初回だけ）: 前進
 * 毎日同じ型「工場長が部品を吊って渡す → ボルトが取り付ける」で見せ、日ごとに出来事を変える。
 * ロケットは上部の背景と同じ段階の絵（1日目の終わり = 3/9、2日目の終わり = 6/9）
 * 絵コンテ: docs/story/storyboard.html#interlude1・#interlude2
 */
import type { ActorValue, Scene } from '../timeline';
import {
  actor,
  appear,
  at,
  BOLT_H,
  CHIEF_H,
  GROUND,
  H,
  key,
  prop,
  rocketBox,
  W,
  walk,
} from './build';

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

/** 工場長のフックから降ろした部品が、ロケットへ運ばれて取り付けられる（受け取りを目で追えるように） */
const carry = (t0: number, t1: number) =>
  prop('carry', 'story:scrap', [
    key(0, at(1110, 460, 110, 40, 0)),
    ...appear(t0, at(1110, 460, 110, 40), 0.05),
    key(t1, at(650, 420, 110, 40, 1), 'inOut'),
    key(t1 + 0.3, at(650, 420, 110, 40, 0)),
  ]);

const fadeInOut = (duration: number) => [
  key(0, { color: '#000000', alpha: 1 }),
  key(0.5, { color: '#000000', alpha: 0 }),
  key(duration - 0.5, { color: '#000000', alpha: 0 }),
  key(duration, { color: '#000000', alpha: 1 }),
];

/** 1日目: いつもの型（受け取る → 取り付ける → 手を振る） */
export const interlude1: Scene = {
  id: 'interlude1',
  duration: 8,
  background: '#0b0d12',
  tracks: [
    ...night(),
    rocket(0, [4, 4.6, 5.2]),
    carry(3.2, 3.9),
    actor('chief', 'chief', [
      key(0, chief('offer', 990)),
      key(2.6, chief('offer', 990)),
      key(3.2, chief('neutral', 990)),
    ]),
    actor('bolt', 'bolt', [
      key(0, bolt('stand', 300)),
      ...walk(0.6, 2.2, 300, 520, (p, x) => bolt(p, x)),
      key(2.4, bolt('guts', 520, { face: 'happy' })),
      key(3.6, bolt('jump', 520, { face: 'happy' })),
      key(4.2, bolt('stand', 520)),
      key(4.6, bolt('jump', 520, { face: 'happy' })),
      key(5.2, bolt('stand', 520)),
      key(5.6, bolt('jump', 520, { face: 'happy' })),
      key(6.2, bolt('wave', 520)),
    ]),
  ],
  tint: fadeInOut(8),
  sounds: [
    { t: 0.3, key: 'craneWinch' },
    { t: 2.5, key: 'boltBeep' },
    { t: 4, key: 'clank' },
    { t: 4.6, key: 'clank' },
    { t: 5.2, key: 'clank' },
    { t: 6.3, key: 'boltHappy' },
  ],
};

/** 2日目: 部品が大きく重くなり、よろける。汗をぬぐって小さく跳ねる */
export const interlude2: Scene = {
  id: 'interlude2',
  duration: 8,
  background: '#0b0d12',
  tracks: [
    ...night(),
    rocket(3, [4.4, 5, 5.6]),
    carry(1.2, 2.2),
    actor('chief', 'chief', [key(0, chief('offer', 990)), key(1.2, chief('neutral', 990))]),
    actor('bolt', 'bolt', [
      key(0, bolt('stand', 640)),
      key(0.8, bolt('stagger', 640)),
      key(1.4, bolt('stagger', 590)),
      key(2, bolt('stagger', 550)),
      ...walk(2.6, 3.8, 550, 520, (p, x) => bolt(p, x)),
      key(4.2, bolt('stand', 520, { face: 'tired' })),
      key(5.6, bolt('stand', 520, { face: 'tired' })),
      key(6.2, bolt('jump', 520, { face: 'tired' })),
      key(6.8, bolt('wave', 520, { face: 'tired' })),
    ]),
  ],
  tint: fadeInOut(8),
  sounds: [
    { t: 0.5, key: 'craneWinch' },
    { t: 1, key: 'landing' },
    { t: 1.2, key: 'boltQuestion' },
    { t: 4.4, key: 'clank' },
    { t: 5, key: 'clank' },
    { t: 5.6, key: 'clank' },
    { t: 6.3, key: 'boltBeep' },
  ],
};
