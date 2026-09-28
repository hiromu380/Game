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
  onSelect: (partId: PartId) => void;
}

export function InventoryPanel({ rules, inventory, selection, disabled, onSelect }: Props) {
  const { t } = useI18n();
  const items = PART_IDS.filter((id) => (inventory[id] ?? 0) > 0);
  const selectedId = selection?.kind === 'inventory' ? selection.partId : null;

  return (
    <section className="panel" data-panel="inventory">
      <h2 className="panel__title">{t('inventory.title')}</h2>
      {items.length === 0 ? (
        <p className="panel__hint">{t('inventory.empty')}</p>
      ) : (
        <ul className="item-list">
          {items.map((id) => (
            <li key={id}>
              <button
                className={`item-button ${selectedId === id ? 'item-button--selected' : ''}`}
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
