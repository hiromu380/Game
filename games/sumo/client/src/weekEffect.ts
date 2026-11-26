/**
 * 週の稽古の効果（純粋関数）: 週の結果（伸び・疲れ・けが・壁）と今の能力から、稽古の前と後を作る。
 * 稽古の結果カードで、能力のバーが伸び、ランクが上がるのを見せるのに使う
 */
import type { GameState, PrepAction, Style, WeekResult } from '@ichimon/sim';
import { GRADE_FLOORS, gradeOf, type Grade } from './grade';

export interface StatMove {
  key: Style;
  before: number;
  after: number;
  gradeBefore: Grade;
  gradeAfter: Grade;
}

export interface EffectRow {
  id: number;
  name: string;
  /** 押し・四つ・技（いつも3つ。動いていないものも出す） */
  stats: StatMove[];
  fatigue: { before: number; after: number };
  weight: number;
  wall: boolean;
  hurt: boolean;
}

/** 結果カードを出す行動（稽古と休ませる）。挨拶回り・スカウト・いつも通りは出さない */
export const CUT_KINDS: ReadonlySet<PrepAction['kind']> = new Set([
  'coach',
  'spar',
  'mune',
  'degeiko',
  'rest',
]);

/** 出稽古・休ませるのように大勢が動く週に、カードに並べる人数の上限（よく伸びた順） */
export const CUT_ROWS = 4;

const STYLES: Style[] = ['oshi', 'yotsu', 'waza'];

export function weekEffect(game: Pick<GameState, 'rikishi'>, w: WeekResult): EffectRow[] {
  const rows = w.gains.flatMap((g): EffectRow[] => {
    const r = game.rikishi.find((x) => x.id === g.id);
    if (!r) return [];
    return [
      {
        id: r.id,
        name: r.name,
        stats: STYLES.map((key) => {
          const after = r.abilities[key];
          const before = after - g[key];
          return { key, before, after, gradeBefore: gradeOf(before), gradeAfter: gradeOf(after) };
        }),
        fatigue: { before: Math.max(0, r.fatigue - g.fatigue), after: r.fatigue },
        weight: g.weight,
        wall: (w.walls ?? []).some((x) => x.id === r.id),
        hurt: w.injured.includes(r.id),
      },
    ];
  });
  // 選んだ相手のいる稽古は、選んだ順（申し合いは東西の順）。大勢のときはよく伸びた順に上から
  const a = w.action;
  const order =
    a.kind === 'spar' ? [a.a, a.b] : a.kind === 'coach' || a.kind === 'mune' ? [a.id] : null;
  if (order) return order.flatMap((id) => rows.filter((x) => x.id === id));
  const gain = (x: EffectRow) => x.stats.reduce((s, m) => s + (m.after - m.before), 0);
  const fresh = (x: EffectRow) => x.fatigue.before - x.fatigue.after;
  return [...rows]
    .sort(
      (p, q) =>
        Number(q.wall || q.hurt) - Number(p.wall || p.hurt) ||
        (a.kind === 'rest' ? fresh(q) - fresh(p) : gain(q) - gain(p)) ||
        p.id - q.id,
    )
    .slice(0, CUT_ROWS);
}

/** ランクが上がった能力（なければ null）。いちばん上がったものを1つ */
export function gradeUp(row: EffectRow): StatMove | null {
  return row.stats.find((m) => m.gradeAfter !== m.gradeBefore && m.after > m.before) ?? null;
}

/** そのランクの中での位置（0〜1）。バーを「次のランクまで」にして、1週の伸びが見えるようにする */
export function bandOf(v: number): { grade: Grade; pos: number } {
  const i = GRADE_FLOORS.findIndex(([, floor]) => v >= floor);
  const [grade, floor] = GRADE_FLOORS[i]!;
  const upper = i === 0 ? 100 : GRADE_FLOORS[i - 1]![1];
  return { grade, pos: Math.max(0, Math.min(1, (v - floor) / (upper - floor))) };
}
