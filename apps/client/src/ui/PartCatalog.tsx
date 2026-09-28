/**
 * パーツ一覧（このランのショップに並びうるパーツ）: 価格・レア度・効果
 *
 * まだ解放していないパーツは、解放の条件と一緒に薄く表示する（体験版では「製品版で使える」）。
 */
import {
  BALANCE,
  PART_IDS,
  type EconomyConfig,
  type PartId,
  type RuleSet,
} from '@chain-factory/sim';
import { createPortal } from 'react-dom';
import { EDITION_CONFIG } from '../config/edition';
import { useI18n } from '../i18n';
import { describeCondition } from './MetaPanel';
import { describePart } from './partText';
import { PartIcon } from './PartIcon';

interface Props {
  economy: EconomyConfig;
  rules: RuleSet;
  onClose: () => void;
}

const RARITY_ORDER = { common: 0, uncommon: 1, rare: 2 } as const;

export function PartCatalog({ economy, rules, onClose }: Props) {
  const { t, formatScore } = useI18n();
  const available = [...economy.shopPool].sort(
    (a, b) =>
      RARITY_ORDER[BALANCE.parts[a.partId].rarity ?? 'common'] -
        RARITY_ORDER[BALANCE.parts[b.partId].rarity ?? 'common'] ||
      economy.prices[a.partId] - economy.prices[b.partId],
  );
  const inPool = new Set<PartId>(available.map((p) => p.partId));
  const locked = PART_IDS.filter((id) => !inPool.has(id) && BALANCE.parts[id].rarity !== null);
  const unlockOf = (id: PartId) => BALANCE.meta.partUnlocks.find((u) => u.partId === id);

  // ショップの中（盤面の大きさの基準になる .layout の中）から開くので、固定配置がずれないよう body 直下に出す
  return createPortal(
    <div className="modal" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="modal__body panel catalog" onClick={(e) => e.stopPropagation()}>
        <h2 className="panel__title">{t('catalog.title')}</h2>
        <p className="panel__hint">{t('catalog.hint', { offers: economy.offersPerShift })}</p>
        <ul className="catalog__list">
          {available.map(({ partId }) => {
            const rarity = BALANCE.parts[partId].rarity ?? 'common';
            return (
              <li key={partId} className="catalog__item">
                <PartIcon partId={partId} size={36} />
                <div className="catalog__text">
                  <strong>{t(`part.${partId}.name`)}</strong>{' '}
                  <span className={`catalog__rarity catalog__rarity--${rarity}`}>
                    {t(`rarity.${rarity}`)}
                  </span>
                  <div className="catalog__desc">{describePart(t, partId, rules)}</div>
                </div>
                <div className="catalog__meta">
                  {t('catalog.price', { price: economy.prices[partId] })}
                </div>
              </li>
            );
          })}
          {locked.map((partId) => {
            const unlock = unlockOf(partId);
            return (
              <li key={partId} className="catalog__item is-locked">
                <PartIcon partId={partId} size={36} />
                <div className="catalog__text">
                  <strong>{t(`part.${partId}.name`)}</strong>{' '}
                  <span className="catalog__rarity">{t('catalog.locked')}</span>
                  <div className="catalog__desc">
                    {!EDITION_CONFIG.metaProgression || !unlock
                      ? t('catalog.fullOnly')
                      : t('catalog.unlockBy', {
                          condition: describeCondition(t, formatScore, unlock.condition),
                        })}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
        <div className="button-row">
          <button className="button--ghost" onClick={onClose} data-close>
            {t('catalog.close')}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
