/**
 * ラン終了画面（最終スコア・最大連鎖数・もう一度）
 */
import {
  getBestChain,
  type AchievementProgress,
  SCORE_ZERO,
  scoreAdd,
  scoreFromString,
  type MetaProgress,
  type RunState,
  type Unlock,
} from '@chain-factory/sim';
import { useI18n } from '../i18n';
import type { PlayMode } from '../state/gameReducer';
import { EDITION_CONFIG } from '../config/edition';
import { AchievementList } from './AchievementList';
import { MetaPanel } from './MetaPanel';
import { DailyShare } from './share/DailyShare';
import { StoreLink } from './StoreLink';

interface Props {
  run: RunState;
  meta: MetaProgress;
  /** このランで新しく解放されたもの */
  unlocks: Unlock[];
  achievements: AchievementProgress;
  mode: PlayMode;
  onRetry: () => void;
  /** 延長戦へ進む（全シフトクリア後のみ） */
  onOvertime: () => void;
  /** デイリー・練習: ランキングを開く */
  onViewRanking: () => void;
  /** デイリー・練習: 通常モードに戻る */
  onBackToNormal: () => void;
}

export function RunEndScreen(props: Props) {
  const { run, meta, unlocks, mode, onRetry, onOvertime } = props;
  const { t, formatScore } = useI18n();
  const canOvertime = run.phase === 'cleared' && !run.overtime && run.config.overtimeAllowed;
  const total = run.history.reduce((sum, r) => scoreAdd(sum, scoreFromString(r.score)), SCORE_ZERO);
  const clearedCount = run.history.filter((r) => r.cleared).length;

  return (
    <div className="run-end">
      <h1>
        {mode.kind === 'daily'
          ? t('runEnd.dailyTitle', { number: mode.number })
          : mode.kind === 'practice'
            ? t('runEnd.practiceTitle', { number: mode.number })
            : run.overtime
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
      {mode.kind === 'normal' ? (
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
      ) : (
        <div className="button-row run-end__actions">
          <button className="button--primary" onClick={props.onViewRanking}>
            {t('runEnd.viewRanking')}
          </button>
          {mode.kind === 'practice' && (
            <button onClick={onRetry}>{t('runEnd.practiceAgain')}</button>
          )}
          <button onClick={props.onBackToNormal}>{t('mode.backToNormal')}</button>
        </div>
      )}
      {canOvertime && (
        <p className="panel__hint">
          {t('runEnd.overtimeHint', { growth: run.config.overtime.quotaGrowthPercent / 100 })}
        </p>
      )}
      {mode.kind === 'daily' && (
        <DailyShare run={run} dailyId={mode.dailyId} number={mode.number} />
      )}
      {mode.kind === 'normal' && EDITION_CONFIG.metaProgression && (
        <MetaPanel meta={meta} unlocks={unlocks} />
      )}
      {EDITION_CONFIG.achievements && <AchievementList progress={props.achievements} />}
      {mode.kind === 'normal' && <StoreLink />}
    </div>
  );
}
