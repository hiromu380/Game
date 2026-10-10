/**
 * 週替わりチャレンジのシェア
 *
 * - 挑戦の終了時（結果画面）: この挑戦のシフトごとの結果・出荷量と、暫定順位（取れなければ入れない）
 * - 結果発表: 確定した順位・ベスト・クリアしたシフト数・参加日数
 * 盤面はネタバレになるので、カードにも本文にも載せない。
 */
import { getBestChain, getTotalShipped, scoreToString, type RunState } from '@chain-factory/sim';
import { useEffect, useMemo, useState } from 'react';
import { shareUrl } from '../../config/share';
import { useI18n, type TranslateFn } from '../../i18n';
import { api } from '../../online/api';
import {
  buildResultsShareText,
  buildShareText,
  type WeeklyShareData,
} from '../../online/shareText';
import type { ShareCardInput, ShiftResult } from '../../share/card';
import { ShareCardPanel } from './ShareCardPanel';

/** 共有カードの中身（results はシフトごとの結果。結果発表では null） */
function weeklyCard(
  t: TranslateFn,
  data: WeeklyShareData,
  results: ShiftResult[] | null,
  shifts: string,
): ShareCardInput {
  const rank =
    data.rank === null
      ? null
      : t(data.provisional ? 'shareCard.rankProvisional' : 'shareCard.rank', {
          rank: data.rank,
          percent: data.topPercent ?? 100,
        });
  return {
    title: t(data.provisional ? 'shareCard.weeklyTitle' : 'shareCard.resultsTitle', {
      number: data.weekNumber,
    }),
    subtitle: t('shareCard.weekOf', { week: data.weekId }),
    scoreLabel: t(data.provisional ? 'shareCard.score' : 'shareCard.bestScore'),
    score: data.bestScore,
    shifts,
    rank,
    board: null,
    results,
    url: shareUrl(),
  };
}

interface AttemptProps {
  run: RunState;
  weekId: string;
  number: number;
}

/** 挑戦の終了時のシェア（暫定順位つき） */
export function WeeklyShare({ run, weekId, number }: AttemptProps) {
  const { t, formatScore } = useI18n();
  const [rank, setRank] = useState<{ rank: number; topPercent: number } | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .getProvisional(weekId)
      .then((r) => !cancelled && setRank(r.me ?? null))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [weekId]);

  const shiftCount = run.config.shifts.length;
  const cleared = run.history.filter((h) => h.cleared).length;
  const score = formatScore(scoreToString(getTotalShipped(run)));
  const text = buildShareText(t, {
    number,
    history: run.history,
    shiftCount,
    maxChain: getBestChain(run),
    score,
    rank,
  });
  const card = useMemo(
    () =>
      weeklyCard(
        t,
        {
          weekId,
          weekNumber: number,
          rank: rank?.rank ?? null,
          topPercent: rank?.topPercent ?? null,
          bestScore: score,
          shiftsCleared: cleared,
          daysPlayed: 0,
          provisional: true,
        },
        Array.from({ length: shiftCount }, (_, i): ShiftResult => {
          const h = run.history[i];
          return !h ? 'notPlayed' : h.cleared ? 'cleared' : 'failed';
        }),
        t('shareCard.cleared', { cleared, total: shiftCount }),
      ),
    [t, number, weekId, score, run.history, shiftCount, cleared, rank],
  );

  return (
    <ShareCardPanel
      card={card}
      text={text}
      url={shareUrl()}
      fileName={`chain-factory-weekly-${weekId}`}
    />
  );
}

/** 結果発表のシェア */
export function ResultsShare({ data }: { data: WeeklyShareData }) {
  const { t } = useI18n();
  const text = buildResultsShareText(t, data);
  const card = useMemo(
    () =>
      weeklyCard(
        t,
        data,
        null,
        t('shareCard.resultsDetail', { shifts: data.shiftsCleared, days: data.daysPlayed }),
      ),
    [t, data],
  );
  return (
    <ShareCardPanel
      card={card}
      text={text}
      url={shareUrl()}
      fileName={`chain-factory-results-${data.weekId}`}
    />
  );
}
