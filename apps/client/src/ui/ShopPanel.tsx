/**
 * ショップ: その シフトに並んだ商品を購入する
 */
import type { EconomyConfig, PartId, RuleSet, ShopOffer } from '@chain-factory/sim';
import { useState } from 'react';
import type { PriceTrend } from '../online/market';
import { useI18n } from '../i18n';
import { describePart } from './partText';
import { PartCatalog } from './PartCatalog';
import { PartIcon } from './PartIcon';
import { UiIcon } from './UiIcon';

interface Props {
  /** 説明文に数値を差し込むためのルール */
  rules: RuleSet;
  /** このシフトの経済設定（パーツ一覧で、並びうるパーツ・価格・出やすさを出す） */
  economy: EconomyConfig;
  offers: ShopOffer[];
  budget: number;
  /** 次のリロール価格（リロールできないシフトでは null） */
  rerollCost: number | null;
  /** 相場の前週比（値上がり・値下がりしたパーツだけ） */
  trends: Partial<Record<PartId, PriceTrend>>;
  disabled: boolean;
  /** 初回ガイドで買ってほしいパーツ（最初の1つを光らせる） */
  guidePartId?: PartId | null;
  /** 初回ガイドでリロールを勧めるとき（光らせる） */
  guideReroll?: boolean;
  onBuy: (offerIndex: number) => void;
  onReroll: () => void;
}

export function ShopPanel(props: Props) {
  const { rules, economy, offers, budget, rerollCost, trends, disabled, onBuy, onReroll } = props;
  const guidedIndex = props.guidePartId
    ? offers.findIndex((o) => o.partId === props.guidePartId && !o.sold)
    : -1;
  const { t } = useI18n();
  const [catalogOpen, setCatalogOpen] = useState(false);
  return (
    <section className="panel" data-panel="shop">
      <div className="panel__header">
        <h2 className="panel__title">
          <small className="panel__eyebrow">{t('shop.vendor')}</small>
          {t('shop.title')}
        </h2>
        <button className="button--small button--ghost" onClick={() => setCatalogOpen(true)}>
          {t('catalog.open')}
        </button>
        <button
          className={`button--small ${props.guideReroll ? 'is-guided' : ''}`}
          disabled={disabled || rerollCost === null || budget < rerollCost}
          onClick={onReroll}
        >
          <UiIcon name="reroll" size={16} />
          {rerollCost === null ? t('shop.rerollDisabled') : t('shop.reroll', { cost: rerollCost })}
          {rerollCost !== null && budget < rerollCost && (
            <span className="shop__short">{t('shop.short', { amount: rerollCost - budget })}</span>
          )}
        </button>
      </div>
      <ul className="item-list">
        {offers.map((offer, index) => {
          const affordable = budget >= offer.price;
          return (
            <li key={index}>
              <button
                className={`item-button ${index === guidedIndex ? 'is-guided' : ''}`}
                disabled={disabled || offer.sold || !affordable}
                onClick={() => onBuy(index)}
              >
                {offer.partId === undefined ? (
                  <>
                    <span className="item-icon">
                      <UiIcon name="permit" size={36} />
                    </span>
                    <span className="item-button__text">
                      <span className="item-button__name">{t(`item.${offer.itemId}.name`)}</span>
                      <span className="item-button__desc">{t(`item.${offer.itemId}.desc`)}</span>
                    </span>
                  </>
                ) : (
                  <>
                    <PartIcon partId={offer.partId} />
                    <span className="item-button__text">
                      <span className="item-button__name">{t(`part.${offer.partId}.name`)}</span>
                      <span className="item-button__desc">
                        {describePart(t, offer.partId, rules)}
                      </span>
                    </span>
                  </>
                )}
                <span className="item-button__meta">
                  <span className="item-button__price">
                    {offer.sold ? t('shop.sold') : t('shop.price', { price: offer.price })}
                  </span>
                  {!offer.sold && offer.partId && trends[offer.partId] && (
                    <span
                      className={`trend trend--${trends[offer.partId]}`}
                      title={t(trends[offer.partId] === 'up' ? 'shop.trendUp' : 'shop.trendDown')}
                    >
                      {trends[offer.partId] === 'up' ? '▲' : '▼'}
                    </span>
                  )}
                  {!offer.sold &&
                    (affordable ? (
                      <span className="item-button__after">
                        {t('shop.after', { amount: budget - offer.price })}
                      </span>
                    ) : (
                      <span className="shop__short">
                        {t('shop.short', { amount: offer.price - budget })}
                      </span>
                    ))}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      {catalogOpen && (
        <PartCatalog economy={economy} rules={rules} onClose={() => setCatalogOpen(false)} />
      )}
    </section>
  );
}
