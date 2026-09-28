/**
 * 手持ち: 購入済みで未配置のパーツ。選んでから盤面をクリックして配置する
 */
import { PART_IDS, type PartId, type RuleSet, type RunState } from '@chain-factory/sim';
import { useI18n } from '../i18n';
import { describePart } from './partText';
import type { Selection } from '../state/gameReducer';
import { PartIcon } from './PartIcon';

interface Props {
  /** 説明文に数値を差し込むためのルール */
  rules: RuleSet;
  inventory: RunState['inventory'];
  selection: Selection;
  disabled: boolean;
  /** 盤面にパーツが1つでもあるか（「全部戻す」の有効・無効） */
  boardHasParts: boolean;
  /** 初回ガイドで選んでほしいパーツ（光らせる） */
  guidePartId?: PartId | null;
  onSelect: (partId: PartId) => void;
  onReturnAll: () => void;
}

export function InventoryPanel({
  rules,
  inventory,
  selection,
  disabled,
  boardHasParts,
  guidePartId = null,
  onSelect,
  onReturnAll,
}: Props) {
  const { t } = useI18n();
  const items = PART_IDS.filter((id) => (inventory[id] ?? 0) > 0);
  const selectedId = selection?.kind === 'inventory' ? selection.partId : null;

  return (
    <section className="panel" data-panel="inventory">
      <div className="panel__header">
        <h2 className="panel__title">{t('inventory.title')}</h2>
        <button
          className="button--small button--ghost"
          disabled={disabled || !boardHasParts}
          onClick={onReturnAll}
        >
          {t('inventory.returnAll')}
        </button>
      </div>
      {items.length === 0 ? (
        <p className="panel__hint">{t('inventory.empty')}</p>
      ) : (
        <ul className="item-list">
          {items.map((id) => (
            <li key={id}>
              <button
                className={`item-button ${selectedId === id ? 'item-button--selected' : ''} ${guidePartId === id && selectedId !== id ? 'is-guided' : ''}`}
                disabled={disabled}
                onClick={() => onSelect(id)}
              >
                <PartIcon partId={id} />
                <span className="item-button__text">
                  <span className="item-button__name">{t(`part.${id}.name`)}</span>
                  <span className="item-button__desc">{describePart(t, id, rules)}</span>
                </span>
                <span className="item-button__meta">×{inventory[id]}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="panel__hint">
        {selection?.kind === 'inventory'
          ? t('inventory.placingDir', { dir: t(`dir.${selection.dir}`) })
          : t('inventory.hint')}
      </p>
    </section>
  );
}
