/**
 * ショップ: その シフトに並んだ商品を購入する
 */
import type { PartId, RuleSet, ShopOffer } from '@chain-factory/sim';
import type { PriceTrend } from '../online/market';
import { useI18n } from '../i18n';
import { describePart } from './partText';
import { PartIcon } from './PartIcon';

interface Props {
  /** 説明文に数値を差し込むためのルール */
  rules: RuleSet;
  offers: ShopOffer[];
  budget: number;
  /** 次のリロール価格（リロールできないシフトでは null） */
  rerollCost: number | null;
  /** 相場の前日比（値上がり・値下がりしたパーツだけ） */
  trends: Partial<Record<PartId, PriceTrend>>;
  disabled: boolean;
  onBuy: (offerIndex: number) => void;
  onReroll: () => void;
}

export function ShopPanel(props: Props) {
  const { rules, offers, budget, rerollCost, trends, disabled, onBuy, onReroll } = props;
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
                  <span className="item-button__desc">{describePart(t, offer.partId, rules)}</span>
                </span>
                <span className="item-button__meta">
                  {offer.sold ? t('shop.sold') : t('shop.price', { price: offer.price })}
                  {!offer.sold && trends[offer.partId] && (
                    <span
                      className={`trend trend--${trends[offer.partId]}`}
                      title={t(trends[offer.partId] === 'up' ? 'shop.trendUp' : 'shop.trendDown')}
                    >
                      {trends[offer.partId] === 'up' ? '▲' : '▼'}
                    </span>
                  )}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
