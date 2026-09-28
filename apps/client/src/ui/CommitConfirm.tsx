/**
 * 本番の確認（押し間違い防止）。本番の結果はやり直せないので、スイッチを押す前に一度確かめる
 */
import { useI18n } from '../i18n';
import { UiIcon } from './UiIcon';

interface Props {
  onConfirm: () => void;
  onCancel: () => void;
}

export function CommitConfirm({ onConfirm, onCancel }: Props) {
  const { t } = useI18n();
  return (
    <div className="modal" role="dialog" aria-modal="true" onClick={onCancel}>
      <div className="modal__body panel commit-confirm" onClick={(e) => e.stopPropagation()}>
        <h2 className="panel__title">{t('commitConfirm.title')}</h2>
        <p className="panel__hint">{t('commitConfirm.body')}</p>
        <div className="button-row">
          <button className="button--ghost" onClick={onCancel} data-close>
            {t('commitConfirm.cancel')}
          </button>
          <button className="button--primary" onClick={onConfirm} autoFocus>
            <UiIcon name="commit-switch" size={22} />
            {t('commitConfirm.ok')}
          </button>
        </div>
      </div>
    </div>
  );
}
