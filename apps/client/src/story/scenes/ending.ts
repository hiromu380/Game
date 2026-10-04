/**
 * エンディング（約 55 秒。全シフトクリア・製品版・初回だけ）: 達成 → 次回作への伏線
 * 絵コンテ: docs/story/storyboard.html#ending
 *
 * 0〜8 秒   最後の部品を運んで取り付け、ロケットが完成（窓はまだ空）
 * 8〜14 秒  工場長が初めてヘルメットを上げる（目が和らぐ）
 * 14〜22 秒 ボルトがはしごを登って乗り込み、窓に顔が出る。カウントダウン（数字だけ）
 * 22〜31 秒 打ち上げ。工場街が下へ流れ、工場長が見上げる
 * 31〜42 秒 月に着く。ボルトが降りて跳ねる。遠くに地球
 * 42〜50 秒 伏線: 足もとから光の連鎖が地平線へ走り、見知らぬ工場の窓が灯る（カメラが寄る）。
 *           水色のアンテナが点滅を返し、ボルトが指さして手を振り返す
 * 50〜52 秒 ロゴ
 * 52〜57 秒 伏線: 地球の工場で、工場長が古い写真（水色のアンテナのロボと、別のロケット）を見つめる。写真へ寄る
 */
import type { ActorValue, PropValue, Scene } from '../timeline';
import {
  actor,
  appear,
  at,
  BOLT_H,
  CHIEF_H,
  GROUND,
  H,
  hop,
  key,
  prop,
  rocketBox,
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

/** 地上の場面（0〜31 秒）だけ見える絵 */
const earth = (id: string, asset: string, keys: ReturnType<typeof key<PropValue>>[]) =>
  prop(id, asset, [...keys, ...vanish(31.4, keys[keys.length - 1]!.value, 0.01)]);

/** ロケットの位置（発射の上昇・月への着地） */
const R_H = 360;
const rocketAt = (bottom: number, alpha = 1, cx = 640) => rocketBox(cx, bottom, R_H, alpha);
/** 炎（ロケットのノズルの下） */
const flameAt = (bottom: number, alpha = 1, cx = 640) =>
  at(cx - 70, bottom - R_H * 0.08, 140, 114, alpha);
/** 写真の左上（工場長のフックの先に下げる） */
const PHOTO = { x: 520, y: 462 };
/** 月での着地の位置（ボルトの右へ光の連鎖が延びるよう、ロケットは左に降りる） */
const MOON_X = 330;

/** はしご（ロケットの右に立てかける）と、窓（乗り込む先） */
const LADDER = at(792, 420, 44, 180);
const WINDOW = { x: 640, y: 452 };
const moonBolt = (pose: string, x: number, extra: Partial<ActorValue> = {}) =>
  bolt(pose, x, { y: 560, height: 210, ...extra });
const lampAt = (asset: string, alpha = 1) => ({
  ...at(1068, 316, 64, 90, alpha),
  asset: `story:stranger-lamp-${asset}`,
});

export const ending: Scene = {
  id: 'ending',
  duration: 57,
  background: '#0b0d12',
  tracks: [
    // ---- 地上（0〜31 秒） ----
    earth('sky', 'story:night-sky', [key(0, at(0, 0, W, H))]),
    earth('town', 'story:town', [
      key(0, at(0, 320, W, 300)),
      key(24, at(0, 320, W, 300), 'in'),
      key(30, at(0, 900, W, 300)),
    ]),
    earth('ground', 'story:roof', [
      key(0, at(0, GROUND - 4, W, 200)),
      key(24, at(0, GROUND - 4, W, 200), 'in'),
      key(30, at(0, 1200, W, 200)),
    ]),
    // ---- 月（31〜50 秒） ----
    prop('moon', 'story:moon', [
      key(0, at(0, 0, W, H, 0)),
      ...appear(31.5, at(0, 0, W, H), 0.01),
      ...vanish(50, at(0, 0, W, H), 0.01),
    ]),
    prop('far', 'story:far-factory-0', [
      key(0, at(1010, 404, 200, 124, 0)),
      ...appear(31.5, at(1010, 404, 200, 124), 0.01),
      ...[1, 2, 3, 4, 5].map((n, i) =>
        key(44.6 + i * 0.4, { ...at(1010, 404, 200, 124), asset: `story:far-factory-${n}` }),
      ),
      ...vanish(50, { ...at(1010, 404, 200, 124), asset: 'story:far-factory-5' }, 0.01),
    ]),
    // 水色のアンテナ: 窓が灯ったあと、点滅して応える（ボルトが手を振り返すと、もう一度）
    prop('lamp', 'story:stranger-lamp-off', [
      key(0, lampAt('off', 0)),
      ...appear(31.5, lampAt('off'), 0.01),
      key(47, lampAt('on')),
      key(47.3, lampAt('off')),
      key(47.6, lampAt('on')),
      key(48, lampAt('off')),
      key(48.8, lampAt('on')),
      ...vanish(50, lampAt('on'), 0.01),
    ]),
    // 光の連鎖（ボルトの足もと → 地平線の工場）
    prop('chain', 'story:light-line', [
      key(0, at(630, 540, 0, 40, 0)),
      key(42.5, at(630, 540, 0, 40, 1)),
      key(44.5, at(630, 500, 400, 40, 1, { rotation: -5 })),
      ...vanish(50, at(630, 500, 400, 40, 1, { rotation: -5 }), 0.01),
    ]),
    prop('smoke', 'smoke', [
      key(0, at(460, 520, 360, 240, 0)),
      ...appear(22.4, at(460, 520, 360, 240), 0.2),
      key(26, at(300, 440, 680, 450, 0)),
    ]),
    prop('flame', 'flame', [
      key(0, flameAt(GROUND, 0)),
      ...appear(22.2, flameAt(GROUND), 0.1),
      // ゆっくり浮き、だんだん速く（途中で止まらないよう1区間で）
      key(22.2, flameAt(GROUND), 'in'),
      key(30, flameAt(-300)),
      key(31, flameAt(-300, 0)),
      // 月への着地（上から降りてきて止まる）
      key(31.6, flameAt(-200, 0, MOON_X)),
      key(31.8, flameAt(-200, 1, MOON_X), 'out'),
      key(34, flameAt(560, 1, MOON_X)),
      key(34.5, flameAt(560, 0, MOON_X)),
    ]),
    // ロケット: 完成までは窓が空。ボルトが乗り込むと窓に顔が出る
    prop('rocket', 'story:rocket-empty-8', [
      key(0, rocketAt(GROUND)),
      key(1.5, { ...rocketAt(GROUND), asset: 'story:rocket-empty-9' }),
      key(17.3, { ...rocketAt(GROUND), asset: 'rocket-9' }),
      key(22.2, { ...rocketAt(GROUND), asset: 'rocket-9' }, 'in'),
      key(30, { ...rocketAt(-300), asset: 'rocket-9' }),
      key(31.59, { ...rocketAt(-300), asset: 'rocket-9' }),
      key(31.6, { ...rocketAt(-200, 1, MOON_X), asset: 'rocket-9' }, 'out'),
      key(34, { ...rocketAt(560, 1, MOON_X), asset: 'rocket-9' }),
      ...vanish(50, { ...rocketAt(560, 1, MOON_X), asset: 'rocket-9' }, 0.01),
    ]),
    prop('ladder', 'story:ladder', [key(0, LADDER), ...vanish(21.4, LADDER, 0.4)]),
    actor('chief', 'chief', [
      key(0, chief('neutral', 1100)),
      key(8.6, chief('neutral', 1100)),
      key(9.4, chief('tip', 1100)),
      key(13, chief('tip', 1100)),
      key(14, chief('neutral', 1100)),
      key(22, chief('neutral', 1100)),
      key(23, chief('surprised', 1100)),
      key(24, chief('surprised', 1100), 'in'),
      key(29, chief('surprised', 1100, { y: 1500 })),
    ]),
    actor('bolt-earth', 'bolt', [
      // 最後の部品を運んで取り付ける
      key(0, bolt('carryWalk', 1000, { flip: true })),
      ...walk(0.1, 1.0, 1000, 850, (p, x) => bolt(p, x, { flip: true }), 0.3, 'carryWalk'),
      key(1.2, bolt('install', 850, { flip: true })),
      key(1.6, bolt('install', 850, { flip: true })),
      key(1.9, bolt('guts', 850, { face: 'sparkle' })),
      ...hop(3.2, (p, l) => bolt(p, 850, { y: GROUND + l, face: 'sparkle' }), 'guts'),
      ...hop(4.2, (p, l) => bolt(p, 850, { y: GROUND + l, face: 'sparkle' }), 'guts'),
      key(8.4, bolt('stand', 850, { face: 'happy' })),
      key(9.6, bolt('wave', 850)),
      key(13, bolt('wave', 850)),
      // はしごを登って、窓から乗り込む
      key(13.6, bolt('stand', 850, { face: 'happy' })),
      ...walk(13.8, 14.4, 850, 814, (p, x) => bolt(p, x, { flip: true })),
      key(14.6, bolt('climb', 814, { cycle: 0 }), 'linear'),
      key(16.6, bolt('climb', 790, { y: 470, cycle: 6 })),
      key(16.8, bolt('climb', 760, { y: 470, height: 200 })),
      key(17.2, bolt('climb', WINDOW.x, { y: WINDOW.y + 20, height: 90, alpha: 0 })),
    ]),
    actor('bolt-moon', 'bolt', [
      key(0, moonBolt('walk', 420, { alpha: 0 })),
      ...appear(35, moonBolt('walk', 420), 0.3),
      ...walk(35, 35.9, 420, 600, (p, x) => moonBolt(p, x)),
      ...hop(36.1, (p, l) => moonBolt(p, 600, { y: 560 + l, face: 'happy' }), 'stand', 50),
      ...hop(37, (p, l) => moonBolt(p, 600, { y: 560 + l, face: 'happy' }), 'wave', 50),
      key(41.6, moonBolt('wave', 600, { face: 'happy' })),
      key(42.2, moonBolt('stand', 600, { face: 'surprised' })),
      key(44.6, moonBolt('stand', 600, { face: 'sparkle' })),
      key(47.1, moonBolt('stand', 600, { face: 'sparkle' })),
      // アンテナの点滅に気づいて指さし、手を振り返す
      key(47.4, moonBolt('point', 600, { face: 'surprised' })),
      key(48.1, moonBolt('point', 600, { face: 'surprised' })),
      key(48.4, moonBolt('wave', 600, { face: 'happy' })),
      ...vanish(50, moonBolt('wave', 600, { face: 'happy' }), 0.01),
    ]),
    // ---- ロゴ（50〜52 秒） ----
    prop('logo', 'logo', [
      key(0, at(390, 260, 500, 178, 0)),
      ...appear(50.6, at(390, 260, 500, 178), 0.4),
      ...vanish(51.8, at(390, 260, 500, 178), 0.4),
    ]),
    // ---- 地球の工場（52〜57 秒）: 工場長が古い写真を見つめる ----
    prop('earth-night', 'story:earth-night', [
      key(0, at(0, 0, W, H, 0)),
      ...appear(52.6, at(0, 0, W, H), 0.4),
    ]),
    actor('chief-alone', 'chief', [
      key(0, chief('gaze', 420, { alpha: 0 })),
      ...appear(52.6, chief('gaze', 420), 0.4),
    ]),
    prop('photo', 'story:photo', [
      key(0, at(PHOTO.x, PHOTO.y, 240, 198, 0, { rotation: 4 })),
      ...appear(52.6, at(PHOTO.x, PHOTO.y, 240, 198, 1, { rotation: 4 }), 0.4),
    ]),
  ],
  camera: [
    key(0, { x: W / 2, y: H / 2, zoom: 1 }),
    // 伏線: 地平線の工場とボルトを一緒に見せる
    key(42.6, { x: W / 2, y: H / 2, zoom: 1 }),
    key(44.8, { x: 860, y: 430, zoom: 1.5 }),
    key(49.99, { x: 860, y: 430, zoom: 1.5 }),
    key(50, { x: W / 2, y: H / 2, zoom: 1 }),
    // 写真へ寄る（中身が読める大きさまで）
    key(53.6, { x: W / 2, y: H / 2, zoom: 1 }),
    key(55.2, { x: PHOTO.x + 120, y: PHOTO.y + 99, zoom: 2.4 }),
  ],
  tint: [
    key(0, { color: '#000000', alpha: 1 }),
    key(0.6, { color: '#000000', alpha: 0 }),
    // ロケットが空へ抜けたら暗転して月へ（空だけの間を作らない）
    key(28.3, { color: '#000000', alpha: 0 }),
    key(29.1, { color: '#000000', alpha: 1 }),
    key(31.5, { color: '#000000', alpha: 1 }),
    key(32, { color: '#000000', alpha: 0 }),
    key(49.2, { color: '#000000', alpha: 0 }),
    key(50, { color: '#000000', alpha: 1 }),
    key(50.5, { color: '#000000', alpha: 0 }),
    key(56.2, { color: '#000000', alpha: 0 }),
    key(57, { color: '#000000', alpha: 1 }),
  ],
  // カウントダウン（ロケットの上。工場長の顔に重ならない位置）
  numbers: [
    { t0: 18.6, t1: 19.4, text: '3', x: 640, y: 140, size: 150 },
    { t0: 19.6, t1: 20.4, text: '2', x: 640, y: 140, size: 150 },
    { t0: 20.6, t1: 21.4, text: '1', x: 640, y: 140, size: 150 },
  ],
  // 光は短く・控えめに（上限 0.35 の内側。1秒に3回まで）
  flashes: [
    { t: 1.5, duration: 0.6, alpha: 0.25, color: '#fff3c4' },
    { t: 22.1, duration: 0.8, alpha: 0.3, color: '#ffb74d' },
  ],
  shakes: [
    { t: 22, duration: 2.5, amplitude: 7 },
    { t: 34, duration: 0.5, amplitude: 6 },
  ],
  sounds: [
    { t: 1.4, key: 'clank' },
    { t: 1.6, key: 'quotaMet' },
    { t: 2, key: 'boltHappy' },
    { t: 9.4, key: 'chiefSoft' },
    { t: 10, key: 'boltBeep' },
    ...[14.7, 15.3, 15.9, 16.5].map((t) => ({ t, key: 'footstep' })),
    { t: 17.4, key: 'clank' },
    { t: 17.7, key: 'boltBeep' },
    { t: 18.6, key: 'countdown' },
    { t: 19.6, key: 'countdown' },
    { t: 20.6, key: 'countdown' },
    { t: 22, key: 'launch' },
    { t: 34, key: 'landing' },
    { t: 36.2, key: 'boltHappy' },
    { t: 42.6, key: 'chain0' },
    { t: 43.3, key: 'chain1' },
    { t: 44, key: 'chain2' },
    ...[44.6, 45, 45.4, 45.8, 46.2].map((t) => ({ t, key: 'tick' })),
    { t: 47, key: 'strangerBeep' },
    { t: 47.5, key: 'boltQuestion' },
    { t: 48.5, key: 'boltHappy' },
    { t: 48.8, key: 'strangerBeep' },
    { t: 55.2, key: 'strangerBeep' },
  ],
};
