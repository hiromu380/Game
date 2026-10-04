/**
 * 体験版の予告（約 6 秒。体験版で全シフトをクリアしたとき・エンディングの代わり）: 期待
 * 暗い空に完成したロケットのシルエットが浮かび、「つづきは製品版で」（i18n の文言）
 */
import type { Scene } from '../timeline';
import { at, GROUND, H, key, prop, rocketBox, W } from './build';

export const demoTeaser: Scene = {
  id: 'demoTeaser',
  duration: 6,
  background: '#0b0d12',
  tracks: [
    prop('sky', 'story:night-sky', [key(0, at(0, 0, W, H))]),
    prop('town', 'story:town', [key(0, at(0, 320, W, 300))]),
    prop('rocket', 'rocket-9', [
      key(0, rocketBox(640, GROUND, 300, 0)),
      key(1.5, rocketBox(640, GROUND - 20, 320, 1), 'out'),
      key(6, rocketBox(640, GROUND - 40, 340, 1)),
    ]),
  ],
  // 全体を暗くして、ロケットをシルエットに近く見せる
  tint: [
    key(0, { color: '#05060a', alpha: 1 }),
    key(1.5, { color: '#05060a', alpha: 0.55 }),
    key(5.4, { color: '#05060a', alpha: 0.55 }),
    key(6, { color: '#05060a', alpha: 1 }),
  ],
  captions: [{ t0: 3, t1: 5.8, key: 'story.demoTeaser', x: 640, y: 660, size: 40 }],
  sounds: [
    { t: 0.5, key: 'twinkle' },
    { t: 3, key: 'boltBeep' },
  ],
};
