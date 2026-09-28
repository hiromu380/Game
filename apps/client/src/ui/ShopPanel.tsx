/**
 * ショップ: その シフトに並んだ商品を購入する
 */
import type { ShopOffer } from '@chain-factory/sim';
import { useI18n } from '../i18n';
import { PartIcon } from './PartIcon';

interface Props {
  offers: ShopOffer[];
  budget: number;
  /** 次のリロール価格（リロールできないシフトでは null） */
  rerollCost: number | null;
  disabled: boolean;
  onBuy: (offerIndex: number) => void;
  onReroll: () => void;
}

export function ShopPanel({ offers, budget, rerollCost, disabled, onBuy, onReroll }: Props) {
  const { t } = useI18n();
  return (
    <section className="panel">
      <div className="panel__header">
        <h2 className="panel__title">{t('shop.title')}</h2>
        <button
          className="button--small"
          disabled={disabled || rerollCost === null || budget < rerollCost}
          onClick={onReroll}
        >
          {rerollCost === null ? t('shop.rerollDisabled') : t('shop.reroll', { cost: rerollCost })}
        </button>
      </div>
      <ul className="item-list">
        {offers.map((offer, index) => {
          const affordable = budget >= offer.price;
          return (
            <li key={index}>
              <button
                className="item-button"
                disabled={disabled || offer.sold || !affordable}
                onClick={() => onBuy(index)}
              >
                <PartIcon partId={offer.partId} />
                <span className="item-button__text">
                  <span className="item-button__name">{t(`part.${offer.partId}.name`)}</span>
                  <span className="item-button__desc">{t(`part.${offer.partId}.desc`)}</span>
                </span>
                <span className="item-button__meta">
                  {offer.sold ? t('shop.sold') : t('shop.price', { price: offer.price })}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
