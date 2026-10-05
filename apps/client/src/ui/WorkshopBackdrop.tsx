/**
 * ゲーム画面の遠景。シフトの時間、ロケットの建造、これまでの操業の痕跡を
 * ゲーム状態から描く（装飾だけなのでセーブデータは増やさない）。
 */
import { activeEvent, getDayAndPeriod, type MetaProgress, type RunState } from '@chain-factory/sim';
import { BACKDROP_ASSETS, BOLT_BODY_ASSETS, ROCKET_ASSETS } from '../assets/manifest';
import { useI18n } from '../i18n';
import { getRocketProgress } from '../state/rocket';

interface Props {
  run: RunState;
  meta: MetaProgress;
  playing: boolean;
  alert: boolean;
}

export function WorkshopBackdrop({ run, meta, playing, alert }: Props) {
  const { t } = useI18n();
  const { period } = getDayAndPeriod(run);
  const { parts } = getRocketProgress(run);
  const completed = Math.min(9, run.history.filter((entry) => entry.cleared).length);
  const soot = Math.min(4, run.history.length);
  // ランをまたいで残る壁の記念プレート。最大6枚に抑えて遠景を埋めすぎない。
  const plaques = Math.min(6, meta.records.clears);
  const event = activeEvent(run);

  return (
    <div
      className={`workshop workshop--period-${period} ${alert ? 'is-alert' : ''}`}
      aria-hidden="true"
    >
      <div className="workshop__window">
        <img
          className="workshop__sky"
          src={BACKDROP_ASSETS.sky[period] ?? BACKDROP_ASSETS.sky[0]}
          alt=""
        />
        <span className="workshop__sky-label">
          {t(`atmosphere.period.${period}` as 'atmosphere.period.0')}
        </span>
      </div>
      <div className="workshop__gantry">
        <img className="workshop__gantry-frame" src={BACKDROP_ASSETS.gantry} alt="" />
        <img className="workshop__rocket" src={ROCKET_ASSETS.stages[parts]} alt="" />
      </div>
      <div className="workshop__status">
        <span>{t('world.factoryId')}</span>
        <strong>{t('world.rocketBay')}</strong>
      </div>
      <div className="workshop__marks">
        {Array.from({ length: completed }, (_, index) => (
          <span key={index} className="workshop__approval">
            ✓
          </span>
        ))}
        {Array.from({ length: soot }, (_, index) => (
          <span key={`soot-${index}`} className={`workshop__soot workshop__soot--${index + 1}`} />
        ))}
      </div>
      <div className="workshop__plaques">
        {Array.from({ length: plaques }, (_, index) => (
          <span key={index}>★</span>
        ))}
      </div>
      {event && (
        <div className={`workshop__event-prop workshop__event-prop--${event}`}>
          <span>{t('event.today')}</span>
          <strong>{t(`event.${event}.name`)}</strong>
        </div>
      )}
      <img className="workshop__beacon" src={BACKDROP_ASSETS.beacon} alt="" />
      {/* ボルト（全身）: ふだんは立って待ち、演出の再生中はガッツポーズで見守る */}
      <img
        className={`workshop__bolt ${playing ? 'is-watching' : ''}`}
        src={playing ? BOLT_BODY_ASSETS.guts : BOLT_BODY_ASSETS.stand}
        alt=""
      />
    </div>
  );
}
