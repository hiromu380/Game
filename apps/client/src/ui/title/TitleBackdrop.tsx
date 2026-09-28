/**
 * タイトル画面の背景（動く飾り）: 星空・ときどき飛び立つロケット・パーツを運ぶベルトコンベア・ボルト
 *
 * 画像は素材マニフェストのものを流用し、動きは CSS のアニメーションだけで付ける（styles.css の .title-backdrop）。
 * 演出の強さ「最小」・端末の「動きを減らす」設定では止める。
 */
import { PART_IDS } from '@chain-factory/sim';
import { MASCOT_ASSETS, PART_ASSETS, ROCKET_ASSETS } from '../../assets/manifest';
import { useSettings } from '../../settings/SettingsContext';

/** ベルトに載せるパーツ（スイッチ以外を1つずつ。つなぎ目が見えないよう2周分並べる） */
const BELT_PARTS = PART_IDS.filter((id) => id !== 'switch');

export function TitleBackdrop() {
  const { settings } = useSettings();
  return (
    <div
      className={`title-backdrop ${settings.effects === 'minimal' ? 'is-still' : ''}`}
      aria-hidden="true"
    >
      <div className="title-backdrop__stars" />
      <div className="title-backdrop__rocket">
        <img
          src={ROCKET_ASSETS.stages[ROCKET_ASSETS.stages.length - 1]}
          alt=""
          width={64}
          height={70}
        />
        <img className="title-backdrop__flame" src={ROCKET_ASSETS.flame} alt="" width={20} />
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
          {[...BELT_PARTS, ...BELT_PARTS].map((id, i) => (
            <img key={i} src={PART_ASSETS[id].src} alt="" width={40} height={40} />
          ))}
        </div>
      </div>
    </div>
  );
}
