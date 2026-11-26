/**
 * 相撲の手帖: 部屋を営むうちに出会った言葉を集める（純粋関数。出会ったかは日誌・番付・場所の数から決め、セーブに持たない）
 * 文言は i18n の glossary.term.<id>.name / desc
 */
import { isSekitori, ranksOf, type GameState } from '@ichimon/sim';

export type GlossaryGroup = 'life' | 'nyumon' | 'banzuke' | 'gear' | 'basho' | 'kyokai';
export const GLOSSARY_GROUPS: readonly GlossaryGroup[] = [
  'life',
  'nyumon',
  'banzuke',
  'gear',
  'basho',
  'kyokai',
];

/** 出会ったかを決めるための、部屋の様子 */
interface Seen {
  game: GameState;
  /** 場所を1つ以上終えた */
  played: boolean;
  /** 弟子が入門したことがある */
  joined: boolean;
  /** 関取を出した（今いる・日誌にある） */
  sekitori: boolean;
  journal: (kind: string, test?: (e: Record<string, unknown>) => boolean) => boolean;
}

type Term = { id: string; group: GlossaryGroup; seen: (s: Seen) => boolean };

const always = () => true;

const happened = (ids: string[]) => (s: Seen) =>
  s.journal('happening', (e) => ids.includes(e.id as string));

export const TERMS: readonly Term[] = [
  { id: 'asageiko', group: 'life', seen: always },
  { id: 'chanko', group: 'life', seen: always },
  { id: 'chankoban', group: 'life', seen: always },
  { id: 'shiko', group: 'life', seen: always },
  { id: 'teppo', group: 'life', seen: always },
  { id: 'moshiai', group: 'life', seen: always },
  { id: 'butsukari', group: 'life', seen: (s) => s.played },
  { id: 'tsukebito', group: 'life', seen: (s) => s.sekitori },
  { id: 'okamisan', group: 'life', seen: always },
  { id: 'unten', group: 'life', seen: happened(['drivingLicense']) },
  { id: 'kensa', group: 'nyumon', seen: (s) => s.joined || s.played },
  { id: 'maezumo', group: 'nyumon', seen: (s) => s.joined },
  { id: 'shusse', group: 'nyumon', seen: (s) => s.joined },
  { id: 'kyoshujo', group: 'nyumon', seen: (s) => s.joined },
  { id: 'shikona', group: 'nyumon', seen: always },
  { id: 'banzuke', group: 'banzuke', seen: always },
  { id: 'sekitori', group: 'banzuke', seen: always },
  { id: 'oicho', group: 'banzuke', seen: (s) => s.sekitori },
  { id: 'kachikoshi', group: 'banzuke', seen: (s) => s.played },
  { id: 'hensei', group: 'banzuke', seen: (s) => s.played },
  { id: 'kadoban', group: 'banzuke', seen: (s) => s.journal('promote', (e) => e.to === 'O') },
  { id: 'tsuna', group: 'banzuke', seen: (s) => s.journal('promote', (e) => e.to === 'Y') },
  { id: 'mochikyukin', group: 'banzuke', seen: (s) => s.played },
  { id: 'mina', group: 'gear', seen: always },
  { id: 'kesho', group: 'gear', seen: (s) => s.sekitori || s.joined },
  { id: 'shimekomi', group: 'gear', seen: (s) => s.sekitori },
  { id: 'akeni', group: 'gear', seen: (s) => s.sekitori },
  { id: 'kurashi', group: 'life', seen: (s) => s.sekitori || s.journal('living') },
  { id: 'dohyomatsuri', group: 'basho', seen: (s) => s.played },
  { id: 'shitakubeya', group: 'basho', seen: (s) => s.played },
  { id: 'kamiokuri', group: 'basho', seen: (s) => s.joined && s.played },
  {
    id: 'soken',
    group: 'basho',
    seen: (s) => s.journal('promote', (e) => e.to === 'makuuchi') || s.game.bashoIndex >= 6,
  },
  { id: 'yumitori', group: 'basho', seen: (s) => s.played },
  { id: 'tsuyuharai', group: 'kyokai', seen: (s) => s.journal('promote', (e) => e.to === 'Y') },
  { id: 'tsunauchi', group: 'kyokai', seen: (s) => s.journal('promote', (e) => e.to === 'Y') },
  { id: 'uragata', group: 'kyokai', seen: always },
  { id: 'nakabi', group: 'basho', seen: (s) => s.played },
  { id: 'senshuraku', group: 'basho', seen: (s) => s.played },
  { id: 'kensho', group: 'basho', seen: (s) => s.sekitori },
  { id: 'yusho', group: 'basho', seen: (s) => s.played },
  { id: 'zensho', group: 'basho', seen: (s) => s.played },
  { id: 'nenkan', group: 'basho', seen: (s) => s.game.bashoIndex >= 6 },
  { id: 'sansho', group: 'basho', seen: (s) => s.journal('sansho') },
  {
    id: 'kinboshi',
    group: 'basho',
    seen: (s) =>
      s.game.rikishi.some((r) => r.stableId === s.game.player.stableId && r.career.kinboshi > 0),
  },
  { id: 'jungyo', group: 'basho', seen: (s) => s.game.bashoIndex >= 2 },
  { id: 'shokkiri', group: 'basho', seen: (s) => s.game.bashoIndex >= 2 },
  { id: 'toshiyori', group: 'kyokai', seen: always },
  { id: 'ichimon', group: 'kyokai', seen: always },
  {
    id: 'heyatsuki',
    group: 'kyokai',
    seen: (s) =>
      s.game.oyakata.some((o) => o.stableId === s.game.player.stableId && o.role === 'heyatsuki') ||
      s.journal('retire', (e) => typeof e.oyakata === 'string' && e.oyakata !== ''),
  },
  { id: 'rijisen', group: 'kyokai', seen: (s) => s.journal('election') },
  { id: 'dentatsu', group: 'kyokai', seen: (s) => s.journal('kojo') },
  { id: 'danpatsu', group: 'kyokai', seen: (s) => s.journal('danpatsu') },
  {
    id: 'tanimachi',
    group: 'kyokai',
    seen: (s) => s.game.player.koenkai.patrons.length > 0 || s.journal('patron'),
  },
  { id: 'boryoku', group: 'kyokai', seen: happened(['violenceRumor']) },
];

/** 出会った言葉の ID */
export function seenTerms(game: GameState): Set<string> {
  const ranks = ranksOf(game.banzuke, game.titles);
  const mine = game.rikishi.filter((r) => r.stableId === game.player.stableId);
  const journal = (kind: string, test?: (e: Record<string, unknown>) => boolean) =>
    game.journal.some(
      (e) => e.kind === kind && (!test || test(e as unknown as Record<string, unknown>)),
    );
  const s: Seen = {
    game,
    played: game.bashoIndex > 0,
    joined: journal('join'),
    sekitori:
      mine.some((r) => {
        const k = ranks.get(r.id);
        return k !== undefined && isSekitori(k);
      }) || journal('promote', (e) => e.to === 'sekitori'),
    journal,
  };
  return new Set(TERMS.filter((x) => x.seen(s)).map((x) => x.id));
}
