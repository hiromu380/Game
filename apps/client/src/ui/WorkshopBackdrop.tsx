/**
 * ゲーム画面の遠景。シフトの時間、ロケットの建造、これまでの操業の痕跡を
 * ゲーム状態から描く（装飾だけなのでセーブデータは増やさない）。
 */
import { activeEvent, getDayAndPeriod, type MetaProgress, type RunState } from '@chain-factory/sim';
import { MASCOT_ASSETS, ROCKET_ASSETS, TITLE_ASSETS } from '../assets/manifest';
import { useI18n } from '../i18n';
import { useBoltMood } from '../state/playbackMoments';
import { getRocketProgress } from '../state/rocket';

interface Props {
  run: RunState;
  meta: MetaProgress;
  playing: boolean;
  alert: boolean;
  /** 本番の結果が出た直後（ノルマ達成なら喜び、未達なら失敗の表情）。それ以外は null */
  outcome?: 'met' | 'missed' | null;
}

export function WorkshopBackdrop({ run, meta, playing, alert, outcome = null }: Props) {
  // 再生中の見せ場（連鎖の節目・桁上がり・ピーク）で表情が変わり、そのたびに小さく跳ねる
  const { mood, beat } = useBoltMood();
  const expression =
    outcome === 'met'
      ? 'happy'
      : outcome === 'missed'
        ? 'fail'
        : playing
          ? (mood ?? 'idle')
          : 'idle';
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
        <span className="workshop__sky-label">
          {t(`atmosphere.period.${period}` as 'atmosphere.period.0')}
        </span>
        <span className="workshop__stars" />
        <img className="workshop__factory" src={TITLE_ASSETS.factory} alt="" />
      </div>
      <div className="workshop__gantry">
        <span className="workshop__gantry-top" />
        <img className="workshop__rocket" src={ROCKET_ASSETS.stages[parts]} alt="" />
        <span className="workshop__cable workshop__cable--a" />
        <span className="workshop__cable workshop__cable--b" />
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
      <span className="workshop__beacon" />
      <img
        key={playing && mood ? beat : 'rest'}
        className={`workshop__bolt ${playing ? 'is-watching' : ''} ${playing && mood ? 'is-reacting' : ''}`}
        src={MASCOT_ASSETS[expression]}
        alt=""
      />
    </div>
  );
}
