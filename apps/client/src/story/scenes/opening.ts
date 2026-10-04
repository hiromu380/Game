/**
 * オープニング（約 40 秒。初めてのランの最初に1回だけ）: 夢 → 取引
 * 絵コンテ: docs/story/storyboard.html#opening
 *
 * 0〜6 秒   工場の中。荷を片付け、汗をぬぐって伸び
 * 6〜17 秒  屋根に登って腰かけ、星を見上げる。流れ星 → 絵の吹き出し（ロケットと星）
 * 17〜25 秒 ガラクタの山から設計図を見つけ、広げて目を輝かせる
 * 25〜35 秒 工場長がノルマの箱を指し、部品を吊って見せる。ボルトは見比べて、うなずく
 * 35〜40 秒 スイッチの前でガッツポーズ → 盤面へ寄ってゲームへ
 */
import type { ActorValue, Scene } from '../timeline';
import {
  actor,
  appear,
  at,
  blackout,
  BOLT_H,
  CHIEF_H,
  GROUND,
  H,
  key,
  prop,
  vanish,
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
const chief = (pose: string, x: number, extra: Partial<ActorValue> = {}): ActorValue => ({
  pose,
  x,
  y: GROUND,
  height: CHIEF_H,
  ...extra,
});
/** 屋根の上のボルト（少し小さく・屋根の高さ） */
const roofBolt = (pose: string, x: number, extra: Partial<ActorValue> = {}): ActorValue =>
  bolt(pose, x, { y: 560, height: 200, ...extra });
const hidden = { alpha: 0 };

/** 外の場面（6〜17 秒）だけ見える絵 */
const outside = (id: string, asset: string, box: ReturnType<typeof at>) =>
  prop(id, asset, [
    key(0, { ...box, ...hidden }),
    ...appear(6, box, 0.01),
    ...vanish(17, box, 0.01),
  ]);

/** 工場の中（0〜6 秒・17 秒〜）だけ見える絵 */
const inside = (id: string, asset: string, box: ReturnType<typeof at>, from = 0) =>
  prop(id, asset, [
    key(0, { ...box, alpha: from === 0 ? 1 : 0 }),
    ...(from === 0 ? vanish(6, box, 0.01) : []),
    ...appear(Math.max(17, from), box, 0.01),
  ]);

export const opening: Scene = {
  id: 'opening',
  duration: 40,
  background: '#0b0d12',
  tracks: [
    // ---- 背景 ----
    outside('sky', 'story:night-sky', at(0, 0, W, H)),
    outside('town', 'story:town', at(0, 300, W, 300)),
    outside('roof', 'story:roof', at(0, 540, W, 200)),
    inside('workshop', 'story:workshop', at(0, 0, W, H)),
    // 工場の中の小物
    prop('box', 'story:quota-box', [
      key(0, at(900, 510, 100, 90)),
      ...vanish(6, at(900, 510, 100, 90), 0.01),
      ...appear(25, at(1150, 510, 100, 90), 0.01),
    ]),
    prop('junk', 'story:junk', [
      key(0, at(130, 420, 310, 190, 0)),
      ...appear(17, at(130, 420, 310, 190), 0.01),
      ...vanish(25, at(130, 420, 310, 190)),
    ]),
    prop('switch', 'part:switch', [
      key(0, at(820, 500, 110, 110, 0)),
      ...appear(35, at(820, 500, 110, 110)),
    ]),
    // 流れ星と吹き出し
    prop('star', 'story:shooting-star', [
      key(0, at(80, 30, 300, 60, 0)),
      ...appear(12, at(80, 30, 300, 60), 0.1),
      key(13.2, at(620, 140, 300, 60, 0), 'out'),
    ]),
    prop('bubble', 'story:bubble', [
      key(0, at(760, 150, 30, 22, 0)),
      key(13.3, at(760, 150, 30, 22, 0)),
      key(13.8, at(640, 60, 300, 220, 1), 'out'),
      ...vanish(16.6, at(640, 60, 300, 220)),
    ]),
    // ---- 工場長（25 秒に右から入る） ----
    actor('chief', 'chief', [
      key(0, chief('neutral', 1500, { alpha: 0 })),
      ...appear(25, chief('neutral', 1500), 0.01),
      key(27, chief('neutral', 980), 'out'),
      key(28, chief('point', 980)),
      key(30.5, chief('point', 980)),
      key(31, chief('offer', 980)),
      key(34.5, chief('offer', 980)),
      key(35.5, chief('neutral', 1500), 'in'),
    ]),
    // ---- ボルト ----
    // 工場の中（0〜6 秒）
    actor('bolt-work', 'bolt', [
      key(0, bolt('stand', 560, { face: 'tired' })),
      key(1.5, bolt('wave', 560, { face: 'tired' })),
      key(3.2, bolt('wave', 560, { face: 'tired' })),
      key(4, bolt('stand', 560)),
      ...walk(4.2, 5.8, 560, 1150, (p, x, b) => bolt(p, x, { y: GROUND + b })),
      ...vanish(5.8, bolt('walk', 1150), 0.2),
    ]),
    // 屋根の上（6〜17 秒）
    actor('bolt-roof', 'bolt', [
      key(0, roofBolt('walk', 140, { alpha: 0 })),
      ...appear(6.3, roofBolt('walk', 140)),
      ...walk(6.3, 9, 140, 560, (p, x, b) => roofBolt(p, x, { y: 560 + b })),
      key(9.5, roofBolt('sitStars', 600, { y: 590 })),
      key(12, roofBolt('sitStars', 600, { y: 590 })),
      key(13, roofBolt('sitStars', 600, { y: 590, face: 'sparkle' })),
      ...vanish(16.8, roofBolt('sitStars', 600, { y: 590 }), 0.2),
    ]),
    // 設計図・取引・スイッチ（17〜40 秒）
    actor('bolt', 'bolt', [
      key(0, bolt('walk', 760, { alpha: 0, flip: true })),
      ...appear(17, bolt('walk', 760, { flip: true }), 0.01),
      ...walk(17.01, 18.6, 760, 470, (p, x, b) => bolt(p, x, { y: GROUND + b, flip: true })),
      key(19, bolt('stagger', 470, { face: 'idle', flip: true })),
      key(20.5, bolt('lookUp', 470)),
      key(21, bolt('blueprint', 470)),
      key(25, bolt('blueprint', 470)),
      key(26, bolt('stand', 520, { face: 'surprised' })),
      key(28.5, bolt('lookUp', 520, { face: 'idle' })),
      key(31.5, bolt('shake', 520, { face: 'idle' })),
      key(32.6, bolt('nod', 520, { face: 'determined' })),
      key(34.5, bolt('nod', 520, { face: 'determined' })),
      ...walk(35, 36.6, 520, 700, (p, x, b) => bolt(p, x, { y: GROUND + b })),
      key(37.2, bolt('guts', 700)),
    ]),
  ],
  // 最後に盤面（スイッチ）へ寄る
  camera: [
    key(0, { x: W / 2, y: H / 2, zoom: 1 }),
    key(37.5, { x: W / 2, y: H / 2, zoom: 1 }),
    key(40, { x: 870, y: 560, zoom: 2.4 }, 'in'),
  ],
  tint: [
    key(0, { color: '#000000', alpha: 1 }),
    key(0.8, { color: '#000000', alpha: 0 }),
    ...blackout(6),
    ...blackout(17),
    key(38.8, { color: '#000000', alpha: 0 }),
    key(40, { color: '#000000', alpha: 1 }),
  ],
  flashes: [{ t: 12.4, duration: 0.6, alpha: 0.2, color: '#fff3c4' }],
  sounds: [
    { t: 0.4, key: 'boltBeep' },
    { t: 1.6, key: 'boltSad' },
    ...[6.6, 7.4, 8.2, 9.0].map((t) => ({ t, key: 'footstep' })),
    { t: 12.1, key: 'twinkle' },
    { t: 13.6, key: 'boltQuestion' },
    { t: 19.2, key: 'collapse' },
    { t: 21, key: 'paper' },
    { t: 21.6, key: 'boltHappy' },
    { t: 25.2, key: 'craneWinch' },
    { t: 28, key: 'chiefBuzz' },
    { t: 31, key: 'craneWinch' },
    { t: 31.6, key: 'boltQuestion' },
    { t: 32.8, key: 'boltBeep' },
    { t: 37.2, key: 'boltHappy' },
    { t: 38.4, key: 'windup' },
  ],
};
