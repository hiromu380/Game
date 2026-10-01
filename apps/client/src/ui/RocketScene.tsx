/**
 * ラン終了画面のロケット
 * - 本編を全部クリア: 発射（炎を出して上へ飛んでいく。演出の強さが「最小」なら動かさない）
 * - 途中で脱落: 組み上がったところまでの未完成のロケット
 * - 延長戦の後: どこまで届いたか
 */
import type { RunState } from '@chain-factory/sim';
import { MASCOT_ASSETS, ROCKET_ASSETS } from '../assets/manifest';
import { useI18n } from '../i18n';
import { useSettings } from '../settings/SettingsContext';
import { getRocketProgress, ROCKET_PARTS } from '../state/rocket';
import { destinationName } from './RocketProgress';

export function RocketScene({ run }: { run: RunState }) {
  const { t } = useI18n();
  const { settings } = useSettings();
  const { parts, launched, destinations } = getRocketProgress(run);
  const reached = destinationName(t, destinations);
  const animate = launched && settings.effects !== 'minimal';
  return (
    <div
      className={`rocket-scene ${launched ? 'is-launched' : ''} ${animate ? 'is-animated' : ''}`}
    >
      <div className="rocket-scene__sky">
        <div className="rocket-scene__rocket">
          <img src={ROCKET_ASSETS.stages[parts]} alt="" width={96} height={104} />
          {launched && (
            <img className="rocket-scene__flame" src={ROCKET_ASSETS.flame} alt="" width={30} />
          )}
        </div>
      </div>
      <p className="rocket-scene__caption">
        {reached
          ? t('rocket.reachedCaption', { name: reached })
          : run.overtime
            ? t('rocket.overtimeNoArrival')
            : launched
              ? t('rocket.launchCaption')
              : t('rocket.unfinished', { parts, total: ROCKET_PARTS })}
      </p>
      <div className="rocket-scene__bolt">
        <img
          src={MASCOT_ASSETS[launched || reached ? 'happy' : 'fail']}
          alt=""
          width={56}
          height={56}
        />
        <p>
          {t(
            reached
              ? 'bolt.result.arrived'
              : launched
                ? 'bolt.result.launched'
                : 'bolt.result.unfinished',
          )}
        </p>
      </div>
    </div>
  );
}
