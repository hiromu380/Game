/**
 * キャラクターの部品・関節・ポーズのデータ（rig.json）の形と、アセットマニフェストの参照切れ
 */
import { describe, expect, it } from 'vitest';
import rig from '../src/assets/characters/bolt/rig.json';
import { BOLT_ASSET_PATHS } from '../src/assets/manifest';

type Pose = {
  angles?: Record<string, number>;
  offsets?: Record<string, number[]>;
  variants?: Record<string, string>;
  z?: Record<string, number>;
};

/** 切り絵アニメに必ず要る部品 */
const REQUIRED = [
  'torso',
  'head',
  ...['L', 'R'].flatMap((s) => [
    `upperArm${s}`,
    `foreArm${s}`,
    `hand${s}`,
    `thigh${s}`,
    `shin${s}`,
    `foot${s}`,
  ]),
];

describe('ボルトの部品と関節（rig.json）', () => {
  const ids = new Set(rig.parts.map((p) => p.id));

  it('必須の部品がそろい、親・回転の中心・書き出しの範囲が正しい形', () => {
    for (const id of REQUIRED) expect(ids.has(id), id).toBe(true);
    for (const part of rig.parts) {
      expect(part.parent === 'root' || ids.has(part.parent!), `${part.id} の親`).toBe(true);
      expect(part.pivot).toHaveLength(2);
      expect(part.pivot.every(Number.isFinite)).toBe(true);
      expect(part.box).toHaveLength(4);
      expect(Object.keys(part.files).length).toBeGreaterThan(0);
    }
  });

  it('部品のファイルがすべてアセットマニフェストにある（参照切れなし）', () => {
    for (const part of rig.parts) {
      for (const file of Object.values(part.files)) {
        expect(BOLT_ASSET_PATHS, `${part.id}: ${file}`).toContain(file);
      }
    }
  });

  it('ポーズ・三面図は、ある部品とある差し替えだけを使う', () => {
    const poses = { ...rig.poses, ...rig.views } as Record<string, Pose>;
    for (const [name, pose] of Object.entries(poses)) {
      const used = [
        ...Object.keys(pose.angles ?? {}),
        ...Object.keys(pose.offsets ?? {}),
        ...Object.keys(pose.z ?? {}),
      ];
      for (const id of used) expect(id === 'root' || ids.has(id), `${name}: ${id}`).toBe(true);
      for (const [id, variant] of Object.entries(pose.variants ?? {})) {
        const part = rig.parts.find((p) => p.id === id);
        expect(part, `${name}: ${id}`).toBeDefined();
        expect(Object.keys(part!.files), `${name}: ${id} = ${variant}`).toContain(variant);
      }
    }
  });

  it('ポーズ集にストーリーの身振りがそろっている', () => {
    expect(Object.keys(rig.poses)).toEqual(
      expect.arrayContaining([
        'stand',
        'walk',
        'jump',
        'nod',
        'shake',
        'point',
        'lookUp',
        'sad',
        'stagger',
        'guts',
        'wave',
        'sitStars',
        'blueprint',
      ]),
    );
    expect(BOLT_ASSET_PATHS).toEqual(
      expect.arrayContaining(Object.keys(rig.poses).map((k) => `poses/${k}.svg`)),
    );
  });
});
