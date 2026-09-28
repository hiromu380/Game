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
  /** 相場の前日比（値上がり・値下がりしたパーツだけ） */
  trends: Partial<Record<PartId, PriceTrend>>;
  disabled: boolean;
  /** 盤面のパーツをドラッグ中なら、ここへ落としたときの返金額（売れないパーツ・ドラッグ中でなければ null） */
  sellRefund: number | null;
  /** 初回ガイドで買ってほしいパーツ（最初の1つを光らせる） */
  guidePartId?: PartId | null;
  onBuy: (offerIndex: number) => void;
  onReroll: () => void;
}

export function ShopPanel(props: Props) {
  const {
    rules,
    economy,
    offers,
    budget,
    rerollCost,
    trends,
    disabled,
    sellRefund,
    onBuy,
    onReroll,
  } = props;
  const guidedIndex = props.guidePartId
    ? offers.findIndex((o) => o.partId === props.guidePartId && !o.sold)
    : -1;
  const { t } = useI18n();
  const [catalogOpen, setCatalogOpen] = useState(false);
  return (
    <section className="panel shop" data-panel="shop">
      {sellRefund !== null && (
        <div className="shop__sell-drop">{t('shop.dropToSell', { refund: sellRefund })}</div>
      )}
      <div className="panel__header">
        <h2 className="panel__title">{t('shop.title')}</h2>
        <button className="button--small button--ghost" onClick={() => setCatalogOpen(true)}>
          {t('catalog.open')}
        </button>
        <button
          className="button--small"
          disabled={disabled || rerollCost === null || budget < rerollCost}
          onClick={onReroll}
        >
          <UiIcon name="reroll" size={16} />
          {rerollCost === null ? t('shop.rerollDisabled') : t('shop.reroll', { cost: rerollCost })}
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
      {catalogOpen && (
        <PartCatalog economy={economy} rules={rules} onClose={() => setCatalogOpen(false)} />
      )}
    </section>
  );
}
