/**
 * オープニング（約 52 秒。初めてのランの最初に1回だけ）: 夢 → 取引
 * 絵コンテ: docs/story/storyboard.html#opening
 *
 * 0〜8.6 秒   工場の中。ボルトが箱を運んで積む。見張っていた工場長（上司）が箱を指して急かし、
 *             ボルトは慌てて会釈する。工場長が去ると、汗をぬぐって伸び。初登場で名札（ボルト・工場長）
 * 8.6〜23 秒  屋根に登って腰かけ、しばらく星を眺める。流れ星を立って目で追い、消えたあとに余韻。
 *             座り直してから、だんだん思いつく（絵の吹き出し: ロケットと星）
 * 23〜34 秒   ガラクタの山をあさって設計図を見つけ、首をかしげてから気づく（設計図を画面いっぱいに）
 * 34〜46.4 秒 取引: 工場長が来て、間。ノルマの箱を指し、吹き出し「箱 → 部品」。部品を吊って見せる。
 *             ボルトは考えて、吹き出し「部品を重ねる → ロケット」。うなずく
 * 46.4〜52 秒 スイッチの前でガッツポーズ → 盤面へ寄ってゲームへ
 *
 * 台詞は使わない。伝えたいこと（取引の条件・目標）は文字のない絵の吹き出しで、人物は初登場の名札で見せる
 * 間（ま）: 出来事のあとに、反応までの短い静止を置く（見て → 気づいて → 動く）
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

/** 場面の切り替え（暗転の真ん中）: 工場の中 → 屋根の上 → 工場の中 */
const TO_ROOF = 8.6;
const TO_INSIDE = 23;

/** 外の場面（屋根の上）だけ見える絵 */
const outside = (id: string, asset: string, box: ReturnType<typeof at>) =>
  prop(id, asset, [
    key(0, { ...box, ...hidden }),
    ...appear(TO_ROOF, box, 0.01),
    ...vanish(TO_INSIDE, box, 0.01),
  ]);

/** 工場の中だけ見える絵 */
const inside = (id: string, asset: string, box: ReturnType<typeof at>) =>
  prop(id, asset, [key(0, box), ...vanish(TO_ROOF, box, 0.01), ...appear(TO_INSIDE, box, 0.01)]);

/** 名札（初登場の人物の名前。下敷きの絵と i18n の文言） */
const plate = (id: string, t0: number, t1: number, x: number, y: number) =>
  prop(`plate-${id}`, 'story:nameplate', [
    key(0, at(x - 120, y - 32, 240, 64, 0)),
    ...appear(t0, at(x - 120, y - 32, 240, 64), 0.25),
    ...vanish(t1, at(x - 120, y - 32, 240, 64), 0.25),
  ]);

export const opening: Scene = {
  id: 'opening',
  duration: 52,
  background: '#0b0d12',
  tracks: [
    // ---- 背景 ----
    outside('sky', 'story:night-sky', at(0, 0, W, H)),
    outside('town', 'story:town', at(0, 300, W, 300)),
    outside('roof', 'story:roof', at(0, 540, W, 200)),
    inside('workshop', 'story:workshop', at(0, 0, W, H)),
    // 工場の中の小物: 積んである箱・運んで積む箱（最初の場面だけ）
    ...[at(880, 510, 100, 90), at(890, 424, 90, 86)].map((box, i) =>
      prop(`stack${i}`, 'story:quota-box', [key(0, box), ...vanish(TO_ROOF, box, 0.01)]),
    ),
    prop('carried', 'story:quota-box', [
      key(0, at(780, 516, 90, 84, 0)),
      ...appear(2.5, at(780, 516, 90, 84), 0.05),
      ...vanish(TO_ROOF, at(780, 516, 90, 84), 0.01),
    ]),
    // ノルマの箱（取引の場面）
    prop('box', 'story:quota-box', [
      key(0, at(1150, 510, 100, 90, 0)),
      ...appear(34, at(1150, 510, 100, 90), 0.01),
    ]),
    prop('junk', 'story:junk', [
      key(0, at(130, 420, 310, 190, 0)),
      ...appear(TO_INSIDE, at(130, 420, 310, 190), 0.01),
      ...vanish(33.6, at(130, 420, 310, 190)),
    ]),
    prop('switch', 'part:switch', [
      key(0, at(820, 500, 110, 110, 0)),
      ...appear(46.6, at(820, 500, 110, 110)),
    ]),
    // 流れ星（ゆっくり横切る）と、あとから湧く思いつきの吹き出し
    prop('star', 'story:shooting-star', [
      key(0, at(40, 20, 520, 104, 0)),
      ...appear(14.6, at(40, 20, 520, 104), 0.2),
      key(16.4, at(760, 180, 520, 104, 0), 'out'),
    ]),
    prop('bubble', 'story:bubble', [
      key(0, at(650, 230, 30, 22, 0)),
      key(18.6, at(650, 230, 30, 22, 0), 'out'),
      key(19.5, at(640, 60, 300, 220, 1)),
      ...vanish(21.9, at(640, 60, 300, 220)),
    ]),
    // ---- 工場長 ----
    // 最初の場面: 右で見張り、ジブで箱を指して急かす → 去る
    actor('chief-boss', 'chief', [
      key(0, chief('neutral', 1130, { flip: true })),
      key(2.9, chief('neutral', 1130, { flip: true })),
      key(3.3, chief('point', 1130, { flip: true })),
      key(4.4, chief('point', 1130, { flip: true })),
      key(4.8, chief('neutral', 1130, { flip: true })),
      key(5.2, chief('neutral', 1130), 'in'),
      key(6.2, chief('neutral', 1600)),
    ]),
    // 取引の場面（34 秒に右から入る）
    actor('chief', 'chief', [
      key(0, chief('neutral', 1600, { alpha: 0 })),
      ...appear(34, chief('neutral', 1600), 0.01),
      key(36.2, chief('neutral', 980), 'out'),
      key(37.3, chief('neutral', 980)),
      key(37.7, chief('point', 980)),
      key(40.4, chief('point', 980)),
      key(40.9, chief('offer', 980)),
      key(45.8, chief('offer', 980)),
      key(46.9, chief('neutral', 1600), 'in'),
    ]),
    // ---- ボルト ----
    // 工場の中: 箱を運んで積む → 工場長に急かされ、慌てて会釈 → 工場長が去ってから、汗をぬぐって伸び
    actor('bolt-work', 'bolt', [
      key(0, bolt('carryBoxWalk', 240, { face: 'tired' })),
      ...walk(0.3, 2.2, 240, 690, (p, x) => bolt(p, x), 0.34, 'carryBoxWalk'),
      key(2.45, bolt('crouch', 700, { face: 'tired' })),
      key(2.8, bolt('stand', 700, { face: 'tired' })),
      key(3.3, bolt('stand', 700, { face: 'surprised' })),
      key(3.7, bolt('nod', 700, { face: 'surprised' })),
      key(4.4, bolt('nod', 700, { face: 'surprised' })),
      key(4.8, bolt('stand', 700, { face: 'tired' })),
      key(6.3, bolt('stand', 700, { face: 'tired' })),
      key(6.6, bolt('wipe', 700)),
      key(7.1, bolt('wipe', 700)),
      key(7.4, bolt('stretch', 700)),
      key(7.8, bolt('stretch', 700)),
      ...walk(8, 8.5, 700, 820, (p, x) => bolt(p, x)),
      ...vanish(8.5, bolt('walk', 820), 0.1),
    ]),
    // 屋根の上: 星を眺める → 流れ星を立って追う → 余韻 → 座り直して、だんだん思いつく
    actor('bolt-roof', 'bolt', [
      key(0, roofBolt('walk', 140, { alpha: 0 })),
      ...appear(TO_ROOF + 0.3, roofBolt('walk', 140)),
      ...walk(TO_ROOF + 0.3, 11.4, 140, 560, (p, x) => roofBolt(p, x)),
      key(11.9, roofBolt('sitStars', 600, { y: 590 })),
      key(14.6, roofBolt('sitStars', 600, { y: 590 })),
      key(15.1, roofBolt('pointUp', 600, { face: 'surprised' })),
      key(16.4, roofBolt('pointUp', 600, { face: 'sparkle' })),
      // 流れ星が消えたあと、しばらく空を見たまま
      key(16.8, roofBolt('lookUp', 600, { face: 'idle' })),
      key(17.6, roofBolt('lookUp', 600, { face: 'idle' })),
      key(18.1, roofBolt('sitStars', 600, { y: 590 })),
      key(19.3, roofBolt('sitStars', 600, { y: 590 })),
      key(19.6, roofBolt('sitStars', 600, { y: 590, face: 'sparkle' })),
      ...vanish(22.6, roofBolt('sitStars', 600, { y: 590, face: 'sparkle' }), 0.2),
    ]),
    // 設計図・取引・スイッチ
    actor('bolt', 'bolt', [
      key(0, bolt('walk', 760, { alpha: 0, flip: true })),
      ...appear(TO_INSIDE, bolt('walk', 760, { flip: true }), 0.01),
      ...walk(TO_INSIDE + 0.01, 24.6, 760, 470, (p, x) => bolt(p, x, { flip: true })),
      // ガラクタの山をあさる（しゃがむ・立つを2回）
      key(24.9, bolt('crouch', 470, { face: 'idle', flip: true })),
      key(25.4, bolt('stand', 470, { face: 'idle', flip: true })),
      key(25.8, bolt('crouch', 470, { face: 'idle', flip: true })),
      key(26.3, bolt('crouch', 470, { face: 'surprised', flip: true })),
      // 拾って広げ、首をかしげてから気づく
      key(26.8, bolt('blueprint', 470, { face: 'idle' })),
      key(27.4, bolt('blueprint', 470, { face: 'idle' })),
      key(27.7, bolt('blueprint', 470, { face: 'surprised' })),
      key(28.2, bolt('blueprint', 470)),
      key(33.6, bolt('blueprint', 470)),
      // 工場長が来る
      key(34.4, bolt('stand', 520, { face: 'surprised' })),
      key(37.4, bolt('stand', 520, { face: 'idle' })),
      key(40.9, bolt('stand', 520, { face: 'idle' })),
      key(41.5, bolt('think', 520)),
      key(42.9, bolt('think', 520)),
      key(43.3, bolt('stand', 520, { face: 'sparkle' })),
      key(45.4, bolt('stand', 520, { face: 'sparkle' })),
      key(45.8, bolt('nod', 520, { face: 'determined' })),
      key(46.4, bolt('nod', 520, { face: 'determined' })),
      ...walk(46.8, 48.2, 520, 700, (p, x) => bolt(p, x)),
      ...hop(48.4, (p, lift) => bolt(p, 700, { y: GROUND + lift, face: 'determined' }), 'guts'),
    ]),
    // ---- 人物より手前に出す絵 ----
    // 名札（初登場）
    plate('chief', 0.9, 2.7, 910, 120),
    plate('bolt', 2.9, 4.7, 700, 300),
    // 設計図のアップ（気づいた瞬間に、ボルトの手もとから画面いっぱいへ）
    prop('dim', 'story:dim', [
      key(0, at(0, 0, W, H, 0)),
      key(28.2, at(0, 0, W, H, 0)),
      key(28.6, at(0, 0, W, H, 0.6)),
      ...vanish(31.4, at(0, 0, W, H, 0.6), 0.4),
    ]),
    prop('plan', 'story:blueprint-close', [
      key(0, at(450, 400, 72, 46, 0)),
      key(28.2, at(450, 400, 72, 46, 0), 'out'),
      key(28.7, at(280, 110, 720, 460, 1)),
      key(31.4, at(280, 110, 720, 460, 1), 'in'),
      key(31.8, at(450, 400, 72, 46, 0)),
    ]),
    // 取引の吹き出し（工場長: 箱 → 部品 ／ ボルト: 部品を重ねる → ロケット）
    prop('deal', 'story:bubble-deal', [
      key(0, at(840, 210, 38, 20, 0)),
      key(37.8, at(840, 210, 38, 20, 0), 'out'),
      key(38.2, at(560, 40, 380, 200, 1)),
      ...vanish(40.6, at(560, 40, 380, 200)),
    ]),
    prop('dream', 'story:bubble-build', [
      key(0, at(500, 320, 37, 24, 0)),
      key(43, at(500, 320, 37, 24, 0), 'out'),
      key(43.6, at(480, 80, 370, 240, 1)),
      ...vanish(45.4, at(480, 80, 370, 240)),
    ]),
  ],
  // 最後に盤面（スイッチ）へ寄る
  camera: [
    key(0, { x: W / 2, y: H / 2, zoom: 1 }),
    key(49.4, { x: W / 2, y: H / 2, zoom: 1 }),
    key(52, { x: 870, y: 560, zoom: 2.4 }, 'in'),
  ],
  tint: [
    key(0, { color: '#000000', alpha: 1 }),
    key(0.8, { color: '#000000', alpha: 0 }),
    ...blackout(TO_ROOF),
    ...blackout(TO_INSIDE),
    key(50.8, { color: '#000000', alpha: 0 }),
    key(52, { color: '#000000', alpha: 1 }),
  ],
  captions: [
    { t0: 0.9, t1: 2.95, key: 'story.name.chief', x: 922, y: 120, size: 30 },
    { t0: 2.9, t1: 4.95, key: 'story.name.bolt', x: 712, y: 300, size: 30 },
  ],
  flashes: [{ t: 15, duration: 0.6, alpha: 0.2, color: '#fff3c4' }],
  sounds: [
    ...[0.5, 1.1, 1.7].map((t) => ({ t, key: 'footstep' })),
    { t: 2.6, key: 'landing' },
    { t: 3.3, key: 'chiefBuzz' },
    { t: 3.5, key: 'boltQuestion' },
    { t: 5.3, key: 'craneWinch' },
    { t: 6.7, key: 'boltSad' },
    { t: 7.5, key: 'boltBeep' },
    ...[9.2, 10, 10.8].map((t) => ({ t, key: 'footstep' })),
    { t: 14.8, key: 'twinkle' },
    { t: 15.2, key: 'boltQuestion' },
    { t: 19.6, key: 'boltHappy' },
    { t: 25, key: 'collapse' },
    { t: 26.8, key: 'paper' },
    { t: 27.7, key: 'boltQuestion' },
    { t: 28.4, key: 'boltHappy' },
    { t: 34.2, key: 'craneWinch' },
    { t: 37.8, key: 'chiefBuzz' },
    { t: 40.9, key: 'craneWinch' },
    { t: 41.6, key: 'boltQuestion' },
    { t: 43.4, key: 'twinkle' },
    { t: 45.9, key: 'boltBeep' },
    { t: 48.7, key: 'boltHappy' },
    { t: 50.4, key: 'windup' },
  ],
};
