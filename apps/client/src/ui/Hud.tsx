/**
 * 画面上部の情報表示（シフト・予算・ノルマ・出荷量）
 */
import { getCurrentShift, getShiftCount, type RunState } from '@chain-factory/sim';
import { useI18n } from '../i18n';
import { formatScore } from './format';

interface Props {
  run: RunState;
  /** 表示する出荷量（再生中は途中経過、それ以外は null で非表示） */
  liveScore: string | null;
}

export function Hud({ run, liveScore }: Props) {
  const { t } = useI18n();
  const quota = getCurrentShift(run).quota;

  return (
    <div className="hud">
      <div className="hud__item hud__item--shift">
        {t('hud.shift', { current: run.shiftIndex + 1, total: getShiftCount(run) })}
      </div>
      <div className="hud__item">
        <span className="hud__label">{t('hud.budget')}</span>
        <span className="hud__value">{t('shop.price', { price: run.budget })}</span>
      </div>
      <div className="hud__item">
        <span className="hud__label">{t('hud.quota')}</span>
        <span className="hud__value">{formatScore(String(quota))}</span>
      </div>
      <div className="hud__item">
        <span className="hud__label">{t('hud.score')}</span>
        <span className="hud__value hud__value--score">
          {liveScore ? formatScore(liveScore) : '—'}
        </span>
      </div>
    </div>
  );
}
