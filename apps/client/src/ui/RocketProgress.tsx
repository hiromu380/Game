/**
 * ロケット（1ランの目的）の表示: 画面上部の進み具合と、最初のシフトの目的の案内
 */
import { isDayStart, type RunState } from '@chain-factory/sim';
import { ROCKET_ASSETS } from '../assets/manifest';
import { useI18n, type TranslateFn } from '../i18n';
import { getDestination, getRocketProgress, ROCKET_PARTS } from '../state/rocket';

/** 行き先の名前（一覧の最後より先は「銀河の果て +2日」のように数える）。n = 0 なら null */
export function destinationName(t: TranslateFn, n: number): string | null {
  const destination = getDestination(n);
  if (!destination) return null;
  const name = t(`rocket.destination.${destination.key}`);
  return destination.extraDays > 0
    ? t('rocket.destinationBeyond', { name, days: destination.extraDays })
    : name;
}

/**
 * 目的の案内
 * - ランの最初のシフト: ロケットを完成させよう
 * - 延長戦: 次の行き先（その日の夜シフトまでクリアすると届く）
 * - 2日目以降の朝: 盤面を片付けた（パーツは手持ちに戻った）
 */
export function RocketGoal({ run }: { run: RunState }) {
  const { t } = useI18n();
  // 2日目以降の朝: 盤面を片付けたことを知らせる
  if (run.config.resetBoardEachDay && isDayStart(run, run.shiftIndex)) {
    return (
      <div className="boss-notice rocket-goal">
        <img className="boss-notice__icon" src={ROCKET_ASSETS.stages[ROCKET_PARTS]} alt="" />
        <span className="boss-notice__label">{t('rocket.newDayLabel')}</span>
        <span className="boss-notice__desc">{t('rocket.newDay')}</span>
      </div>
    );
  }
  if (run.overtime) {
    const next = destinationName(t, getRocketProgress(run).destinations + 1);
    return (
      <div className="boss-notice rocket-goal">
        <img className="boss-notice__icon" src={ROCKET_ASSETS.stages[ROCKET_PARTS]} alt="" />
        <span className="boss-notice__label">{t('rocket.goalLabel')}</span>
        <span className="boss-notice__desc">{t('rocket.goalOvertime', { next: next ?? '' })}</span>
      </div>
    );
  }
  if (run.shiftIndex !== 0 || run.history.length > 0) return null;
  return (
    <div className="boss-notice rocket-goal">
      <img className="boss-notice__icon" src={ROCKET_ASSETS.stages[ROCKET_PARTS]} alt="" />
      <span className="boss-notice__label">{t('rocket.goalLabel')}</span>
      <span className="boss-notice__desc">
        {t(
          run.config.shifts.length > run.config.shiftsPerDay ? 'rocket.goal' : 'rocket.goalWeekly',
        )}
      </span>
    </div>
  );
}

export function RocketProgress({ run }: { run: RunState }) {
  const { t } = useI18n();
  const { parts, launched, destinations } = getRocketProgress(run);
  const reached = destinationName(t, destinations);
  return (
    <div className="hud__item hud__rocket" title={t('rocket.goal')}>
      <img src={ROCKET_ASSETS.stages[parts]} alt="" width={28} height={30} />
      <span>
        <span className="hud__label">{t('rocket.label')}</span>
        <span className="hud__value">
          {reached
            ? t('rocket.reached', { name: reached })
            : launched
              ? t('rocket.launched')
              : t('rocket.parts', { parts, total: ROCKET_PARTS })}
        </span>
      </span>
    </div>
  );
}
