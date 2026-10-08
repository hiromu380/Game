/**
 * 目標の計器（シフト・予算・ノルマ・試運転の結果・ロケットの進み具合）
 *
 * 試運転の結果は、ノルマに対するゲージで比べられるようにする（ゲージの幅は state/trialStatus.ts の quotaRatio）。
 * 未試運転・試運転済み・配置を変えた後（古い結果は薄く）を区別し、ランダムなパーツがあれば「毎回変わる」と添える。
 * 再生中は、同じ場所に出荷量の途中経過を出す
 */
import { getCurrentShift, getDayAndPeriod, getShiftCount, type RunState } from '@chain-factory/sim';
import { useI18n } from '../i18n';
import { quotaRatio, type TrialStatus } from '../state/trialStatus';
import { RocketProgress } from './RocketProgress';
import { useCountUp } from './useCountUp';

interface Props {
  run: RunState;
  /** 表示する出荷量（再生中は途中経過、それ以外は null で非表示） */
  liveScore: string | null;
  /** このシフトの試運転の状態 */
  trial: TrialStatus;
}

export function Hud({ run, liveScore: target, trial }: Props) {
  const { t, formatScore, formatMeasuredCompact } = useI18n();
  // 出荷のたびに、前の値から勢いよく増えてピタッと止まる
  const liveScore = useCountUp(target);
  const quota = getCurrentShift(run).quota;
  const live = liveScore === null ? null : BigInt(liveScore);
  // ゲージに出す値: 再生中は出荷量の途中経過、それ以外は直近の試運転の結果
  const shown = live ?? (trial.kind === 'none' ? null : trial.last);
  const ratio = shown === null ? 0 : quotaRatio(shown, quota);
  const met = shown !== null && ratio >= 1;
  const stale = live === null && trial.kind === 'stale';
  const { day, period } = getDayAndPeriod(run);

  return (
    <div className="hud control-console">
      <div className="control-console__plate">
        <span>{t('world.factoryId')}</span>
        <strong>{t('world.orderId', { id: String(run.seed).slice(-4).padStart(4, '0') })}</strong>
      </div>
      <div className="hud__item hud__item--shift">
        <span>
          {t('hud.dayPeriod', { day: day + 1, period: t(`period.${period}` as 'period.0') })}
        </span>
        <span className="hud__label">
          {run.overtime
            ? t('hud.overtime', { current: run.shiftIndex + 1 })
            : t('hud.shiftProgress', { current: run.shiftIndex + 1, total: getShiftCount(run) })}
        </span>
      </div>
      <div className="hud__item">
        <span className="hud__label">{t('hud.budget')}</span>
        <span className="hud__value">{t('shop.price', { price: run.budget })}</span>
      </div>
      {/* ノルマはいちばん大事な数字なので、枠つきで大きく出す。再生中は出荷量の進み具合をバーで見せる */}
      <div className={`hud__item hud__quota ${met && !stale ? 'is-met' : ''}`}>
        <span className="hud__label">{t('hud.quota')}</span>
        <span className="hud__quota-value">{formatScore(String(quota))}</span>
      </div>
      {/* 試運転の結果（再生中は出荷量の途中経過）と、ノルマに対するゲージ */}
      <div
        className={`hud__item hud__trial ${stale ? 'is-stale' : ''} ${met && !stale ? 'is-met' : ''}`}
        aria-live="polite"
      >
        <span className="hud__label">{t(live !== null ? 'hud.score' : 'hud.trial')}</span>
        <span className="hud__value hud__value--score">
          {shown === null ? t('hud.trialNone') : formatMeasuredCompact(shown.toString())}
          {shown !== null && (
            <small className="hud__trial-percent">
              {met
                ? t('hud.trialMet')
                : t('hud.trialPercent', { percent: Math.floor(ratio * 100) })}
            </small>
          )}
        </span>
        <span className="hud__quota-bar" aria-hidden>
          <span style={{ width: `${Math.round(ratio * 100)}%` }} />
        </span>
        {live === null && trial.kind !== 'none' && (
          <span className="hud__trial-note">
            {stale
              ? t('hud.trialStale')
              : trial.random
                ? trial.count > 1
                  ? t('hud.trialRange', {
                      count: trial.count,
                      min: formatMeasuredCompact(trial.min.toString()),
                      max: formatMeasuredCompact(trial.max.toString()),
                    })
                  : t('hud.trialRandom')
                : null}
          </span>
        )}
        {live === null && trial.kind === 'none' && (
          <span className="hud__trial-note">{t('hud.trialHint')}</span>
        )}
      </div>
      <RocketProgress run={run} />
    </div>
  );
}
