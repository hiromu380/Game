/**
 * ショップ: その シフトに並んだ商品を購入する
 */
import type { ShopOffer } from '@chain-factory/sim';
import { useI18n } from '../i18n';
import { PartIcon } from './PartIcon';

interface Props {
  offers: ShopOffer[];
  budget: number;
  disabled: boolean;
  onBuy: (offerIndex: number) => void;
}

export function ShopPanel({ offers, budget, disabled, onBuy }: Props) {
  const { t } = useI18n();
  return (
    <section className="panel">
      <h2 className="panel__title">{t('shop.title')}</h2>
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
