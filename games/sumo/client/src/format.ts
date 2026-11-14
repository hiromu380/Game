/**
 * 表示の整形（地位・お金・場所の名前・成績）。文言は i18n から
 */
import type { BashoRecord, Rank } from '@ichimon/sim';
import type { MessageKey, TranslateFn } from './i18n';

export function rankLabel(t: TranslateFn, rank: Rank | null): string {
  if (!rank) return t('rank.maezumo');
  return t('rank.withSide', {
    side: t(`rank.side.${rank.side}` as MessageKey),
    rank: rankName(t, rank),
  });
}

/** 東西を付けない地位（例: 前頭3枚目・大関） */
export function rankName(t: TranslateFn, rank: Rank): string {
  if (rank.title && rank.title !== 'M') {
    const name = t(`rank.title.${rank.title}` as MessageKey);
    return rank.number === 1 ? name : t('rank.extra', { name, number: rank.number });
  }
  const name =
    rank.title === 'M' ? t('rank.title.M') : t(`rank.division.${rank.division}` as MessageKey);
  return t('rank.numbered', { name, number: rank.number });
}

/** 円 → 日本語は「1,234万円」（1万円未満は円）、英語は「¥12.3M」「¥450k」 */
export function money(t: TranslateFn, input: number, lang: 'ja' | 'en'): string {
  const yen = input || 0; // -0 を 0 に
  if (lang === 'en') {
    const abs = Math.abs(yen);
    const value =
      abs >= 1_000_000
        ? `${(yen / 1_000_000).toFixed(1)}M`
        : abs >= 1_000
          ? `${Math.round(yen / 1_000)}k`
          : `${Math.round(yen)}`;
    return t('money.yen', { value });
  }
  if (Math.abs(yen) < 10_000)
    return t('money.yen', { value: Math.round(yen).toLocaleString('ja-JP') });
  return t('money.man', { value: Math.round(yen / 10_000).toLocaleString('ja-JP') });
}

/** 初日・○日目・千秋楽 */
export function dayLabel(t: TranslateFn, day: number): string {
  if (day === 1) return t('day.first');
  if (day === 15) return t('day.last');
  return t('day.n', { n: day });
}

export function bashoName(t: TranslateFn, bashoIndex: number): string {
  return t('basho.label', {
    year: Math.floor(bashoIndex / 6) + 1,
    name: t(`basho.${bashoIndex % 6}` as MessageKey),
  });
}

export function recordLabel(
  t: TranslateFn,
  r: Pick<BashoRecord, 'wins' | 'losses' | 'absences'>,
): string {
  return r.absences > 0
    ? t('record.withAbsences', { wins: r.wins, losses: r.losses, absences: r.absences })
    : t('record.plain', { wins: r.wins, losses: r.losses });
}
