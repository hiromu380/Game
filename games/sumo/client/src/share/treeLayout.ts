/**
 * 系譜図の並べ方（純粋関数）: 師匠を左、弟子の親方を右へ。葉の親方を上から順に並べ、師匠は弟子たちの真ん中に置く
 */
export interface TreeInput {
  id: number;
  parentId: number | null;
}

export interface Placed {
  id: number;
  /** 深さ（0 が初代） */
  depth: number;
  /** 行（0 始まり。師匠は弟子たちの行の真ん中なので小数になることがある） */
  row: number;
}

export function layoutTree(nodes: readonly TreeInput[]): {
  placed: Placed[];
  rows: number;
  depth: number;
} {
  const ids = new Set(nodes.map((n) => n.id));
  const children = new Map<number | null, number[]>();
  for (const n of nodes) {
    const key = n.parentId !== null && ids.has(n.parentId) ? n.parentId : null;
    children.set(key, [...(children.get(key) ?? []), n.id]);
  }
  const placed: Placed[] = [];
  let nextRow = 0;
  let maxDepth = 0;
  const visit = (id: number, depth: number): number => {
    maxDepth = Math.max(maxDepth, depth);
    const kids = children.get(id) ?? [];
    let row: number;
    if (kids.length === 0) {
      row = nextRow++;
    } else {
      const rows = kids.map((k) => visit(k, depth + 1));
      row = (rows[0]! + rows[rows.length - 1]!) / 2;
    }
    placed.push({ id, depth, row });
    return row;
  };
  for (const root of children.get(null) ?? []) visit(root, 0);
  return { placed, rows: nextRow, depth: maxDepth };
}
