/**
 * ラン終了画面（ロケットの発射 or 未完成・最終スコア・最大連鎖数・もう一度）
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
import { boardSizeAt, describeCondition, MetaPanel, nearestGoal } from './MetaPanel';
import { PartIcon } from './PartIcon';
import { RocketScene } from './RocketScene';
import { DailyShare } from './share/DailyShare';
import { RunShare } from './share/RunShare';
import { StoreLink } from './StoreLink';
import { UiIcon } from './UiIcon';

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
  // 落ちたシフトで、ノルマまであといくつだったか（惜しかったことを伝え、もう一度に向かわせる）
  const missed = run.phase === 'failed' ? run.history.at(-1) : undefined;
  const shortBy =
    missed && !missed.cleared ? (BigInt(missed.quota) - BigInt(missed.score)).toString() : null;
  // 次の目標は「もう一度」の手前に1つだけ吊るす（一覧は下にある）
  const goal = mode.kind === 'normal' && EDITION_CONFIG.metaProgression ? nearestGoal(meta) : null;

  return (
    <div className="run-end">
      <RocketScene run={run} />
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
      {shortBy && (
        <p className="run-end__short">{t('runEnd.shortBy', { amount: formatScore(shortBy) })}</p>
      )}
      {goal && (
        <div className="run-end__goal">
          {goal.kind === 'part' ? (
            <PartIcon partId={goal.partId} size={36} />
          ) : (
            <UiIcon name="expand" size={36} />
          )}
          <div className="run-end__goal-text">
            <span className="run-end__goal-label">{t('runEnd.nextGoal')}</span>
            <strong>
              {goal.kind === 'part'
                ? t(`part.${goal.partId}.name`)
                : t('meta.boardGoal', { size: boardSizeAt(goal.level) })}
            </strong>
            <span>{describeCondition(t, formatScore, goal.condition)}</span>
            <span className="meta__bar">
              <span
                className="meta__bar-fill"
                style={{ width: `${Math.round(goal.progress * 100)}%` }}
              />
            </span>
          </div>
        </div>
      )}
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
            <UiIcon name="ranking" />
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
      {(mode.kind === 'daily' || mode.kind === 'normal') && (
        <section className="run-end__share">
          <h2>{t('shareCard.title')}</h2>
          {mode.kind === 'daily' ? (
            <DailyShare run={run} dailyId={mode.dailyId} number={mode.number} />
          ) : (
            <RunShare run={run} />
          )}
        </section>
      )}
      {mode.kind === 'normal' && EDITION_CONFIG.metaProgression && (
        <MetaPanel meta={meta} unlocks={unlocks} />
      )}
      {EDITION_CONFIG.achievements && <AchievementList progress={props.achievements} />}
      {mode.kind === 'normal' && <StoreLink />}
    </div>
  );
}
