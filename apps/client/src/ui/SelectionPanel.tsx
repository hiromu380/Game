/**
 * 盤面で選択中のパーツの操作（回転・撤去）
 */
import { BALANCE, getPart, getRefund, type RunState } from '@chain-factory/sim';
import { useI18n } from '../i18n';
import type { Selection } from '../state/gameReducer';
import { PartIcon } from './PartIcon';

interface Props {
  run: RunState;
  selection: Selection;
  disabled: boolean;
  onRotate: () => void;
  onRemove: () => void;
}

export function SelectionPanel({ run, selection, disabled, onRotate, onRemove }: Props) {
  const { t } = useI18n();
  const part = selection?.kind === 'cell' ? getPart(run.board, selection.x, selection.y) : null;

  return (
    <section className="panel">
      <h2 className="panel__title">{t('selection.title')}</h2>
      {part ? (
        <>
          <div className="selection__part">
            <PartIcon partId={part.id} />
            <div>
              <div className="selection__name">
                {t(`part.${part.id}.name`)}（{t(`dir.${part.dir}`)}）
              </div>
              <div className="panel__hint">{t(`part.${part.id}.desc`)}</div>
            </div>
          </div>
          <div className="button-row">
            <button disabled={disabled} onClick={onRotate}>
              {t('selection.rotate')}
            </button>
            <button disabled={disabled} onClick={onRemove}>
              {BALANCE.run.returnToInventoryOnRemove.includes(part.id)
                ? t('selection.removeToInventory')
                : t('selection.remove', { refund: getRefund(part.id) })}
            </button>
          </div>
        </>
      ) : (
        <p className="panel__hint">{t('selection.none')}</p>
      )}
    </section>
  );
}
