/**
 * タイトル画面の背景（動く飾り）: 夕暮れの空と星・ゆっくり回る歯車・ときどき飛び立つロケット・
 * 煙を上げる工場のシルエット（窓の明かりが点滅）・パーツを運ぶベルトコンベア・跳ねるボルト
 *
 * 画像は素材マニフェストのものを使い、動きは CSS のアニメーションだけで付ける（styles.css の .title-backdrop）。
 * 演出の強さ「最小」・端末の「動きを減らす」設定では止める。
 */
import { BALANCE, type MetaProgress } from '@chain-factory/sim';
import { MASCOT_ASSETS, PART_ASSETS, ROCKET_ASSETS, TITLE_ASSETS } from '../../assets/manifest';
import { useSettings } from '../../settings/SettingsContext';

/** ベルトに載せるパーツ（スイッチ以外を1つずつ。つなぎ目が見えないよう2周分並べる） */
/** 工場の棟を置く位置（画面の横幅に対する %）。棟ごとに煙の出るタイミングをずらす */
const FACTORIES = [
  { left: '-4%', delay: '0s' },
  { left: '34%', delay: '-1.3s' },
  { left: '72%', delay: '-2.6s' },
];

/** 煙突1本分の煙（3つの煙の粒を時間差で昇らせる） */
function Smoke({ className }: { className: string }) {
  return (
    <span className={`title-backdrop__smoke ${className}`}>
      <span />
      <span />
      <span />
    </span>
  );
}

export function TitleBackdrop({ meta }: { meta: MetaProgress | null }) {
  const { settings } = useSettings();
  const completedRuns = meta?.records.clears ?? 0;
  const played = (meta?.records.runsPlayed ?? 0) > 0;
  const lastStage = ROCKET_ASSETS.stages.length - 1;
  const rocketStage =
    completedRuns > 0
      ? lastStage
      : played
        ? Math.min(
            lastStage - 1,
            Math.floor(((meta!.records.bestShiftReached + 1) * lastStage) / 9),
          )
        : 0;
  const rocket = ROCKET_ASSETS.stages[rocketStage];
  const beltParts = (meta?.unlockedParts ?? BALANCE.meta.initialUnlocked).filter(
    (id) => id !== 'switch',
  );
  const visibleParts = beltParts.length > 0 ? beltParts : (['conveyor'] as const);
  const beltLap = Array.from(
    { length: Math.max(10, visibleParts.length) },
    (_, index) => visibleParts[index % visibleParts.length]!,
  );
  return (
    <div
      className={`title-backdrop ${settings.effects === 'minimal' ? 'is-still' : ''} ${completedRuns > 0 ? 'has-launched' : 'is-building'}`}
      aria-hidden="true"
    >
      <div className="title-backdrop__stars" />
      <img
        className="title-backdrop__gear title-backdrop__gear--a"
        src={TITLE_ASSETS.gear}
        alt=""
      />
      <img
        className="title-backdrop__gear title-backdrop__gear--b"
        src={TITLE_ASSETS.gear}
        alt=""
      />
      {/* ロケット: 機首の向き（傾けた角度）のまま、まっすぐ進む */}
      <div className="title-backdrop__rocket-lane">
        <div className="title-backdrop__rocket">
          <img src={rocket} alt="" width={64} height={70} />
          {completedRuns > 0 && (
            <img className="title-backdrop__flame" src={ROCKET_ASSETS.flame} alt="" width={20} />
          )}
        </div>
      </div>
      <div className="title-backdrop__city">
        {FACTORIES.map((f) => (
          <div
            key={f.left}
            className="title-backdrop__factory"
            style={{ left: f.left, animationDelay: f.delay, ['--delay' as string]: f.delay }}
          >
            <Smoke className="title-backdrop__smoke--a" />
            <Smoke className="title-backdrop__smoke--b" />
            <img src={TITLE_ASSETS.factory} alt="" width={260} height={150} />
            <span className="title-backdrop__blink title-backdrop__blink--a" />
            <span className="title-backdrop__blink title-backdrop__blink--b" />
          </div>
        ))}
      </div>
      <img
        className="title-backdrop__bolt"
        src={MASCOT_ASSETS.happy}
        alt=""
        width={72}
        height={72}
      />
      <div className="title-backdrop__belt">
        <div className="title-backdrop__items">
          {[...beltLap, ...beltLap].map((id, i) => (
            <img key={i} src={PART_ASSETS[id].src} alt="" width={40} height={40} />
          ))}
        </div>
      </div>
    </div>
  );
}
