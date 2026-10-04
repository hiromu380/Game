/**
 * エンディング（約 55 秒。全シフトクリア・製品版・初回だけ）: 達成 → 次回作への伏線
 * 絵コンテ: docs/story/storyboard.html#ending
 *
 * 0〜8 秒   最後の部品を取り付け、ロケットが完成
 * 8〜14 秒  工場長が初めてヘルメットを上げる（目が和らぐ）
 * 14〜22 秒 ボルトが乗り込む。カウントダウン（数字だけ）
 * 22〜31 秒 打ち上げ。工場街が下へ流れ、工場長が見上げる
 * 31〜42 秒 月に着く。ボルトが降りて跳ねる。遠くに地球
 * 42〜50 秒 伏線: 足もとから光の連鎖が地平線へ走り、見知らぬ工場の窓が灯る。水色のアンテナが点滅を返す
 * 50〜52 秒 ロゴ
 * 52〜55 秒 伏線: 地球の工場で、工場長が古い写真（水色のアンテナのロボと、別のロケット）を見る
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
/** 月での着地の位置（ボルトの右へ光の連鎖が延びるよう、ロケットは左に降りる） */
const MOON_X = 330;

export const ending: Scene = {
  id: 'ending',
  duration: 55,
  background: '#0b0d12',
  tracks: [
    // ---- 地上（0〜31 秒） ----
    earth('sky', 'story:night-sky', [key(0, at(0, 0, W, H))]),
    earth('town', 'story:town', [
      key(0, at(0, 320, W, 300)),
      key(24, at(0, 320, W, 300)),
      key(30, at(0, 900, W, 300), 'in'),
    ]),
    earth('ground', 'story:roof', [
      key(0, at(0, GROUND - 4, W, 200)),
      key(24, at(0, GROUND - 4, W, 200)),
      key(30, at(0, 1200, W, 200), 'in'),
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
    prop('lamp', 'story:stranger-lamp-off', [
      key(0, at(1075, 330, 50, 70, 0)),
      ...appear(31.5, at(1075, 330, 50, 70), 0.01),
      key(47, { ...at(1075, 330, 50, 70), asset: 'story:stranger-lamp-on' }),
      key(47.3, { ...at(1075, 330, 50, 70), asset: 'story:stranger-lamp-off' }),
      key(47.6, { ...at(1075, 330, 50, 70), asset: 'story:stranger-lamp-on' }),
      ...vanish(50, { ...at(1075, 330, 50, 70), asset: 'story:stranger-lamp-on' }, 0.01),
    ]),
    // 光の連鎖（ボルトの足もと → 地平線の工場）
    prop('chain', 'story:light-line', [
      key(0, at(630, 540, 0, 40, 0)),
      key(42.5, at(630, 540, 0, 40, 1)),
      key(44.5, at(630, 500, 400, 40, 1, { rotation: -5 }), 'inOut'),
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
      key(24, flameAt(GROUND - 60)),
      key(30, flameAt(-700), 'in'),
      key(31, flameAt(-700, 0)),
      // 月への着地（上から降りてきて止まる）
      key(31.6, flameAt(-200, 0, MOON_X)),
      key(31.8, flameAt(-200, 1, MOON_X)),
      key(34, flameAt(560, 1, MOON_X), 'out'),
      key(34.5, flameAt(560, 0, MOON_X)),
    ]),
    prop('rocket', 'rocket-8', [
      key(0, rocketAt(GROUND)),
      key(1.5, { ...rocketAt(GROUND), asset: 'rocket-9' }),
      key(22, { ...rocketAt(GROUND), asset: 'rocket-9' }),
      key(24, { ...rocketAt(GROUND - 60), asset: 'rocket-9' }),
      key(30, { ...rocketAt(-700), asset: 'rocket-9' }, 'in'),
      key(31.59, { ...rocketAt(-700), asset: 'rocket-9' }),
      key(31.6, { ...rocketAt(-200, 1, MOON_X), asset: 'rocket-9' }),
      key(34, { ...rocketAt(560, 1, MOON_X), asset: 'rocket-9' }, 'out'),
      ...vanish(50, { ...rocketAt(560, 1, MOON_X), asset: 'rocket-9' }, 0.01),
    ]),
    actor('chief', 'chief', [
      key(0, chief('offer', 1100)),
      key(1.4, chief('neutral', 1100)),
      key(8.6, chief('neutral', 1100)),
      key(9.4, chief('tip', 1100)),
      key(13, chief('tip', 1100)),
      key(14, chief('neutral', 1100)),
      key(22, chief('neutral', 1100)),
      key(23, chief('surprised', 1100)),
      key(24, chief('surprised', 1100)),
      key(30, chief('surprised', 1100, { y: 1200 }), 'in'),
      ...vanish(31, chief('surprised', 1100, { y: 1200 }), 0.01),
    ]),
    actor('bolt-earth', 'bolt', [
      key(0, bolt('stand', 360)),
      key(1.5, bolt('guts', 360, { face: 'sparkle' })),
      key(4, bolt('jump', 360, { face: 'sparkle' })),
      key(5, bolt('guts', 360, { face: 'sparkle' })),
      key(8.4, bolt('stand', 360, { face: 'happy' })),
      key(9.6, bolt('wave', 360)),
      key(13, bolt('wave', 360)),
      ...walk(14, 16.2, 360, 600, (p, x, b) => bolt(p, x, { y: GROUND + b })),
      // 窓へ乗り込む（ロケットの窓にボルトの顔が描いてある）
      ...vanish(16.4, bolt('jump', 640, { y: GROUND - 120, height: 160 }), 0.4),
    ]),
    actor('bolt-moon', 'bolt', [
      key(0, bolt('stand', 600, { y: 560, height: 210, alpha: 0 })),
      ...appear(35, bolt('stand', 600, { y: 560, height: 210 }), 0.3),
      key(35.6, bolt('jump', 600, { y: 560, height: 210 })),
      key(36.4, bolt('stand', 600, { y: 560, height: 210 })),
      key(37, bolt('jump', 600, { y: 560, height: 210 })),
      key(37.8, bolt('wave', 600, { y: 560, height: 210, face: 'happy' })),
      key(42, bolt('stand', 600, { y: 560, height: 210, face: 'surprised' })),
      key(44.6, bolt('lookUp', 600, { y: 560, height: 210, face: 'sparkle' })),
      key(47.4, bolt('lookUp', 600, { y: 560, height: 210, face: 'surprised' })),
      ...vanish(50, bolt('lookUp', 600, { y: 560, height: 210, face: 'surprised' }), 0.01),
    ]),
    // ---- ロゴ（50〜52 秒） ----
    prop('logo', 'logo', [
      key(0, at(390, 260, 500, 178, 0)),
      ...appear(50.4, at(390, 260, 500, 178), 0.4),
      ...vanish(51.6, at(390, 260, 500, 178), 0.4),
    ]),
    // ---- 地球の工場（52〜55 秒）: 工場長と古い写真 ----
    prop('earth-night', 'story:earth-night', [
      key(0, at(0, 0, W, H, 0)),
      ...appear(52.4, at(0, 0, W, H), 0.4),
    ]),
    prop('photo', 'story:photo', [
      key(0, at(760, 150, 240, 198, 0, { rotation: 4 })),
      ...appear(52.6, at(760, 150, 240, 198, 1, { rotation: 4 }), 0.4),
    ]),
    actor('chief-alone', 'chief', [
      key(0, chief('neutral', 470, { alpha: 0, face: 'soft' })),
      ...appear(52.6, chief('neutral', 470, { face: 'soft' }), 0.4),
    ]),
  ],
  tint: [
    key(0, { color: '#000000', alpha: 1 }),
    key(0.6, { color: '#000000', alpha: 0 }),
    key(31, { color: '#000000', alpha: 0 }),
    key(31.4, { color: '#000000', alpha: 1 }),
    key(32, { color: '#000000', alpha: 0 }),
    key(49, { color: '#000000', alpha: 0 }),
    key(50, { color: '#000000', alpha: 1 }),
    key(50.1, { color: '#000000', alpha: 0 }),
    key(54.3, { color: '#000000', alpha: 0 }),
    key(55, { color: '#000000', alpha: 1 }),
  ],
  numbers: [
    { t0: 17, t1: 18, text: '3', x: 1000, y: 200, size: 150 },
    { t0: 18, t1: 19, text: '2', x: 1000, y: 200, size: 150 },
    { t0: 19, t1: 20, text: '1', x: 1000, y: 200, size: 150 },
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
    ...[14.3, 14.9, 15.5].map((t) => ({ t, key: 'footstep' })),
    { t: 17, key: 'countdown' },
    { t: 18, key: 'countdown' },
    { t: 19, key: 'countdown' },
    { t: 22, key: 'launch' },
    { t: 34, key: 'landing' },
    { t: 35.7, key: 'boltHappy' },
    { t: 42.6, key: 'chain0' },
    { t: 43.3, key: 'chain1' },
    { t: 44, key: 'chain2' },
    ...[44.6, 45, 45.4, 45.8, 46.2].map((t) => ({ t, key: 'tick' })),
    { t: 47, key: 'strangerBeep' },
    { t: 47.5, key: 'boltQuestion' },
    { t: 53.6, key: 'strangerBeep' },
  ],
};
