/**
 * 通常ランの結果のシェア（結果画面・撮影モード）: 盤面の縮小図つきのカードと、投稿の本文
 */
import { getTotalShipped, scoreToString, type RunState } from '@chain-factory/sim';
import { useMemo } from 'react';
import { shareUrl } from '../../config/share';
import { useI18n, type ScoreFormatter, type TranslateFn } from '../../i18n';
import { buildRunShareText } from '../../online/shareText';
import type { ShareCardInput } from '../../share/card';
import { getRocketProgress, ROCKET_PARTS } from '../../state/rocket';
import { destinationName } from '../RocketProgress';
import { ShareCardPanel } from './ShareCardPanel';

/** 結果のひとこと（打ち上げ成功・○○に到達・ロケット未完成） */
function resultText(t: TranslateFn, run: RunState): string {
  const rocket = getRocketProgress(run);
  const reached = destinationName(t, rocket.destinations);
  if (reached) return t('shareCard.reached', { name: reached });
  if (rocket.launched) return t('runEnd.clearedTitle');
  return t('shareCard.unfinished', { parts: rocket.parts, total: ROCKET_PARTS });
}

/** 通常ランのカードと本文 */
export function buildRunShare(t: TranslateFn, formatScore: ScoreFormatter, run: RunState) {
  const score = formatScore(scoreToString(getTotalShipped(run)));
  const result = resultText(t, run);
  const card: ShareCardInput = {
    title: result,
    subtitle: null,
    scoreLabel: t('shareCard.score'),
    score,
    shifts: t('shareCard.shift', { shift: run.history.length }),
    rank: null,
    board: run.board,
    results: null,
    url: shareUrl(),
  };
  const text = buildRunShareText(t, { result, score, shift: run.history.length });
  return { card, text };
}

export function RunShare({ run }: { run: RunState }) {
  const { t, formatScore } = useI18n();
  const { card, text } = useMemo(() => buildRunShare(t, formatScore, run), [t, formatScore, run]);
  return (
    <ShareCardPanel card={card} text={text} url={shareUrl()} fileName="chain-factory-result" />
  );
}
