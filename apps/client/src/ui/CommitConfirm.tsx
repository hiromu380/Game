/**
 * 本番の確認（押し間違い防止）。本番の結果はやり直せないので、スイッチを押す前に一度確かめる
 *
 * 置き忘れ・試運転の結果などの注意があれば、記号と文字で添える（state/commitWarnings.ts）。
 * スイッチ・出荷口がないときは、うっかり押さないよう「やめる」を選んだ状態で開く。
 */
import { useI18n } from '../i18n';
import type { CommitWarning } from '../state/commitWarnings';
import { UiIcon } from './UiIcon';

interface Props {
  warnings: CommitWarning[];
  onConfirm: () => void;
  onCancel: () => void;
}

export function CommitConfirm({ warnings, onConfirm, onCancel }: Props) {
  const { t, formatScore } = useI18n();
  const missing = warnings.some((w) => w.kind === 'noSwitch' || w.kind === 'noDock');
  return (
    <div className="modal" role="dialog" aria-modal="true" onClick={onCancel}>
      <div className="modal__body panel commit-confirm" onClick={(e) => e.stopPropagation()}>
        <h2 className="panel__title">{t('commitConfirm.title')}</h2>
        <p className="panel__hint">{t('commitConfirm.body')}</p>
        {warnings.length > 0 && (
          <ul className="commit-confirm__warnings">
            {warnings.map((w) => (
              <li key={w.kind} className={`commit-confirm__warning is-${w.kind}`}>
                <span aria-hidden="true">⚠</span>
                {w.kind === 'short'
                  ? t('commitConfirm.warning.short', { amount: formatScore(w.amount.toString()) })
                  : t(`commitConfirm.warning.${w.kind}`)}
              </li>
            ))}
          </ul>
        )}
        <div className="button-row">
          <button className="button--ghost" onClick={onCancel} data-close autoFocus={missing}>
            {t('commitConfirm.cancel')}
          </button>
          <button className="button--primary" onClick={onConfirm} autoFocus={!missing}>
            <UiIcon name="commit-switch" size={22} />
            {t('commitConfirm.ok')}
          </button>
        </div>
      </div>
    </div>
  );
}
