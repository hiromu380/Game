/**
 * 盤面で選択中のパーツの操作（回転・手持ちに戻す・売却）
 *
 * 売却は確認なしですぐ行う（「手持ちに戻す」とはボタンの並びと色で区別する）。
 * 盤面のパーツを売却エリア（ui/SellZone.tsx）へドラッグしても売却できる（App.tsx）。
 */
import { getCurrentRules, getPart, getRefund, type RunState } from '@chain-factory/sim';
import { useI18n } from '../i18n';
import type { Selection } from '../state/gameReducer';
import { describePart } from './partText';
import { PartIcon } from './PartIcon';
import { UiIcon } from './UiIcon';

interface Props {
  run: RunState;
  selection: Selection;
  /** 何も選んでいないときはパネルごと出さない（狭い画面で場所を空けるため） */
  hideWhenEmpty?: boolean;
  /**
   * 1行に詰めて出す（手持ち・ショップをタブで切り替える画面。下の一覧を画面の外へ押し出さないように）。
   * 効果の説明はマウスを載せると出る
   */
  compact?: boolean;
  disabled: boolean;
  onRotate: () => void;
  onReturn: () => void;
  onSell: () => void;
}

export function SelectionPanel({
  run,
  selection,
  hideWhenEmpty = false,
  compact = false,
  disabled,
  onRotate,
  onReturn,
  onSell,
}: Props) {
  const { t } = useI18n();
  const part = selection?.kind === 'cell' ? getPart(run.board, selection.x, selection.y) : null;

  if (!part) {
    if (hideWhenEmpty) return null;
    return (
      <section className="panel">
        <h2 className="panel__title">{t('selection.title')}</h2>
        <p className="panel__hint">{t('selection.none')}</p>
      </section>
    );
  }

  const refund = getRefund(run, part.id);
  const sellable = run.config.economy.prices[part.id] > 0;

  const description = describePart(t, part.id, getCurrentRules(run));

  if (compact) {
    return (
      <section className="panel selection--compact" aria-label={t('selection.title')}>
        <div className="selection__part" title={description}>
          <PartIcon partId={part.id} size={32} />
          <span className="selection__name">
            {t(`part.${part.id}.name`)}（{t(`dir.${part.dir}`)}）
          </span>
        </div>
        <div className="selection__actions">
          <button
            className="button--small"
            disabled={disabled}
            onClick={onRotate}
            title={t('selection.rotate')}
          >
            <UiIcon name="rotate" size={16} />
            {t('selection.rotateShort')}
          </button>
          <button
            className="button--small"
            disabled={disabled}
            onClick={onReturn}
            title={t('selection.returnToInventory')}
          >
            <UiIcon name="return" size={16} />
            {t('selection.returnShort')}
          </button>
          <button
            className="button--small button--ghost"
            disabled={disabled || !sellable}
            onClick={onSell}
          >
            {sellable && <UiIcon name="sell" size={16} />}
            {sellable ? t('selection.sellShort', { refund }) : t('selection.cannotSell')}
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="panel">
      <h2 className="panel__title">{t('selection.title')}</h2>
      <div className="selection__part">
        <PartIcon partId={part.id} />
        <div>
          <div className="selection__name">
            {t(`part.${part.id}.name`)}（{t(`dir.${part.dir}`)}）
          </div>
          <div className="panel__hint">{description}</div>
        </div>
      </div>
      <div className="button-row">
        <button disabled={disabled} onClick={onRotate}>
          <UiIcon name="rotate" />
          {t('selection.rotate')}
        </button>
        <button disabled={disabled} onClick={onReturn}>
          <UiIcon name="return" />
          {t('selection.returnToInventory')}
        </button>
      </div>
      <div className="button-row selection__danger">
        <button className="button--ghost" disabled={disabled || !sellable} onClick={onSell}>
          {sellable && <UiIcon name="sell" />}
          {sellable ? t('selection.sell', { refund }) : t('selection.cannotSell')}
        </button>
      </div>
    </section>
  );
}
