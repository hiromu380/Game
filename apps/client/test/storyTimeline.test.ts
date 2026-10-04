import { describe, expect, it } from 'vitest';
import { CUTSCENE_CONFIG } from '../src/config/cutscene';
import { checkScene, ease, sampleScene, soundsBetween, type Scene } from '../src/story/timeline';

const FULL = { strength: 'full' as const, shake: true, reduceFlashes: false };

const scene: Scene = {
  id: 'test',
  duration: 4,
  background: '#000',
  tracks: [
    {
      kind: 'actor',
      id: 'bolt',
      character: 'bolt',
      keys: [
        { t: 0, value: { pose: 'stand', x: 100, y: 600, height: 200 } },
        { t: 2, value: { pose: 'jump', x: 300, y: 600, height: 200 }, ease: 'inOut' },
      ],
    },
    {
      kind: 'prop',
      id: 'rocket',
      asset: 'rocket-3',
      keys: [
        { t: 1, value: { x: 0, y: 0, width: 100, height: 100, alpha: 0 } },
        { t: 3, value: { x: 0, y: 0, width: 100, height: 100, alpha: 1, asset: 'rocket-6' } },
      ],
    },
  ],
  shakes: [{ t: 1, duration: 1, amplitude: 10 }],
  flashes: [{ t: 2, duration: 0.4, alpha: 0.3, color: '#fff3c4' }],
  numbers: [{ t0: 1, t1: 2, text: '3', x: 640, y: 200, size: 120 }],
  sounds: [
    { t: 0.5, key: 'a' },
    { t: 1.5, key: 'b' },
  ],
};

describe('カットシーンのタイムライン', () => {
  it('キーの間は補間し、ポーズ名は前のキーのまま（次のポーズへの途中を blend で返す）', () => {
    const f = sampleScene(scene, 1, FULL);
    expect(f.actors[0]!.x).toBeCloseTo(200);
    expect(f.actors[0]!.pose).toBe('stand');
    // ポーズは区間の終わりの poseBlendSec 秒だけで移る（それまでは前のポーズのまま）
    expect(f.actors[0]!.blend).toBeNull();
    const half = 2 - CUTSCENE_CONFIG.poseBlendSec / 2;
    const blend = sampleScene(scene, half, FULL).actors[0]!.blend!;
    expect(blend.to).toBe('jump');
    expect(blend.k).toBeCloseTo(0.5);
    // 最初のキーより前・最後のキーより後は、端の値で止まる
    expect(sampleScene(scene, 0, FULL).actors[0]!.x).toBe(100);
    expect(sampleScene(scene, 3, FULL).actors[0]!).toMatchObject({
      x: 300,
      pose: 'jump',
      blend: null,
    });
    expect(sampleScene(scene, 2, FULL).props[0]).toMatchObject({ alpha: 0.5, asset: 'rocket-3' });
    expect(sampleScene(scene, 3.5, FULL).props[0]).toMatchObject({ alpha: 1, asset: 'rocket-6' });
  });

  it('歩き（cycle）は足を入れ替えながら弾み、整数の歩数では元のポーズに戻る', () => {
    const walking: Scene = {
      ...scene,
      tracks: [
        {
          kind: 'actor',
          id: 'bolt',
          character: 'bolt',
          keys: [
            { t: 0, value: { pose: 'walk', x: 0, y: 600, height: 250, cycle: 0 }, ease: 'linear' },
            { t: 2, value: { pose: 'walk', x: 400, y: 600, height: 250, cycle: 4 } },
          ],
        },
      ],
    };
    const mid = sampleScene(walking, 0.25, FULL).actors[0]!;
    // 速さは一定、半歩で足が揃い（walk と walkB の中間）、体がいちばん上がる
    expect(mid.x).toBeCloseTo(50);
    expect(mid.blend!.to).toBe('walkB');
    expect(mid.blend!.k).toBeCloseTo(0.5);
    expect(mid.y).toBeCloseTo(600 - CUTSCENE_CONFIG.walkBob);
    expect(sampleScene(walking, 0.5, FULL).actors[0]!.blend!.k).toBeCloseTo(1);
    expect(sampleScene(walking, 2, FULL).actors[0]!).toMatchObject({ y: 600, blend: null });
  });

  it('待機中の揺れは演出「弱」では止まる', () => {
    const sway = (strength: 'full' | 'minimal') =>
      sampleScene(scene, 0.7, { ...FULL, strength }).actors[0]!.sway;
    expect(Math.abs(sway('full'))).toBeGreaterThan(0);
    expect(sway('minimal')).toBe(0);
  });

  it('同じ時刻なら毎回同じ状態（乱数を使わない）', () => {
    expect(sampleScene(scene, 1.37, FULL)).toEqual(sampleScene(scene, 1.37, FULL));
  });

  it('長さを過ぎたら終わる。上限時間を超える長さでも上限で必ず終わる', () => {
    expect(sampleScene(scene, 3.9, FULL).done).toBe(false);
    expect(sampleScene(scene, 4, FULL).done).toBe(true);
    const long = { ...scene, duration: 999 };
    expect(sampleScene(long, CUTSCENE_CONFIG.maxDurationSec, FULL).done).toBe(true);
    expect(checkScene(long)).toContain('test: 長すぎる');
  });

  it('揺れ・光は設定で弱まる（弱・揺れオフ・点滅を減らす）。光は上限を超えない', () => {
    expect(Math.abs(sampleScene(scene, 1.3, FULL).shake.x)).toBeGreaterThan(0);
    expect(sampleScene(scene, 1.3, { ...FULL, shake: false }).shake).toEqual({ x: 0, y: 0 });
    expect(sampleScene(scene, 1.3, { ...FULL, strength: 'minimal' }).shake).toEqual({ x: 0, y: 0 });
    const peak = sampleScene(scene, 2.2, FULL).flash!;
    expect(peak.alpha).toBeLessThanOrEqual(CUTSCENE_CONFIG.flashMaxAlpha);
    expect(peak.alpha).toBeGreaterThan(0);
    expect(sampleScene(scene, 2.2, { ...FULL, reduceFlashes: true }).flash).toBeNull();
    expect(sampleScene(scene, 2.2, { ...FULL, strength: 'minimal' }).flash).toBeNull();
    expect(sampleScene(scene, 2.2, { ...FULL, strength: 'reduced' }).flash!.alpha).toBeCloseTo(
      peak.alpha / 2,
    );
  });

  it('数字は出す時間だけ。効果音は区間ごとに1回だけ鳴る', () => {
    expect(sampleScene(scene, 1.5, FULL).numbers).toHaveLength(1);
    expect(sampleScene(scene, 2.5, FULL).numbers).toHaveLength(0);
    expect(soundsBetween(scene, 0, 1)).toEqual(['a']);
    expect(soundsBetween(scene, 1, 2)).toEqual(['b']);
    expect(soundsBetween(scene, 0.5, 1.5)).toEqual(['b']);
  });

  it('光の回数（1秒に3回まで）・明るさの上限を確かめる', () => {
    expect(checkScene(scene)).toEqual([]);
    const flashy = {
      ...scene,
      flashes: [0, 0.2, 0.4, 0.6].map((t) => ({ t, duration: 0.1, alpha: 0.2, color: '#fff' })),
    };
    expect(checkScene(flashy)[0]).toContain('光が1秒に4回');
    expect(
      checkScene({ ...scene, flashes: [{ t: 0, duration: 1, alpha: 0.9, color: '#fff' }] }),
    ).toContain('test: 光が明るすぎる');
  });

  it('イージングは 0 → 1 の範囲', () => {
    for (const kind of ['linear', 'in', 'out', 'inOut'] as const) {
      expect(ease(kind, 0)).toBe(0);
      expect(ease(kind, 1)).toBe(1);
      expect(ease(kind, 2)).toBe(1);
    }
  });
});
