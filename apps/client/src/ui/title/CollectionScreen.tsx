/**
 * コレクション（タイトル画面から開く）: 実績・パーツ図鑑・解放の目標
 *
 * セーブデータ（メタ進行・実績）を読んで表示するだけで、何も書き換えない。
 * タイトル画面を軽く保つため、Root から遅延読み込みする。
 */
import {
  BALANCE,
  createInitialAchievements,
  createInitialMeta,
  DEFAULT_RULES,
  PART_IDS,
  type PartId,
} from '@chain-factory/sim';
import { useMemo, useState } from 'react';
import { EDITION_CONFIG } from '../../config/edition';
import { useI18n } from '../../i18n';
import { achievementsOnLoad } from '../../state/achievements';
import { loadSave } from '../../state/saveStore';
import { AchievementList } from '../AchievementList';
import { describeCondition, MetaPanel } from '../MetaPanel';
import { describePart } from '../partText';
import { PartIcon } from '../PartIcon';

type Tab = 'parts' | 'goals' | 'achievements';

const RARITY_ORDER = { common: 0, uncommon: 1, rare: 2 } as const;

export default function CollectionScreen({ onClose }: { onClose: () => void }) {
  const { t } = useI18n();
  const { meta, achievements } = useMemo(() => {
    const save = loadSave();
    const meta = save?.meta ?? createInitialMeta();
    return {
      meta,
      achievements: achievementsOnLoad(save?.achievements ?? createInitialAchievements(), meta),
    };
  }, []);

  const tabs: Tab[] = [
    'parts',
    ...(EDITION_CONFIG.metaProgression ? (['goals'] as const) : []),
    ...(EDITION_CONFIG.achievements ? (['achievements'] as const) : []),
  ];
  const [tab, setTab] = useState<Tab>('parts');

  return (
    <div className="modal" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="modal__body panel collection" onClick={(e) => e.stopPropagation()}>
        <h2 className="panel__title">{t('collection.title')}</h2>
        {tabs.length > 1 && (
          <div className="tabs" role="tablist">
            {tabs.map((key) => (
              <button
                key={key}
                role="tab"
                aria-selected={tab === key}
                className={`tabs__tab ${tab === key ? 'is-active' : ''}`}
                onClick={() => setTab(key)}
              >
                {t(`collection.tab.${key}`)}
              </button>
            ))}
          </div>
        )}
        <div className="collection__content">
          {tab === 'parts' && <PartList unlockedParts={meta.unlockedParts} />}
          {tab === 'goals' && <MetaPanel meta={meta} unlocks={[]} />}
          {tab === 'achievements' && <AchievementList progress={achievements} open />}
        </div>
        <div className="button-row">
          <button className="button--ghost" onClick={onClose} data-close>
            {t('collection.close')}
          </button>
        </div>
      </div>
    </div>
  );
}

/** パーツ図鑑: 全パーツの効果・基準価格・レア度と、解放済みかどうか */
function PartList({ unlockedParts }: { unlockedParts: PartId[] }) {
  const { t, formatScore } = useI18n();
  const owned = new Set<PartId>([
    ...BALANCE.meta.initialUnlocked,
    ...(EDITION_CONFIG.metaProgression ? unlockedParts : []),
  ]);
  // スイッチ（ショップに並ばない）を先頭に、あとはレア度 → 基準価格の順
  const parts = [...PART_IDS].sort((a, b) => {
    const ra = BALANCE.parts[a].rarity;
    const rb = BALANCE.parts[b].rarity;
    if (ra === null || rb === null) return ra === null ? -1 : 1;
    return RARITY_ORDER[ra] - RARITY_ORDER[rb] || BALANCE.parts[a].price - BALANCE.parts[b].price;
  });

  return (
    <>
      <p className="panel__hint">{t('collection.partsHint')}</p>
      <ul className="catalog__list">
        {parts.map((partId) => {
          const { rarity, price } = BALANCE.parts[partId];
          const locked = rarity !== null && !owned.has(partId);
          const unlock = BALANCE.meta.partUnlocks.find((u) => u.partId === partId);
          return (
            <li key={partId} className={`catalog__item ${locked ? 'is-locked' : ''}`}>
              <PartIcon partId={partId} size={36} />
              <div className="catalog__text">
                <strong>{t(`part.${partId}.name`)}</strong>{' '}
                <span className={`catalog__rarity catalog__rarity--${rarity ?? 'common'}`}>
                  {rarity ? t(`rarity.${rarity}`) : t('collection.starter')}
                </span>
                {locked && <span className="catalog__rarity">{t('catalog.locked')}</span>}
                <div className="catalog__desc">{describePart(t, partId, DEFAULT_RULES)}</div>
                {locked && (
                  <div className="catalog__desc">
                    {!EDITION_CONFIG.metaProgression || !unlock
                      ? t('catalog.fullOnly')
                      : t('catalog.unlockBy', {
                          condition: describeCondition(t, formatScore, unlock.condition),
                        })}
                  </div>
                )}
              </div>
              {rarity !== null && (
                <div className="catalog__meta">{t('catalog.price', { price })}</div>
              )}
            </li>
          );
        })}
      </ul>
    </>
  );
}
