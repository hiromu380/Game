/**
 * キャラクターの部品・関節・ポーズのデータ（rig.json）の形と、アセットマニフェストの参照切れ
 */
import { describe, expect, it } from 'vitest';
import boltRig from '../src/assets/characters/bolt/rig.json';
import chiefRig from '../src/assets/characters/chief/rig.json';
import { characterAssetPaths, type CharacterId } from '../src/assets/manifest';

type Pose = {
  angles?: Record<string, number>;
  offsets?: Record<string, number[]>;
  variants?: Record<string, string>;
  z?: Record<string, number>;
};
interface Rig {
  parts: {
    id: string;
    parent: string | null;
    pivot: number[];
    box?: number[];
    files: Record<string, string>;
  }[];
  poses: Record<string, Pose>;
  views?: Record<string, Pose>;
}

const CASES: { id: CharacterId; rig: Rig; required: string[]; poses: string[] }[] = [
  {
    id: 'bolt',
    rig: boltRig as unknown as Rig,
    required: [
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
    ],
    // ストーリーの身振り（character-design-prompt.md のポーズ集）
    poses: [
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
    ],
  },
  {
    id: 'chief',
    rig: chiefRig as unknown as Rig,
    required: ['base', 'mast', 'cab', 'hat', 'jib', 'hook'],
    // 指さす・首を振る・うなずく・差し出す・腕を組む（相当）・帽子を上げる
    poses: ['point', 'shake', 'nod', 'offer', 'fold', 'tip'],
  },
];

describe.each(CASES)('$id の部品と関節（rig.json）', ({ id, rig, required, poses }) => {
  const ids = new Set(rig.parts.map((p) => p.id));
  const paths = characterAssetPaths(id);

  it('必須の部品がそろい、親・回転の中心・書き出しの範囲が正しい形', () => {
    for (const part of required) expect(ids.has(part), part).toBe(true);
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
        expect(paths, `${part.id}: ${file}`).toContain(file);
      }
    }
  });

  it('ポーズは、ある部品とある差し替えだけを使う', () => {
    const all = { ...rig.poses, ...(rig.views ?? {}) };
    for (const [name, pose] of Object.entries(all)) {
      const used = [
        ...Object.keys(pose.angles ?? {}),
        ...Object.keys(pose.offsets ?? {}),
        ...Object.keys(pose.z ?? {}),
      ];
      for (const part of used)
        expect(part === 'root' || ids.has(part), `${name}: ${part}`).toBe(true);
      for (const [part, variant] of Object.entries(pose.variants ?? {})) {
        const def = rig.parts.find((p) => p.id === part);
        expect(def, `${name}: ${part}`).toBeDefined();
        expect(Object.keys(def!.files), `${name}: ${part} = ${variant}`).toContain(variant);
      }
    }
  });

  it('ストーリーに要る身振りがそろい、組み上げた絵もある', () => {
    expect(Object.keys(rig.poses)).toEqual(expect.arrayContaining(poses));
    expect(paths).toEqual(
      expect.arrayContaining(Object.keys(rig.poses).map((k) => `poses/${k}.svg`)),
    );
  });
});
