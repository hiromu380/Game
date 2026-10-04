/**
 * 切り絵アニメの計算（純粋関数）: ポーズ名 → ポーズ、2つのポーズの間、部品ごとの変換行列
 *
 * 部品・関節・ポーズのデータは設定画（art/characters）が書き出した rig.json。
 * 変換は「親の変換 × 関節の位置（＋ずれ）へ移動 × 回転」を根元からつなぐ（art/characters/rig.ts の SVG と同じ）。
 */
import boltRig from '../assets/characters/bolt/rig.json';
import chiefRig from '../assets/characters/chief/rig.json';
import type { CharacterId } from './timeline';

export interface Pose {
  angles?: Partial<Record<string, number>>;
  offsets?: Partial<Record<string, number[]>>;
  variants?: Partial<Record<string, string>>;
  z?: Partial<Record<string, number>>;
}

interface RigPart {
  id: string;
  parent: string | null;
  pivot: number[];
  z: number;
  box: number[];
  files: Record<string, string>;
}

interface RigData {
  parts: RigPart[];
  poses: Record<string, Pose>;
  views?: Record<string, Pose>;
}

export const RIGS: Record<CharacterId, RigData> = {
  bolt: boltRig as unknown as RigData,
  chief: chiefRig as unknown as RigData,
};

/** 表情を差し替える部品（ボルトは頭、工場長は運転席） */
const FACE_PART: Record<CharacterId, string> = { bolt: 'head', chief: 'cab' };

/** ポーズ名（と表情）から、ポーズを求める。知らない名前は空のポーズ（立ち） */
export function resolvePose(character: CharacterId, name: string, face?: string): Pose {
  const rig = RIGS[character];
  const pose = rig.poses[name] ?? rig.views?.[name] ?? {};
  if (!face) return pose;
  return { ...pose, variants: { ...pose.variants, [FACE_PART[character]]: face } };
}

/** 2つのポーズの間（角度・ずれは補間、差し替え・重なり順は前のポーズ） */
export function blendPose(a: Pose, b: Pose, k: number): Pose {
  const lerpMap = (x: Pose['angles'] = {}, y: Pose['angles'] = {}) => {
    const out: Record<string, number> = {};
    for (const key of new Set([...Object.keys(x), ...Object.keys(y)])) {
      out[key] = (x[key] ?? 0) + ((y[key] ?? 0) - (x[key] ?? 0)) * k;
    }
    return out;
  };
  const offsets: Record<string, number[]> = {};
  for (const key of new Set([...Object.keys(a.offsets ?? {}), ...Object.keys(b.offsets ?? {})])) {
    const [ax = 0, ay = 0] = a.offsets?.[key] ?? [];
    const [bx = 0, by = 0] = b.offsets?.[key] ?? [];
    offsets[key] = [ax + (bx - ax) * k, ay + (by - ay) * k];
  }
  return { angles: lerpMap(a.angles, b.angles), offsets, variants: a.variants, z: a.z };
}

/** 2×3 の変換行列 [a, b, c, d, tx, ty]（x' = a·x + c·y + tx、y' = b·x + d·y + ty） */
export type Matrix = [number, number, number, number, number, number];

const multiply = (m: Matrix, n: Matrix): Matrix => [
  m[0] * n[0] + m[2] * n[1],
  m[1] * n[0] + m[3] * n[1],
  m[0] * n[2] + m[2] * n[3],
  m[1] * n[2] + m[3] * n[3],
  m[0] * n[4] + m[2] * n[5] + m[4],
  m[1] * n[4] + m[3] * n[5] + m[5],
];

const local = (x: number, y: number, deg: number): Matrix => {
  const r = (deg * Math.PI) / 180;
  return [Math.cos(r), Math.sin(r), -Math.sin(r), Math.cos(r), x, y];
};

export interface PartPlacement {
  id: string;
  /** 部品の絵（rig.json の files の値） */
  file: string;
  /** 部品の絵の範囲（関節が原点）[x, y, 幅, 高さ] */
  box: number[];
  matrix: Matrix;
  z: number;
}

/**
 * ポーズを当てた部品の並び（重なり順。根元が原点の座標）。
 * 差し替えの指定がない部品は、その部品の最初の絵を使う。絵のない差し替え（効果の線なし）は出さない
 */
export function placeParts(character: CharacterId, pose: Pose): PartPlacement[] {
  const rig = RIGS[character];
  const byId = new Map(rig.parts.map((p) => [p.id, p]));
  const cache = new Map<string, Matrix>();
  const rootOffset = pose.offsets?.root ?? [0, 0];
  const root = local(rootOffset[0] ?? 0, rootOffset[1] ?? 0, pose.angles?.root ?? 0);
  const world = (id: string): Matrix => {
    const hit = cache.get(id);
    if (hit) return hit;
    const part = byId.get(id)!;
    const [ox = 0, oy = 0] = pose.offsets?.[id] ?? [];
    const own = local((part.pivot[0] ?? 0) + ox, (part.pivot[1] ?? 0) + oy, pose.angles?.[id] ?? 0);
    const parent = part.parent && part.parent !== 'root' ? world(part.parent) : root;
    const m = multiply(parent, own);
    cache.set(id, m);
    return m;
  };
  const placed: PartPlacement[] = [];
  for (const part of rig.parts) {
    const variant = pose.variants?.[part.id];
    const file = variant ? part.files[variant] : Object.values(part.files)[0];
    // 小物・効果の線は、ポーズで指定したときだけ出す
    if (!file || (!variant && (part.id === 'prop' || part.id === 'fx'))) continue;
    placed.push({
      id: part.id,
      file,
      box: part.box,
      matrix: world(part.id),
      z: pose.z?.[part.id] ?? part.z,
    });
  }
  return placed.sort((a, b) => a.z - b.z);
}

/** 立った高さ（rig の単位）: 高さの指定（px）を拡大率にするため */
export const RIG_HEIGHT: Record<CharacterId, number> = { bolt: 150, chief: 190 };
/** 足もと（地面）の y（rig の単位。根元からの距離） */
export const RIG_GROUND: Record<CharacterId, number> = { bolt: 28, chief: 0 };
