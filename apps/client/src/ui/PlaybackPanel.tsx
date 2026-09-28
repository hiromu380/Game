/**
 * 再生後の結果表示（試運転 / 本番）
 */
import {
  getCurrentShift,
  scoreCompare,
  scoreOf,
  scoreToString,
  type RunState,
  type SimResult,
  type VanishReason,
} from '@chain-factory/sim';
import { useI18n } from '../i18n';
import type { Playback } from '../state/gameReducer';
import { summarizeBreaks } from '../playback/breaks';

interface Props {
  playback: Playback;
  run: RunState;
  onClose: () => void;
}

export function PlaybackPanel({ playback, run, onClose }: Props) {
  const { t, formatScore } = useI18n();
  if (!playback.finished) {
    return <div className="playback-banner">{t('playback.playing')}</div>;
  }

  const { score, stats } = playback.result;
  const quota = getCurrentShift(run).quota;
  const met = scoreCompare(score, scoreOf(quota)) >= 0;

  // 本番で次に進むときのボタン文言
  const closeLabel =
    playback.mode === 'trial'
      ? t('playback.close')
      : playback.nextRun.phase === 'building'
        ? t('playback.nextShift')
        : t('playback.toResult');

  return (
    <div className="playback-panel">
      <h2>{playback.mode === 'trial' ? t('playback.trialTitle') : t('playback.commitTitle')}</h2>
      <div className={`playback-panel__verdict ${met ? 'is-met' : 'is-missed'}`}>
        {met ? t('playback.quotaMet') : t('playback.quotaMissed')}
      </div>
      <dl className="stats">
        <dt>{t('playback.score')}</dt>
        <dd className="stats__score">{formatScore(score)}</dd>
        <dt>{t('playback.quota')}</dt>
        <dd>{formatScore(String(quota))}</dd>
        <dt>{t('playback.chain')}</dt>
        <dd>{stats.chainCount}</dd>
        <dt>{t('playback.maxValue')}</dt>
        <dd>{formatScore(scoreToString(stats.maxValue))}</dd>
        {playback.result.income > 0 && (
          <>
            <dt>{t('playback.income')}</dt>
            <dd>{t('playback.incomePop', { amount: playback.result.income })}</dd>
          </>
        )}
      </dl>
      <BreakList result={playback.result} run={run} />
      <button className="button--primary" onClick={onClose}>
        {closeLabel}
      </button>
    </div>
  );
}

/** 連鎖が途切れた理由の内訳（盤面にはマーカーで場所を表示している） */
function BreakList({ result, run }: { result: SimResult; run: RunState }) {
  const { t, formatScore } = useI18n();
  const summary = summarizeBreaks(result.events, run.board);
  const reasons = Object.keys(summary.counts) as VanishReason[];
  if (reasons.length === 0 && !summary.haltReason) return null;
  return (
    <div className="break-list">
      <div className="break-list__title">{t('break.title')}</div>
      <ul>
        {reasons.map((reason) => (
          <li key={reason}>
            <span className={`break-chip break-chip--${reason}`}>{t(`break.short.${reason}`)}</span>
            {t(`break.long.${reason}`)} ×{summary.counts[reason]}
          </li>
        ))}
        {summary.haltReason && (
          <li>{t(`break.halted.${summary.haltReason}`, { count: summary.haltedSignals })}</li>
        )}
      </ul>
    </div>
  );
}
