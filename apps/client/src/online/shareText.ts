/**
 * 結果のシェア文（X 向け）
 *
 * - 週替わり: ネタバレになる情報（盤面の配置・買ったパーツ）は入れない。
 *   挑戦の終了時は 週の番号・シフトごとの結果（絵文字）・出荷量・最大連鎖数・暫定順位（上位○%）だけ。
 *   結果発表は 週の番号・確定順位・ベスト・クリアしたシフト数・参加日数だけ
 * - 通常ラン: 結果（打ち上げ成功・どこまで到達したか）と出荷量
 * 文言は i18n（share.*。#ChainFactory を含む）に置き、ここでは組み立てだけを行う。
 * URL は本文に入れず、投稿画面の url パラメータで渡す（xIntentUrl）。
 */
import type { ShiftRecord } from '@chain-factory/sim';
import type { TranslateFn } from '../i18n';

export const SHARE_SQUARES = { cleared: '🟩', failed: '🟥', notPlayed: '⬜' } as const;

/** シフトごとの結果を絵文字の列にする（未到達のシフトは白） */
export function resultSquares(history: readonly ShiftRecord[], shiftCount: number): string {
  return Array.from({ length: shiftCount }, (_, i) => {
    const record = history[i];
    if (!record) return SHARE_SQUARES.notPlayed;
    return record.cleared ? SHARE_SQUARES.cleared : SHARE_SQUARES.failed;
  }).join('');
}

export interface ShareInput {
  number: number;
  history: readonly ShiftRecord[];
  shiftCount: number;
  maxChain: number;
  /** 出荷量（表記済みの文字列） */
  score: string;
  /** 暫定順位と上位○%（取得できなければ null。その場合は文に入れない） */
  rank: { rank: number; topPercent: number } | null;
}

/** 共有カード・シェア文に渡す週替わりの成績（結果発表・挑戦の終了時） */
export interface WeeklyShareData {
  weekId: string;
  weekNumber: number;
  /** 順位（取れなければ null） */
  rank: number | null;
  topPercent: number | null;
  /** 出荷量（表記済みの文字列） */
  bestScore: string;
  shiftsCleared: number;
  daysPlayed: number;
  /** 暫定（当週）か、確定した結果発表か */
  provisional: boolean;
}

/** 結果発表のシェア文 */
export function buildResultsShareText(t: TranslateFn, data: WeeklyShareData): string {
  const params = {
    number: data.weekNumber,
    score: data.bestScore,
    shifts: data.shiftsCleared,
    days: data.daysPlayed,
  };
  return data.rank === null
    ? t('share.resultsText', params)
    : t('share.resultsTextWithRank', {
        ...params,
        rank: data.rank,
        percent: data.topPercent ?? 100,
      });
}

export function buildShareText(t: TranslateFn, input: ShareInput): string {
  const params = {
    number: input.number,
    squares: resultSquares(input.history, input.shiftCount),
    chain: input.maxChain,
    score: input.score,
  };
  return input.rank === null
    ? t('share.text', params)
    : t('share.textWithRank', {
        ...params,
        rank: input.rank.rank,
        percent: input.rank.topPercent,
      });
}

/** 通常ランのシェア文 */
export function buildRunShareText(
  t: TranslateFn,
  input: { result: string; score: string; shift: number },
): string {
  return t('share.runText', input);
}

/** X の投稿画面の URL（本文と、別枠で付ける URL） */
export function xIntentUrl(text: string, url?: string): string {
  const base = `https://x.com/intent/post?text=${encodeURIComponent(text)}`;
  return url ? `${base}&url=${encodeURIComponent(url)}` : base;
}
