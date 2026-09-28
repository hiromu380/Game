/**
 * 体験版のデータを引き継ぐかの確認（製品版の初回起動時に1回だけ。state/demoImport.ts）
 */
import type { MetaProgress } from '@chain-factory/sim';
import { useI18n } from '../../i18n';
import { answerDemoImport } from '../../state/demoImport';

interface Props {
  meta: MetaProgress;
  onDone: () => void;
}

export function DemoImportDialog({ meta, onDone }: Props) {
  const { t } = useI18n();
  const answer = (importIt: boolean) => {
    answerDemoImport(importIt ? meta : null);
    onDone();
  };
  return (
    <div className="modal" role="dialog" aria-modal="true">
      <div className="modal__body panel">
        <h2 className="panel__title">{t('demoImport.title')}</h2>
        <p>{t('demoImport.body', { runs: meta.records.runsPlayed })}</p>
        <div className="button-row">
          <button className="button--primary" onClick={() => answer(true)}>
            {t('demoImport.yes')}
          </button>
          <button className="button--ghost" onClick={() => answer(false)}>
            {t('demoImport.no')}
          </button>
        </div>
      </div>
    </div>
  );
}
