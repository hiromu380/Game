/**
 * ゲームオーバー（約 4 秒。ノルマ未達・初回だけ）: 失敗 → 再挑戦
 * 工場長が首を振り、組みかけのロケットが崩れる。ボルトはしょんぼりするが、設計図を拾い直して顔を上げる
 * （冷たい色から、暖かい色に戻して終わる。「もう1回」へつなぐ）
 * 絵コンテ: docs/story/storyboard.html#gameOver
 */
import type { ActorValue, Scene } from '../timeline';
import { actor, appear, at, BOLT_H, CHIEF_H, GROUND, H, key, prop, rocketBox, W } from './build';

const bolt = (pose: string, x: number, extra: Partial<ActorValue> = {}): ActorValue => ({
  pose,
  x,
  y: GROUND,
  height: BOLT_H,
  ...extra,
});

export const gameOver: Scene = {
  id: 'gameOver',
  duration: 4.2,
  background: '#0b0d12',
  tracks: [
    prop('sky', 'story:night-sky', [key(0, at(0, 0, W, H))]),
    prop('town', 'story:town', [key(0, at(0, 320, W, 300))]),
    prop('ground', 'story:roof', [key(0, at(0, GROUND - 4, W, 200))]),
    // 組みかけのロケットが傾いて崩れる
    prop('rocket', 'rocket-5', [
      key(0, rocketBox(700, GROUND, 330)),
      key(1.2, rocketBox(700, GROUND, 330)),
      key(1.9, { ...rocketBox(740, GROUND + 60, 330), rotation: 24, alpha: 0 }, 'in'),
    ]),
    prop('scrap1', 'story:scrap', [
      key(0, at(640, 330, 136, 48, 0)),
      ...appear(1.4, at(640, 330, 136, 48), 0.1),
      key(2.1, at(580, GROUND - 40, 136, 48, 1, { rotation: -12 }), 'in'),
    ]),
    prop('scrap2', 'story:scrap', [
      key(0, at(720, 260, 110, 40, 0)),
      ...appear(1.5, at(720, 260, 110, 40), 0.1),
      key(2.2, at(800, GROUND - 34, 110, 40, 1, { rotation: 20 }), 'in'),
    ]),
    // 設計図: 崩れたロケットから舞い落ち、ボルトの前に落ちる（ボルトが拾う）
    prop('blueprint', 'story:blueprint-ground', [
      key(0, at(520, 360, 120, 46, 0)),
      ...appear(1.6, at(520, 360, 120, 46, 1, { rotation: -20 }), 0.1),
      key(2.3, at(470, GROUND - 40, 120, 46, 1, { rotation: 0 })),
      key(2.85, at(470, GROUND - 40, 120, 46, 1)),
      key(2.95, at(450, GROUND - 60, 120, 46, 0)),
    ]),
    actor('chief', 'chief', [
      key(0, { pose: 'shake', x: 990, y: GROUND, height: CHIEF_H }),
      key(0.6, { pose: 'neutral', x: 990, y: GROUND, height: CHIEF_H }),
      key(1.2, { pose: 'shake', x: 990, y: GROUND, height: CHIEF_H }),
      key(2.4, { pose: 'shake', x: 990, y: GROUND, height: CHIEF_H }),
      key(2.8, { pose: 'neutral', x: 990, y: GROUND, height: CHIEF_H }),
    ]),
    actor('bolt', 'bolt', [
      key(0, bolt('stand', 380, { face: 'surprised' })),
      key(1.2, bolt('stand', 380, { face: 'surprised' })),
      key(1.6, bolt('sad', 380)),
      key(2.4, bolt('sad', 380)),
      // 落ちた設計図に気づいて、しゃがんで拾い、顔を上げる
      key(2.7, bolt('crouch', 410, { face: 'surprised' })),
      key(2.9, bolt('crouch', 410, { face: 'idle' })),
      key(3.2, bolt('blueprint', 410, { face: 'determined' })),
    ]),
  ],
  // 冷たい色 → 最後に暖かい色へ戻す
  tint: [
    key(0, { color: '#0d1b2a', alpha: 0.2 }),
    key(1.2, { color: '#0d1b2a', alpha: 0.55 }),
    key(2.6, { color: '#0d1b2a', alpha: 0.55 }),
    key(3.4, { color: '#0d1b2a', alpha: 0 }),
  ],
  shakes: [{ t: 1.6, duration: 0.4, amplitude: 6 }],
  sounds: [
    { t: 0.1, key: 'chiefBuzz' },
    { t: 1.3, key: 'collapse' },
    { t: 1.8, key: 'boltSad' },
    { t: 2.95, key: 'paper' },
    { t: 3.2, key: 'boltBeep' },
  ],
};
