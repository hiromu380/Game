import { describe, expect, it } from 'vitest';
import { blendPose, placeParts, resolvePose } from '../src/story/rig';

describe('切り絵アニメの計算', () => {
  it('ポーズ名からポーズを求め、表情だけ差し替えられる。知らない名前は空のポーズ', () => {
    expect(resolvePose('bolt', 'jump').variants?.head).toBe('happy');
    expect(resolvePose('bolt', 'jump', 'surprised').variants?.head).toBe('surprised');
    expect(resolvePose('chief', 'tip', 'stern').variants?.cab).toBe('stern');
    expect(resolvePose('bolt', 'nothing')).toEqual({});
  });

  it('2つのポーズの間は角度・ずれを補間する', () => {
    const mid = blendPose(
      { angles: { head: 0 } },
      { angles: { head: 10 }, offsets: { root: [0, -10] } },
      0.5,
    );
    expect(mid.angles!.head).toBe(5);
    expect(mid.offsets!.root).toEqual([0, -5]);
  });

  it('部品は親の関節からつながって動く（胴を回すと頭もついてくる）', () => {
    const stand = placeParts('bolt', {});
    const leaning = placeParts('bolt', { angles: { torso: 90 } });
    const head = (list: typeof stand) => list.find((p) => p.id === 'head')!.matrix;
    // 立ち: 頭の関節は真上（x = 0）。胴を 90 度回すと、頭の関節が横へ動く
    expect(head(stand)[4]).toBeCloseTo(0);
    expect(Math.abs(head(leaning)[4])).toBeGreaterThan(30);
    // 小物・効果の線は、指定したときだけ出す
    expect(stand.some((p) => p.id === 'prop' || p.id === 'fx')).toBe(false);
    expect(placeParts('bolt', resolvePose('bolt', 'stagger')).some((p) => p.id === 'prop')).toBe(
      true,
    );
  });

  it('重なり順で並び、ポーズの z の指定で入れ替わる', () => {
    const parts = placeParts('bolt', {});
    const zs = parts.map((p) => p.z);
    expect(zs).toEqual([...zs].sort((a, b) => a - b));
    const side = placeParts('bolt', resolvePose('bolt', 'walk'));
    expect(side.findIndex((p) => p.id === 'upperArmL')).toBeLessThan(
      side.findIndex((p) => p.id === 'torso'),
    );
  });
});
