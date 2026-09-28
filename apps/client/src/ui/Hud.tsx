/**
 * 画面上部の情報表示（シフト・予算・ノルマ・出荷量・ロケットの進み具合）
 */
import { getCurrentShift, getDayAndPeriod, getShiftCount, type RunState } from '@chain-factory/sim';
import { useI18n } from '../i18n';
import { RocketProgress } from './RocketProgress';

interface Props {
  run: RunState;
  /** 表示する出荷量（再生中は途中経過、それ以外は null で非表示） */
  liveScore: string | null;
}

export function Hud({ run, liveScore }: Props) {
  const { t, formatScore } = useI18n();
  const quota = getCurrentShift(run).quota;
  // 出荷量 ÷ ノルマ（表示用の目安なので、大きな数は Number の精度で十分）
  const ratio = liveScore === null ? 0 : Math.min(1, Number(liveScore) / Math.max(1, quota));
  const met = liveScore !== null && ratio >= 1;
  const { day, period } = getDayAndPeriod(run);

  return (
    <div className="hud">
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
      <div className={`hud__item hud__quota ${met ? 'is-met' : ''}`}>
        <span className="hud__label">{t('hud.quota')}</span>
        <span className="hud__quota-value">{formatScore(String(quota))}</span>
        {liveScore !== null && (
          <span className="hud__quota-bar">
            <span style={{ width: `${Math.round(ratio * 100)}%` }} />
          </span>
        )}
      </div>
      <div className="hud__item">
        <span className="hud__label">{t('hud.score')}</span>
        <span className="hud__value hud__value--score">
          {liveScore ? formatScore(liveScore) : '—'}
        </span>
      </div>
      <RocketProgress run={run} />
    </div>
  );
}
