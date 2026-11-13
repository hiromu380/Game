import { useI18n } from '../i18n';
import { targetName, targetText, type TargetInfo } from '../targets';

/** 弟子の近い目標（「目標 5勝で三段目」）と、負け越すと落ちる段 */
export function TargetLine({ info }: { info: TargetInfo | null }) {
  const { t } = useI18n();
  if (!info) return null;
  return (
    <span className="target">
      <span className="target__label">{t('target.label')}</span>
      <span className="target__text">{targetText(t, info.target)}</span>
      {info.danger && (
        <span className="tag tag--warn target__danger">
          {t('target.danger', { to: targetName(t, info.danger) })}
        </span>
      )}
    </span>
  );
}
