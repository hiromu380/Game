/**
 * 再生後の結果表示（試運転 / 本番）
 */
import {
  getShiftConfig,
  scoreCompare,
  scoreOf,
  scoreToString,
  type RunState,
} from '@chain-factory/sim';
import { useI18n } from '../i18n';
import type { Playback } from '../state/gameReducer';
import { formatScore } from './format';

interface Props {
  playback: Playback;
  run: RunState;
  onClose: () => void;
}

export function PlaybackPanel({ playback, run, onClose }: Props) {
  const { t } = useI18n();
  if (!playback.finished) {
    return <div className="playback-banner">{t('playback.playing')}</div>;
  }

  const { score, stats } = playback.result;
  const quota = getShiftConfig(run.shiftIndex).quota;
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
      </dl>
      {stats.haltedByTickLimit && <p className="panel__hint">{t('playback.halted')}</p>}
      <button className="button--primary" onClick={onClose}>
        {closeLabel}
      </button>
    </div>
  );
}
