/**
 * オープニング（約 40 秒。初めてのランの最初に1回だけ）: 夢 → 取引
 * 絵コンテ: docs/story/storyboard.html#opening
 *
 * 0〜6 秒   工場の中。箱を運んで積み、汗をぬぐって伸び
 * 6〜17 秒  屋根に登って腰かけ、星を見上げる。流れ星を指さす → 絵の吹き出し（ロケットと星）
 * 17〜25 秒 ガラクタの山をあさって設計図を見つけ、広げる（設計図を画面いっぱいに見せる）
 * 25〜35 秒 取引: 工場長がノルマの箱を指し、吹き出し「箱 → 部品」。部品を吊って見せる。
 *           ボルトは考えて、吹き出し「部品を重ねる → ロケット」。うなずく
 * 35〜40 秒 スイッチの前でガッツポーズ → 盤面へ寄ってゲームへ
 *
 * 台詞は使わない。伝えたいこと（取引の条件・目標）は、文字のない絵の吹き出しで見せる
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
  hop,
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
    // 工場の中の小物: 積んである箱（0〜6 秒）・運んで積む箱
    prop('stack', 'story:quota-box', [
      key(0, at(980, 510, 100, 90)),
      ...vanish(6, at(980, 510, 100, 90), 0.01),
    ]),
    prop('stack2', 'story:quota-box', [
      key(0, at(990, 424, 90, 86)),
      ...vanish(6, at(990, 424, 90, 86), 0.01),
    ]),
    prop('carried', 'story:quota-box', [
      key(0, at(800, 516, 90, 84, 0)),
      ...appear(2.5, at(800, 516, 90, 84), 0.05),
      ...vanish(6, at(800, 516, 90, 84), 0.01),
    ]),
    // ノルマの箱（取引の場面）
    prop('box', 'story:quota-box', [
      key(0, at(1150, 510, 100, 90, 0)),
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
    // 流れ星（大きく、ゆっくり横切る）と吹き出し
    prop('star', 'story:shooting-star', [
      key(0, at(40, 20, 520, 104, 0)),
      ...appear(11.9, at(40, 20, 520, 104), 0.15),
      key(13.4, at(720, 170, 520, 104, 0), 'out'),
    ]),
    prop('bubble', 'story:bubble', [
      key(0, at(760, 150, 30, 22, 0)),
      key(13.5, at(760, 150, 30, 22, 0), 'out'),
      key(14, at(640, 60, 300, 220, 1)),
      ...vanish(16.6, at(640, 60, 300, 220)),
    ]),
    // ---- 工場長（25 秒に右から入る） ----
    actor('chief', 'chief', [
      key(0, chief('neutral', 1500, { alpha: 0 })),
      ...appear(25, chief('neutral', 1500), 0.01),
      key(27, chief('neutral', 980), 'out'),
      key(27.8, chief('point', 980)),
      key(30.6, chief('point', 980)),
      key(31.2, chief('offer', 980)),
      key(34.4, chief('offer', 980)),
      key(35.5, chief('neutral', 1500), 'in'),
    ]),
    // ---- ボルト ----
    // 工場の中（0〜6 秒）: 箱を運んで積む → 汗をぬぐう → 伸び → 外へ
    actor('bolt-work', 'bolt', [
      key(0, bolt('carryBoxWalk', 260, { face: 'tired' })),
      ...walk(0.3, 2.3, 260, 760, (p, x) => bolt(p, x), 0.34, 'carryBoxWalk'),
      key(2.5, bolt('crouch', 770, { face: 'tired' })),
      key(2.8, bolt('stand', 770, { face: 'tired' })),
      key(3.2, bolt('wipe', 770)),
      key(3.9, bolt('wipe', 770)),
      key(4.3, bolt('stretch', 770)),
      key(4.9, bolt('stretch', 770)),
      ...walk(5.2, 5.9, 770, 1000, (p, x) => bolt(p, x)),
      ...vanish(5.9, bolt('walk', 1000), 0.1),
    ]),
    // 屋根の上（6〜17 秒）
    actor('bolt-roof', 'bolt', [
      key(0, roofBolt('walk', 140, { alpha: 0 })),
      ...appear(6.3, roofBolt('walk', 140)),
      ...walk(6.3, 9, 140, 560, (p, x) => roofBolt(p, x)),
      key(9.5, roofBolt('sitStars', 600, { y: 590 })),
      key(11.7, roofBolt('sitStars', 600, { y: 590 })),
      // 流れ星に気づいて立ち上がり、指さす
      key(12.1, roofBolt('pointUp', 600, { face: 'sparkle' })),
      key(13.4, roofBolt('pointUp', 600, { face: 'sparkle' })),
      key(13.8, roofBolt('lookUp', 600, { face: 'sparkle' })),
      ...vanish(16.8, roofBolt('lookUp', 600, { face: 'sparkle' }), 0.2),
    ]),
    // 設計図・取引・スイッチ（17〜40 秒）
    actor('bolt', 'bolt', [
      key(0, bolt('walk', 760, { alpha: 0, flip: true })),
      ...appear(17, bolt('walk', 760, { flip: true }), 0.01),
      ...walk(17.01, 18.6, 760, 470, (p, x) => bolt(p, x, { flip: true })),
      // ガラクタの山をあさる（しゃがむ・立つを2回）
      key(18.9, bolt('crouch', 470, { face: 'idle', flip: true })),
      key(19.3, bolt('stand', 470, { face: 'idle', flip: true })),
      key(19.6, bolt('crouch', 470, { face: 'idle', flip: true })),
      key(20, bolt('crouch', 470, { face: 'surprised', flip: true })),
      key(20.4, bolt('blueprint', 470)),
      key(25, bolt('blueprint', 470)),
      key(25.6, bolt('stand', 520, { face: 'surprised' })),
      key(28.4, bolt('stand', 520, { face: 'idle' })),
      key(31.2, bolt('stand', 520, { face: 'idle' })),
      key(31.6, bolt('think', 520)),
      key(32.4, bolt('think', 520)),
      key(32.8, bolt('stand', 520, { face: 'sparkle' })),
      key(34.2, bolt('stand', 520, { face: 'sparkle' })),
      key(34.6, bolt('nod', 520, { face: 'determined' })),
      key(35, bolt('nod', 520, { face: 'determined' })),
      ...walk(35.3, 36.7, 520, 700, (p, x) => bolt(p, x)),
      ...hop(36.8, (p, lift) => bolt(p, 700, { y: GROUND + lift, face: 'determined' }), 'guts'),
    ]),
    // ---- 人物より手前に出す絵 ----
    // 設計図のアップ（広げた瞬間に、ボルトの手もとから画面いっぱいへ）
    prop('dim', 'story:dim', [
      key(0, at(0, 0, W, H, 0)),
      key(21.3, at(0, 0, W, H, 0)),
      key(21.7, at(0, 0, W, H, 0.6)),
      ...vanish(23.9, at(0, 0, W, H, 0.6), 0.4),
    ]),
    prop('plan', 'story:blueprint-close', [
      key(0, at(450, 400, 72, 46, 0)),
      key(21.3, at(450, 400, 72, 46, 0), 'out'),
      key(21.8, at(280, 110, 720, 460, 1)),
      key(23.9, at(280, 110, 720, 460, 1), 'in'),
      key(24.3, at(450, 400, 72, 46, 0)),
    ]),
    // 取引の吹き出し（工場長: 箱 → 部品 ／ ボルト: 部品を重ねる → ロケット）
    prop('deal', 'story:bubble-deal', [
      key(0, at(840, 210, 38, 20, 0)),
      key(28.2, at(840, 210, 38, 20, 0), 'out'),
      key(28.6, at(560, 40, 380, 200, 1)),
      ...vanish(31, at(560, 40, 380, 200)),
    ]),
    prop('dream', 'story:bubble-build', [
      key(0, at(500, 320, 37, 24, 0)),
      key(32.2, at(500, 320, 37, 24, 0), 'out'),
      key(32.6, at(480, 80, 370, 240, 1)),
      ...vanish(34.4, at(480, 80, 370, 240)),
    ]),
  ],
  // 最後に盤面（スイッチ）へ寄る
  camera: [
    key(0, { x: W / 2, y: H / 2, zoom: 1 }),
    key(37.6, { x: W / 2, y: H / 2, zoom: 1 }),
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
  flashes: [{ t: 12.3, duration: 0.6, alpha: 0.2, color: '#fff3c4' }],
  sounds: [
    ...[0.5, 1.1, 1.7].map((t) => ({ t, key: 'footstep' })),
    { t: 2.7, key: 'landing' },
    { t: 3.3, key: 'boltSad' },
    { t: 4.4, key: 'boltBeep' },
    ...[6.6, 7.4, 8.2, 9.0].map((t) => ({ t, key: 'footstep' })),
    { t: 12, key: 'twinkle' },
    { t: 12.2, key: 'boltQuestion' },
    { t: 13.8, key: 'boltHappy' },
    { t: 19, key: 'collapse' },
    { t: 20.4, key: 'paper' },
    { t: 21.6, key: 'boltHappy' },
    { t: 25.2, key: 'craneWinch' },
    { t: 28, key: 'chiefBuzz' },
    { t: 31.2, key: 'craneWinch' },
    { t: 31.7, key: 'boltQuestion' },
    { t: 32.8, key: 'twinkle' },
    { t: 34.7, key: 'boltBeep' },
    { t: 37.1, key: 'boltHappy' },
    { t: 38.4, key: 'windup' },
  ],
};
