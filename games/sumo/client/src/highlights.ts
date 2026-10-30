/**
 * 場所の見せ場: 自分の部屋の優勝・昇進・三賞・部屋の新記録・元弟子の断髪式を、見せる順に並べる（純粋関数）
 */
import {
  KOJO_WORDS,
  type BashoReport,
  type Division,
  type GameState,
  type KojoWord,
} from '@ichimon/sim';
import { recordsBroken, type RecordNews } from './records';

export type Highlight =
  | { kind: 'promotion'; id: number; to: 'Y' | 'O' | 'makuuchi' | 'sekitori' }
  | { kind: 'yusho'; id: number; division: Division; wins: number; losses: number }
  | { kind: 'sansho'; id: number; prizes: ('shukun' | 'kanto' | 'gino')[] }
  /** 部屋の新記録（id は記録を塗り替えた今の弟子） */
  | { kind: 'record'; id: number; news: RecordNews }
  | {
      kind: 'danpatsu';
      alumnusId: number;
      venue: 'kokugikan' | 'hotel';
      hasami: number;
      patrons: string[];
      rival: string | null;
    };

const PROMO_ORDER = { Y: 0, O: 1, makuuchi: 3, sekitori: 4 } as const;
const DIVS: Division[] = ['makuuchi', 'juryo', 'makushita', 'sandanme', 'jonidan', 'jonokuchi'];

/** prev: 進める前の状態（あれば、部屋の新記録も見せる） */
export function highlightsOf(game: GameState, report: BashoReport, prev?: GameState): Highlight[] {
  const mine = (id: number) =>
    game.rikishi.find((r) => r.id === id)?.stableId === game.player.stableId;
  const out: { order: number; h: Highlight }[] = [];
  for (const p of report.promotions) {
    if (mine(p.id)) out.push({ order: PROMO_ORDER[p.to], h: { kind: 'promotion', ...p } });
  }
  DIVS.forEach((d, i) => {
    const id = report.yusho[d];
    if (id === undefined || !mine(id)) return;
    const rec = report.mine.find((m) => m.id === id)?.record;
    out.push({
      // 幕内優勝は大関昇進の次、ほかの段の優勝は新十両の後
      order: i === 0 ? 2 : 5 + i,
      h: { kind: 'yusho', id, division: d, wins: rec?.wins ?? 0, losses: rec?.losses ?? 0 },
    });
  });
  const prizes = new Map<number, ('shukun' | 'kanto' | 'gino')[]>();
  for (const k of ['shukun', 'kanto', 'gino'] as const) {
    for (const id of report.sansho[k]) {
      if (!mine(id)) continue;
      prizes.set(id, [...(prizes.get(id) ?? []), k]);
    }
  }
  for (const [id, p] of prizes) out.push({ order: 20, h: { kind: 'sansho', id, prizes: p } });
  if (prev) {
    for (const news of recordsBroken(prev, game)) {
      if (game.rikishi.some((r) => r.id === news.holder.id))
        out.push({ order: 25, h: { kind: 'record', id: news.holder.id, news } });
    }
  }
  // 元弟子の断髪式は最後に
  for (const d of report.danpatsu ?? []) out.push({ order: 30, h: { kind: 'danpatsu', ...d } });
  return out.sort((a, b) => a.order - b.order).map((x) => x.h);
}

/** 口上の四字熟語の候補（力士ごとに決まった3つ） */
export function kojoChoices(rikishiId: number): KojoWord[] {
  const n = KOJO_WORDS.length;
  const start = (rikishiId * 7) % n;
  return [0, 3, 5].map((k) => KOJO_WORDS[(start + k) % n]!);
}
