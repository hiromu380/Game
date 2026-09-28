/**
 * 盤面で選択中のパーツの操作（回転・手持ちに戻す・売却）
 *
 * 「手持ちに戻す」（無料の移動）と「売却」（返金・パーツは消える）を取り違えないよう、
 * 売却は2回押し（1回目で確認表示）にしている。
 */
import { getPart, getRefund, type RunState } from '@chain-factory/sim';
import { useState } from 'react';
import { useI18n } from '../i18n';
import type { Selection } from '../state/gameReducer';
import { PartIcon } from './PartIcon';

interface Props {
  run: RunState;
  selection: Selection;
  disabled: boolean;
  onRotate: () => void;
  onReturn: () => void;
  onSell: () => void;
}

export function SelectionPanel({ run, selection, disabled, onRotate, onReturn, onSell }: Props) {
  const { t } = useI18n();
  const part = selection?.kind === 'cell' ? getPart(run.board, selection.x, selection.y) : null;

  // 売却の確認状態は「どのマスを確認中か」で持ち、選択が変わったら自然に解除されるようにする
  const selectionKey = selection?.kind === 'cell' ? `${selection.x},${selection.y}` : null;
  const [confirmingKey, setConfirmingKey] = useState<string | null>(null);
  const confirming = confirmingKey !== null && confirmingKey === selectionKey;

  if (!part) {
    return (
      <section className="panel">
        <h2 className="panel__title">{t('selection.title')}</h2>
        <p className="panel__hint">{t('selection.none')}</p>
      </section>
    );
  }

  const refund = getRefund(run, part.id);
  const sellable = run.config.economy.prices[part.id] > 0;

  const handleSell = () => {
    if (!confirming) {
      setConfirmingKey(selectionKey);
      return;
    }
    setConfirmingKey(null);
    onSell();
  };

  return (
    <section className="panel">
      <h2 className="panel__title">{t('selection.title')}</h2>
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
        <button disabled={disabled} onClick={onReturn}>
          {t('selection.returnToInventory')}
        </button>
      </div>
      <div className="button-row selection__danger">
        <button
          className={confirming ? 'button--danger' : 'button--ghost'}
          disabled={disabled || !sellable}
          onClick={handleSell}
          onBlur={() => setConfirmingKey(null)}
        >
          {!sellable
            ? t('selection.cannotSell')
            : confirming
              ? t('selection.sellConfirm', { refund })
              : t('selection.sell', { refund })}
        </button>
      </div>
    </section>
  );
}
