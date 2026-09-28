/**
 * 遊び方（タイトル画面から開く）: 目的 → 置き方と操作 → 連鎖のコツ → 夜シフト・延長戦・デイリー
 * 文言は i18n の howTo.*。ページを足すときは PAGES に足し、i18n に title / body を足す
 */
import { useState } from 'react';
import { MASCOT_ASSETS, PART_ASSETS, ROCKET_ASSETS } from '../../assets/manifest';
import { useI18n } from '../../i18n';

const PAGES = [
  { key: 'goal', image: ROCKET_ASSETS.stages[ROCKET_ASSETS.stages.length - 1]! },
  { key: 'build', image: PART_ASSETS.switch.src },
  { key: 'chain', image: PART_ASSETS.gear.src },
  { key: 'night', image: MASCOT_ASSETS.surprised },
] as const;

export default function HowToPlay({ onClose }: { onClose: () => void }) {
  const { t } = useI18n();
  const [index, setIndex] = useState(0);
  const page = PAGES[index]!;
  const last = index === PAGES.length - 1;
  return (
    <div className="modal" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="modal__body panel how-to" onClick={(e) => e.stopPropagation()}>
        <h2 className="panel__title">{t('howTo.title')}</h2>
        <div className="how-to__page">
          <img className="how-to__image" src={page.image} alt="" width={72} height={72} />
          <h3>{t(`howTo.${page.key}.title`)}</h3>
          <ul className="how-to__body">
            {t(`howTo.${page.key}.body`)
              .split('\n')
              .map((line) => (
                <li key={line}>{line}</li>
              ))}
          </ul>
        </div>
        <div className="how-to__dots" aria-hidden="true">
          {PAGES.map((p, i) => (
            <span key={p.key} className={i === index ? 'is-active' : ''} />
          ))}
        </div>
        <div className="button-row">
          <button
            className="button--ghost"
            disabled={index === 0}
            onClick={() => setIndex(index - 1)}
          >
            {t('howTo.prev')}
          </button>
          {last ? (
            <button className="button--primary" onClick={onClose} data-close>
              {t('howTo.close')}
            </button>
          ) : (
            <button className="button--primary" onClick={() => setIndex(index + 1)} autoFocus>
              {t('howTo.next')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
