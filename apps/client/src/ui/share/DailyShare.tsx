/**
 * デイリーの結果のシェア（結果画面に出す）
 *
 * 順位・上位○% はランキングから取る（取れなければ入れずにシェアできる）。
 * 盤面はネタバレになるので、カードにも本文にも載せない（シフトごとの結果だけ）。
 */
import { getBestChain, getTotalShipped, scoreToString, type RunState } from '@chain-factory/sim';
import { useEffect, useMemo, useState } from 'react';
import { shareUrl } from '../../config/share';
import { useI18n } from '../../i18n';
import { api } from '../../online/api';
import { buildShareText } from '../../online/shareText';
import type { ShareCardInput, ShiftResult } from '../../share/card';
import { ShareCardPanel } from './ShareCardPanel';

interface Props {
  run: RunState;
  dailyId: string;
  number: number;
}

export function DailyShare({ run, dailyId, number }: Props) {
  const { t, formatScore } = useI18n();
  const [rank, setRank] = useState<{ rank: number; topPercent: number } | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .getRanking(dailyId)
      .then((r) => !cancelled && setRank(r.me ?? null))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [dailyId]);

  const shiftCount = run.config.shifts.length;
  const score = formatScore(scoreToString(getTotalShipped(run)));
  const text = buildShareText(t, {
    number,
    history: run.history,
    shiftCount,
    maxChain: getBestChain(run),
    score,
    rank,
  });
  const card = useMemo<ShareCardInput>(
    () => ({
      title: t('shareCard.dailyTitle', { number }),
      subtitle: dailyId,
      scoreLabel: t('shareCard.score'),
      score,
      shifts: t('shareCard.cleared', {
        cleared: run.history.filter((h) => h.cleared).length,
        total: shiftCount,
      }),
      rank: rank ? t('shareCard.rank', { rank: rank.rank, percent: rank.topPercent }) : null,
      board: null,
      results: Array.from({ length: shiftCount }, (_, i): ShiftResult => {
        const h = run.history[i];
        return !h ? 'notPlayed' : h.cleared ? 'cleared' : 'failed';
      }),
      url: shareUrl(),
    }),
    [t, number, dailyId, score, run.history, shiftCount, rank],
  );

  return (
    <ShareCardPanel
      card={card}
      text={text}
      url={shareUrl()}
      fileName={`chain-factory-daily-${dailyId}`}
    />
  );
}
