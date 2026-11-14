import { useI18n } from '../i18n';
import { money } from '../format';
import { targetName, targetText, type TargetInfo } from '../targets';

/** 弟子の近い目標（「目標 5勝で三段目」）と、負け越すと落ちる段 */
export function TargetLine({
  info,
  sekitoriYen = null,
}: {
  info: TargetInfo | null;
  /** 十両に上がったら、部屋の口座が1場所あたりいくら変わるか（十両が目標のときだけ） */
  sekitoriYen?: number | null;
}) {
  const { t, lang } = useI18n();
  if (!info) return null;
  return (
    <span className="target">
      <span className="target__label">{t('target.label')}</span>
      <span className="target__text">{targetText(t, info.target)}</span>
      {sekitoriYen !== null && (
        <span className="target__yen">
          {t('target.sekitoriYen', {
            yen: (sekitoriYen >= 0 ? '+' : '−') + money(t, Math.abs(sekitoriYen), lang),
          })}
        </span>
      )}
      {info.danger && (
        <span className="tag tag--warn target__danger">
          {t('target.danger', { to: targetName(t, info.danger) })}
        </span>
      )}
    </span>
  );
}
