/**
 * 報酬と罰: 場所の前と後の状態を比べて、成績が部屋の経営に返ってきたものを、原因つきで並べる（純粋関数）
 * - 報酬: 名声・タニマチの関係（ひいきの勝ち越し・昇進）・新しいタニマチ・関取の誕生（養成奨励金）・見込みより多い収入
 * - 罰: 名声の低下・タニマチの冷え（ひいきの負け越し）・離れたタニマチ・関取からの陥落・けが・見込みより少ない収入
 */
import {
  isSekitori,
  projectLedger,
  sekitoriGain,
  sumMoney,
  type GameState,
  type Patron,
} from '@ichimon/sim';

export type RewardLine =
  | { tone: 'good' | 'bad'; kind: 'prestige'; delta: number }
  | {
      tone: 'good' | 'bad';
      kind: 'patrons';
      /** 関係が動いたタニマチの人数と、1人あたりの動き */
      count: number;
      delta: number;
      /** 関係が動いたわけ（ひいきの力士の成績。なければ、放っておいて冷えた） */
      cause: { name: string; result: 'kachikoshi' | 'makekoshi' | 'promoted' } | null;
    }
  | {
      tone: 'good' | 'bad';
      kind: 'patronJoin' | 'patronLeave';
      patron: Pick<Patron, 'surname' | 'kind'>;
    }
  | { tone: 'good' | 'bad'; kind: 'sekitoriUp' | 'sekitoriDown'; name: string; perBasho: number }
  | { tone: 'bad'; kind: 'injury'; name: string; basho: number }
  | { tone: 'good' | 'bad'; kind: 'vsOutlook'; delta: number };

/** 関係の動きを知らせる下限 */
export const FAVOR_NEWS_MIN = 3;
/** 見込みとの差を知らせる下限（円） */
export const OUTLOOK_NEWS_MIN = 100_000;

export function rewardsOf(prev: GameState, next: GameState): RewardLine[] {
  const report = next.lastReport;
  if (!report) return [];
  const out: RewardLine[] = [];
  const name = (id: number) =>
    next.rikishi.find((r) => r.id === id)?.name ??
    prev.rikishi.find((r) => r.id === id)?.name ??
    '?';
  const result = new Map(
    report.mine.map((m) => [
      m.id,
      m.record.wins * 2 > m.record.wins + m.record.losses + m.record.absences,
    ]),
  );
  const promoted = new Set(report.promotions.map((p) => p.id));

  // 名声
  const prestige = Math.round((next.player.prestige - prev.player.prestige) * 10) / 10;
  if (prestige !== 0)
    out.push({ tone: prestige > 0 ? 'good' : 'bad', kind: 'prestige', delta: prestige });

  // 関取の誕生・陥落（部屋の口座の動きが変わる）
  for (const c of report.banzukeChanges) {
    if (!c.to) continue;
    const was = isSekitori(c.from);
    const now = isSekitori(c.to);
    if (!was && now)
      out.push({
        tone: 'good',
        kind: 'sekitoriUp',
        name: name(c.id),
        perBasho: sekitoriGain(prev, c.id),
      });
    if (was && !now)
      out.push({
        tone: 'bad',
        kind: 'sekitoriDown',
        name: name(c.id),
        perBasho: -sekitoriGain(next, c.id),
      });
  }

  // タニマチ: 関係の動きと、そのわけ
  const before = new Map(prev.player.koenkai.patrons.map((p) => [p.id, p]));
  const after = new Map(next.player.koenkai.patrons.map((p) => [p.id, p]));
  // 同じわけで動いたタニマチは1行にまとめる
  const groups = new Map<string, Extract<RewardLine, { kind: 'patrons' }> & { total: number }>();
  for (const p of next.player.koenkai.patrons) {
    const old = before.get(p.id);
    if (!old) {
      out.push({ tone: 'good', kind: 'patronJoin', patron: p });
      continue;
    }
    const delta = Math.round(p.favor - old.favor);
    if (Math.abs(delta) < FAVOR_NEWS_MIN) continue;
    const fav = old.favoriteId;
    const cause =
      fav !== null && result.has(fav)
        ? {
            name: name(fav),
            result: promoted.has(fav)
              ? ('promoted' as const)
              : result.get(fav)
                ? ('kachikoshi' as const)
                : ('makekoshi' as const),
          }
        : null;
    const tone = delta > 0 ? 'good' : 'bad';
    const key = `${tone}:${cause ? `${cause.name}:${cause.result}` : '-'}`;
    const g = groups.get(key) ?? { tone, kind: 'patrons', count: 0, delta: 0, total: 0, cause };
    g.count++;
    g.total += delta;
    g.delta = Math.round(g.total / g.count);
    groups.set(key, g);
  }
  for (const { total: _total, ...g } of groups.values()) {
    void _total;
    out.push(g);
  }
  for (const p of prev.player.koenkai.patrons) {
    if (!after.has(p.id)) out.push({ tone: 'bad', kind: 'patronLeave', patron: p });
  }

  // けが
  const mine = new Set(
    prev.rikishi.filter((r) => r.stableId === prev.player.stableId).map((r) => r.id),
  );
  // この場所の後に新しくけがをした弟子（休場が続くだけの弟子は出さない）
  for (const r of next.rikishi) {
    if (!mine.has(r.id) || r.injury === 0) continue;
    const old = prev.rikishi.find((x) => x.id === r.id);
    if (old && old.injury > 0) continue;
    out.push({ tone: 'bad', kind: 'injury', name: r.name, basho: r.injury });
  }

  // 見込みとの差（成績で動いたお金）
  const outlook = projectLedger(prev).stableNet;
  const actual = sumMoney(report.income) - sumMoney(report.expenses);
  const diff = actual - outlook;
  if (Math.abs(diff) >= OUTLOOK_NEWS_MIN)
    out.push({ tone: diff > 0 ? 'good' : 'bad', kind: 'vsOutlook', delta: diff });

  // 報酬を先に、罰を後に
  return [...out.filter((x) => x.tone === 'good'), ...out.filter((x) => x.tone === 'bad')];
}
