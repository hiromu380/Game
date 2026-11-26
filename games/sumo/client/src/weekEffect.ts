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
  /** その週の結果（1つだけ。下の Verdict） */
  verdict: Verdict;
  /** 疲れが危ない（判定とは別に重ねて出す札） */
  tired: boolean;
}

/**
 * 1人の週の結果の判定。漏れなく重なりなく1つに決める（上から順に見る）:
 * 稽古の週: けが → 壁を破った → ランクが上がった → 伸びた（次のランクまであと◯）→ 伸びなかった（ピークの年齢を過ぎた／素質の上限／そのほか）→ 下がった。
 * 休ませる週: 疲れが抜けた／もともと疲れていない（けがは稽古の週と同じく先に見る）
 */
export type Verdict =
  | { kind: 'hurt' }
  | { kind: 'wall' }
  | { kind: 'gradeUp'; stat: Style; grade: Grade }
  | { kind: 'grew'; stat: Style; next: Grade | null; toNext: number }
  | { kind: 'aged' }
  | { kind: 'capped' }
  | { kind: 'flat' }
  | { kind: 'fell' }
  | { kind: 'rested'; by: number }
  | { kind: 'fresh' };

/** 疲れの札を出す境目（話しかけるカードのバーが赤くなるのと同じ） */
export const TIRED_AT = 70;

/** 能力の伸びが「伸びた」と言える最小（画面の目盛りで1） */
const MOVED = 0.05;

/** 次のランクの境目（S なら null） */
function nextFloor(v: number): { grade: Grade; floor: number } | null {
  const i = GRADE_FLOORS.findIndex(([, floor]) => v >= floor);
  if (i <= 0) return null;
  const [grade, floor] = GRADE_FLOORS[i - 1]!;
  return { grade, floor };
}

export function verdictOf(
  row: Pick<EffectRow, 'stats' | 'fatigue' | 'wall' | 'hurt'>,
  r: { age: number; peakAge: number; talent: number; abilities: Record<Style, number> },
  kind: PrepAction['kind'],
): Verdict {
  if (row.hurt) return { kind: 'hurt' };
  if (kind === 'rest') {
    const by = Math.round(row.fatigue.before - row.fatigue.after);
    return by > 0 ? { kind: 'rested', by } : { kind: 'fresh' };
  }
  if (row.wall) return { kind: 'wall' };
  const d = (m: StatMove) => m.after - m.before;
  const up = row.stats.find((m) => m.gradeAfter !== m.gradeBefore && d(m) > 0);
  if (up) return { kind: 'gradeUp', stat: up.key, grade: up.gradeAfter };
  const best = [...row.stats].sort((p, q) => d(q) - d(p))[0]!;
  if (d(best) >= MOVED) {
    const n = nextFloor(best.after);
    return {
      kind: 'grew',
      stat: best.key,
      next: n?.grade ?? null,
      toNext: n ? Math.max(0, n.floor - best.after) : 0,
    };
  }
  if (row.stats.some((m) => d(m) <= -MOVED)) return { kind: 'fell' };
  // 伸びなかったわけ（sim の extraTraining が伸ばさない条件と同じ）
  if (r.age > r.peakAge) return { kind: 'aged' };
  if (row.stats.some((m) => r.abilities[m.key] >= r.talent)) return { kind: 'capped' };
  return { kind: 'flat' };
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
    ].map((row) => ({
      ...row,
      verdict: verdictOf(row, r, w.action.kind),
      tired: !row.hurt && row.fatigue.after >= TIRED_AT,
    }));
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
export function gradeUp(row: Pick<EffectRow, 'stats'>): StatMove | null {
  return row.stats.find((m) => m.gradeAfter !== m.gradeBefore && m.after > m.before) ?? null;
}

/** そのランクの中での位置（0〜1）。バーを「次のランクまで」にして、1週の伸びが見えるようにする */
export function bandOf(v: number): { grade: Grade; pos: number } {
  const i = GRADE_FLOORS.findIndex(([, floor]) => v >= floor);
  const [grade, floor] = GRADE_FLOORS[i]!;
  const upper = i === 0 ? 100 : GRADE_FLOORS[i - 1]![1];
  return { grade, pos: Math.max(0, Math.min(1, (v - floor) / (upper - floor))) };
}

export interface PrepTotal {
  id: number;
  name: string;
  /** いちばん伸びた能力（伸びていなければ null） */
  best: StatMove | null;
  /** 3つの能力の伸びの合計 */
  gain: number;
  walls: number;
  hurt: boolean;
  /** 能力の判定（ランクが上がった・伸びた・伸びなかったわけ・下がった）。壁破りとけがは別の札 */
  verdict: Verdict;
}

/** 場所前の4週間の積み上げ（弟子ごと）。稽古を受けた弟子は全員（伸びなかった弟子もわけを出す）。伸びた順 */
export function prepTotals(game: Pick<GameState, 'rikishi' | 'prep'>): PrepTotal[] {
  const sum = new Map<number, Record<Style, number>>();
  const walls = new Map<number, number>();
  const hurt = new Set<number>();
  const trained = new Set<number>();
  for (const w of game.prep.log) {
    for (const g of w.gains) {
      if (w.action.kind !== 'rest') trained.add(g.id);
      const s = sum.get(g.id) ?? { oshi: 0, yotsu: 0, waza: 0 };
      for (const k of STYLES) s[k] += g[k];
      sum.set(g.id, s);
    }
    for (const x of w.walls ?? []) walls.set(x.id, (walls.get(x.id) ?? 0) + 1);
    for (const id of w.injured) hurt.add(id);
  }
  const out: PrepTotal[] = [];
  for (const [id, s] of sum) {
    const r = game.rikishi.find((x) => x.id === id);
    if (!r) continue;
    const moves = STYLES.map((key): StatMove => {
      const after = r.abilities[key];
      const before = after - s[key];
      return { key, before, after, gradeBefore: gradeOf(before), gradeAfter: gradeOf(after) };
    });
    const gain = STYLES.reduce((a, k) => a + s[k], 0);
    const top = [...moves].sort((p, q) => q.after - q.before - (p.after - p.before))[0]!;
    const best = top.after > top.before ? top : null;
    if (!trained.has(id) && !hurt.has(id)) continue;
    const verdict = verdictOf(
      { stats: moves, fatigue: { before: 0, after: 0 }, wall: false, hurt: false },
      r,
      'coach',
    );
    out.push({
      id,
      name: r.name,
      best,
      gain,
      walls: walls.get(id) ?? 0,
      hurt: hurt.has(id),
      verdict,
    });
  }
  return out.sort((p, q) => q.gain - p.gain || p.id - q.id);
}
