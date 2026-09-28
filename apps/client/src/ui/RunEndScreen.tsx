/**
 * ラン終了画面（最終スコア・最大連鎖数・もう一度）
 */
import {
  getBestChain,
  SCORE_ZERO,
  scoreAdd,
  scoreFromString,
  type MetaProgress,
  type RunState,
  type Unlock,
} from '@chain-factory/sim';
import { useI18n } from '../i18n';
import { MetaPanel } from './MetaPanel';

interface Props {
  run: RunState;
  meta: MetaProgress;
  /** このランで新しく解放されたもの */
  unlocks: Unlock[];
  onRetry: () => void;
  /** 延長戦へ進む（全シフトクリア後のみ） */
  onOvertime: () => void;
}

export function RunEndScreen({ run, meta, unlocks, onRetry, onOvertime }: Props) {
  const { t, formatScore } = useI18n();
  const canOvertime = run.phase === 'cleared' && !run.overtime;
  const total = run.history.reduce((sum, r) => scoreAdd(sum, scoreFromString(r.score)), SCORE_ZERO);
  const clearedCount = run.history.filter((r) => r.cleared).length;

  return (
    <div className="run-end">
      <h1>
        {run.overtime
          ? t('runEnd.overtimeTitle', { shift: run.history.length })
          : run.phase === 'cleared'
            ? t('runEnd.clearedTitle')
            : t('runEnd.failedTitle')}
      </h1>
      <dl className="stats stats--large">
        <dt>{t('runEnd.finalScore')}</dt>
        <dd className="stats__score">{formatScore(total)}</dd>
        <dt>{t('runEnd.bestChain')}</dt>
        <dd>{getBestChain(run)}</dd>
        <dt>{t('runEnd.shiftsCleared')}</dt>
        <dd>
          {clearedCount} / {run.history.length}
        </dd>
      </dl>
      <ul className="run-end__history">
        {run.history.map((r) => (
          <li key={r.shiftIndex} className={r.cleared ? 'is-met' : 'is-missed'}>
            {t('runEnd.shiftRow', {
              index: r.shiftIndex + 1,
              score: formatScore(r.score),
              quota: formatScore(String(r.quota)),
            })}
          </li>
        ))}
      </ul>
      <div className="button-row run-end__actions">
        {canOvertime && (
          <button className="button--primary" onClick={onOvertime}>
            {t('runEnd.overtime')}
          </button>
        )}
        <button className={canOvertime ? '' : 'button--primary'} onClick={onRetry}>
          {t('runEnd.retry')}
        </button>
      </div>
      {canOvertime && (
        <p className="panel__hint">
          {t('runEnd.overtimeHint', { growth: run.config.overtime.quotaGrowthPercent / 100 })}
        </p>
      )}
      <MetaPanel meta={meta} unlocks={unlocks} />
    </div>
  );
}
