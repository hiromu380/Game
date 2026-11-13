/**
 * 本番の確認（押し間違い防止）。本番の結果はやり直せないので、スイッチを押す前に一度確かめる
 *
 * このまま押すと失敗しそうなとき（スイッチ・出荷口がない、試運転していない、試運転がノルマ未満）は
 * 理由を出し、最初に選ばれているボタンを「やめる」にする（判定は state/commitCheck.ts）
 */
import { useI18n } from '../i18n';
import type { CommitWarning } from '../state/commitCheck';
import { UiIcon } from './UiIcon';

interface Props {
  warnings: CommitWarning[];
  onConfirm: () => void;
  onCancel: () => void;
}

export function CommitConfirm({ warnings, onConfirm, onCancel }: Props) {
  const { t, formatScore } = useI18n();
  const risky = warnings.length > 0;
  return (
    <div className="modal" role="dialog" aria-modal="true" onClick={onCancel}>
      <div className="modal__body panel commit-confirm" onClick={(e) => e.stopPropagation()}>
        <h2 className="panel__title">{t('commitConfirm.title')}</h2>
        {risky && (
          <ul className="commit-confirm__warnings" role="alert">
            {warnings.map((w) => (
              <li key={w.kind}>
                {w.kind === 'short'
                  ? t('commitConfirm.warn.short', {
                      score: formatScore(w.score),
                      quota: formatScore(String(w.quota)),
                    })
                  : t(`commitConfirm.warn.${w.kind}`)}
              </li>
            ))}
          </ul>
        )}
        <p className="panel__hint">{t('commitConfirm.body')}</p>
        <div className="button-row">
          <button className="button--ghost" onClick={onCancel} autoFocus={risky} data-close>
            {t('commitConfirm.cancel')}
          </button>
          <button className="button--primary" onClick={onConfirm} autoFocus={!risky}>
            <UiIcon name="commit-switch" size={22} />
            {t(risky ? 'commitConfirm.okAnyway' : 'commitConfirm.ok')}
          </button>
        </div>
      </div>
    </div>
  );
}
