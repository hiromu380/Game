/**
 * デイリーの結果のシェア文（X 向け）
 *
 * ネタバレになる情報（盤面の配置・買ったパーツ）は入れない。
 * 入れるのは デイリー番号・シフトごとの結果（絵文字）・最大連鎖数・上位○% だけ。
 * 文言は i18n（share.*）に置き、ここでは組み立てだけを行う。
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

/** シェアに載せるサイトの URL（ビルド時の設定。なければ今開いているオリジン） */
export function siteUrl(): string {
  return import.meta.env.VITE_SITE_URL ?? window.location.origin;
}

export interface ShareInput {
  number: number;
  history: readonly ShiftRecord[];
  shiftCount: number;
  maxChain: number;
  /** 上位○%（取得できなければ null。その場合は文に入れない） */
  topPercent: number | null;
  url: string;
}

export function buildShareText(t: TranslateFn, input: ShareInput): string {
  const params = {
    number: input.number,
    squares: resultSquares(input.history, input.shiftCount),
    chain: input.maxChain,
    url: input.url,
  };
  return input.topPercent === null
    ? t('share.text', params)
    : t('share.textWithRank', { ...params, percent: input.topPercent });
}

/** X の投稿画面の URL */
export function xIntentUrl(text: string): string {
  return `https://x.com/intent/post?text=${encodeURIComponent(text)}`;
}
