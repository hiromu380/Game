/**
 * 切り絵アニメの仕組み（キャラクターを部品に分け、関節の回転と差し替えでポーズを作る）
 *
 * - 部品は「親の部品」と「親から見た関節の位置（回転の中心）」を持つ。絵は関節を原点にした座標で描く
 * - ポーズは部品ごとの角度（度・時計回り）・位置のずれ・差し替え（手の形・顔）だけで表す（1枚絵は描かない）
 * - 書き出しは、部品ごとに先祖の変換をつないだ transform を付け、重なり順（z）で並べる
 */
import { group } from '../svg';

export interface RigPart {
  id: string;
  /** 親の部品（null は根元。根元の関節は原点） */
  parent: string | null;
  /** 親の座標で見た関節の位置 */
  pivot: [number, number];
  /** 重なり順（大きいほど手前） */
  z: number;
  /** 部品の絵（関節が原点）。variant はポーズで差し替える形（手の形・顔など） */
  draw: (variant: string | undefined) => string[];
}

export interface Pose {
  /** 部品ごとの角度（度・時計回り。省略は 0） */
  angles?: Partial<Record<string, number>>;
  /** 部品ごとの位置のずれ（関節を動かす。跳ねる・沈むなど） */
  offsets?: Partial<Record<string, [number, number]>>;
  /** 部品ごとの差し替え */
  variants?: Partial<Record<string, string>>;
}

/** 部品の関節を、先祖からつないだ transform にする */
function chain(parts: Map<string, RigPart>, id: string, pose: Pose): string {
  const part = parts.get(id)!;
  const [ox, oy] = pose.offsets?.[id] ?? [0, 0];
  const own = `translate(${part.pivot[0] + ox} ${part.pivot[1] + oy}) rotate(${pose.angles?.[id] ?? 0})`;
  return part.parent ? `${chain(parts, part.parent, pose)} ${own}` : own;
}

/** ポーズを当てた絵（SVG の要素の並び） */
export function renderPose(rig: readonly RigPart[], pose: Pose): string[] {
  const parts = new Map(rig.map((p) => [p.id, p]));
  return [...rig]
    .sort((a, b) => a.z - b.z)
    .map((p) => group({ transform: chain(parts, p.id, pose) }, ...p.draw(pose.variants?.[p.id])));
}
