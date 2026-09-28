/**
 * ロケット（1ランの目的）の表示: 画面上部の進み具合と、最初のシフトの目的の案内
 */
import type { RunState } from '@chain-factory/sim';
import { ROCKET_ASSETS } from '../assets/manifest';
import { useI18n } from '../i18n';
import { getRocketProgress, ROCKET_PARTS } from '../state/rocket';

/** ランの最初のシフトだけ出す、目的の案内 */
export function RocketGoal({ run }: { run: RunState }) {
  const { t } = useI18n();
  if (run.shiftIndex !== 0 || run.history.length > 0) return null;
  return (
    <div className="boss-notice rocket-goal">
      <img className="boss-notice__icon" src={ROCKET_ASSETS.stages[ROCKET_PARTS]} alt="" />
      <span className="boss-notice__label">{t('rocket.goalLabel')}</span>
      <span className="boss-notice__desc">
        {t(run.config.shifts.length > run.config.shiftsPerDay ? 'rocket.goal' : 'rocket.goalDaily')}
      </span>
    </div>
  );
}

export function RocketProgress({ run }: { run: RunState }) {
  const { t } = useI18n();
  const { parts, launched } = getRocketProgress(run);
  return (
    <div className="hud__item hud__rocket" title={t('rocket.goal')}>
      <img src={ROCKET_ASSETS.stages[parts]} alt="" width={28} height={30} />
      <span>
        <span className="hud__label">{t('rocket.label')}</span>
        <span className="hud__value">
          {launched ? t('rocket.launched') : t('rocket.parts', { parts, total: ROCKET_PARTS })}
        </span>
      </span>
    </div>
  );
}
