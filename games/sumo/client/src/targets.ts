/**
 * 弟子ごとの近い目標（この場所で何勝すれば、何に届くか）。番付編成の規則（sim/src/banzuke/make.ts）から見積もる純粋関数。
 * 番付編成は「前の位置 − 勝ち越しの数 × 段ごとの枚数」で並べ直すので、上の段の境目を越えるのに要る勝ち越しの数が分かる。
 * ほかの力士の成績でずれるので目安（三役・関取の枠は空きにもよる）
 */
import {
  BOUTS,
  MOVE_PER_NET,
  PROMOTION,
  isSekitori,
  ranksOf,
  type Division,
  type GameState,
  type Rank,
  type Rikishi,
} from '@ichimon/sim';
import type { MessageKey } from './i18n';

export type TargetTo = Division | 'sanyaku' | 'sekiwake' | 'ozeki' | 'yokozuna';

export type Target =
  /** この場所で wins 勝すれば to に届く */
  | { kind: 'up'; to: TargetTo; wins: number }
  /** 大関がカド番: wins 勝で大関に残る */
  | { kind: 'kadoban'; wins: number }
  /** 関取で、上の段まで遠い: まず勝ち越し */
  | { kind: 'kachikoshi'; wins: number }
  /** この場所では届かない: to まであと mai 枚 */
  | { kind: 'far'; to: TargetTo; mai: number }
  /** 横綱・大関: 優勝を目指す */
  | { kind: 'yusho' };

export interface TargetInfo {
  target: Target;
  /** 負け越すと落ちる段（関取だけ。落ちなければ null） */
  danger: Division | null;
}

/** 関取の目標にする勝ち星の上限（これより多く要るなら、まず勝ち越しを目標にする） */
export const SEKITORI_REACH = 12;

const UPPER: Partial<Record<Division, Division>> = {
  juryo: 'makuuchi',
  makushita: 'juryo',
  sandanme: 'makushita',
  jonidan: 'sandanme',
  jonokuchi: 'jonidan',
};
const LOWER: Partial<Record<Division, Division>> = {
  makuuchi: 'juryo',
  juryo: 'makushita',
};

/** 勝ち越しの数（勝ち − 負け）→ 要る勝ち星 */
function winsFor(bouts: number, net: number): number {
  return Math.ceil((bouts + net) / 2);
}

/** 番付の上からの位置で、境目 boundary（そこより上へ入れば届く）を越えるのに要る勝ち越しの数 */
function netToPass(index: number, boundary: number, move: number): number {
  return Math.max(1, Math.floor((index - boundary) / (move * 2)) + 1);
}

export function targetOf(
  game: Pick<GameState, 'banzuke' | 'titles'>,
  r: Pick<Rikishi, 'id' | 'recent'>,
  ranks: ReadonlyMap<number, Rank> = ranksOf(game.banzuke, game.titles),
): TargetInfo | null {
  const rank = ranks.get(r.id);
  const index = game.banzuke.indexOf(r.id);
  if (!rank || index < 0) return null;
  const sekitori = isSekitori(rank);
  const bouts = sekitori ? BOUTS.sekitori : BOUTS.lower;
  /** その条件に合う、番付のいちばん上の位置 */
  const firstWhere = (f: (k: Rank) => boolean) =>
    game.banzuke.findIndex((id) => {
      const k = ranks.get(id);
      return k !== undefined && f(k);
    });
  const last = r.recent[0];
  const prev = r.recent[1];
  const sanyaku = (k: Rank | undefined) => k?.title === 'S' || k?.title === 'K';

  // 負け越すと落ちる段（1つ負け越したときの位置が、下の段に入るか）
  let danger: Division | null = null;
  const down = LOWER[rank.division];
  if (down && rank.title !== 'Y' && rank.title !== 'O' && !sanyaku(rank)) {
    const lowerStart = firstWhere((k) => k.division === down);
    if (lowerStart >= 0 && index + MOVE_PER_NET[rank.division] * 2 >= lowerStart) danger = down;
  }

  let target: Target;
  if (rank.title === 'Y') {
    target = { kind: 'yusho' };
  } else if (rank.title === 'O') {
    const makekoshi = last && last.rank.title === 'O' && last.wins * 2 < bouts;
    if (makekoshi) target = { kind: 'kadoban', wins: winsFor(bouts, 1) };
    else if (last?.rank.title === 'O' && last.yusho)
      target = {
        kind: 'up',
        to: 'yokozuna',
        wins: Math.max(PROMOTION.yokozunaOtherMin, PROMOTION.yokozunaWins2 - last.wins),
      };
    else target = { kind: 'yusho' };
  } else if (rank.title === 'S') {
    // 大関: 三役で直近3場所の勝ち星の合計
    const need =
      last && prev && sanyaku(last.rank) && sanyaku(prev.rank)
        ? Math.max(PROMOTION.ozekiLastMin, PROMOTION.ozekiWins3 - last.wins - prev.wins)
        : Infinity;
    target =
      need <= bouts
        ? { kind: 'up', to: 'ozeki', wins: need }
        : { kind: 'up', to: 'sanyaku', wins: winsFor(bouts, 1) };
  } else if (rank.title === 'K') {
    // 小結で11勝以上は関脇へ
    target = { kind: 'up', to: 'sekiwake', wins: 11 };
  } else {
    // 上の段（前頭は三役）の境目を越える
    const up: TargetTo | undefined =
      rank.division === 'makuuchi' ? 'sanyaku' : UPPER[rank.division];
    const boundary =
      rank.division === 'makuuchi'
        ? firstWhere((k) => k.division === 'makuuchi' && (k.title ?? 'M') === 'M')
        : firstWhere((k) => k.division === rank.division);
    if (!up || boundary < 0) return { target: { kind: 'yusho' }, danger };
    const net = netToPass(index, boundary, MOVE_PER_NET[rank.division]);
    const wins = winsFor(bouts, net);
    target =
      wins > bouts
        ? sekitori
          ? { kind: 'kachikoshi', wins: winsFor(bouts, 1) }
          : { kind: 'far', to: up, mai: Math.ceil((index - boundary + 1) / 2) }
        : sekitori && wins > SEKITORI_REACH
          ? { kind: 'kachikoshi', wins: winsFor(bouts, 1) }
          : { kind: 'up', to: up, wins };
  }
  return { target, danger };
}

/** 目標の勝ち星（勝ち星で届く目標だけ） */
export function targetWins(t: Target): number | null {
  return t.kind === 'up' || t.kind === 'kadoban' || t.kind === 'kachikoshi' ? t.wins : null;
}

/** 目標に届いたか（今の勝ち星で） */
export function reached(t: Target, wins: number): boolean {
  const need = targetWins(t);
  return need !== null && wins >= need;
}

type T = (key: MessageKey, vars?: Record<string, string | number>) => string;

/** 目標の行き先の名前 */
export function targetName(t: T, to: TargetTo): string {
  return to === 'sanyaku' || to === 'sekiwake' || to === 'ozeki' || to === 'yokozuna'
    ? t(`target.to.${to}` as MessageKey)
    : t(`rank.division.${to}` as MessageKey);
}

/** 目標の1行（「5勝で三段目」など） */
export function targetText(t: T, x: Target): string {
  switch (x.kind) {
    case 'up':
      return t('target.up', { wins: x.wins, to: targetName(t, x.to) });
    case 'kadoban':
      return t('target.kadoban', { wins: x.wins });
    case 'kachikoshi':
      return t('target.kachikoshi', { wins: x.wins });
    case 'far':
      return t('target.far', { to: targetName(t, x.to), mai: x.mai });
    case 'yusho':
      return t('target.yusho');
  }
}

/** 届いたときの1行（「三段目へ！」など） */
export function reachedText(t: T, x: Target): string {
  return x.kind === 'up'
    ? t('target.reached', { to: targetName(t, x.to) })
    : x.kind === 'kadoban'
      ? t('target.reachedKadoban')
      : t('target.reachedKk');
}
