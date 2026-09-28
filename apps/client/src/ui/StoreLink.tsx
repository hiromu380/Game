/**
 * 製品版（Steam）への誘導。体験版のラン終了時など、遊びの邪魔にならない場所にだけ出す
 */
import { EDITION_CONFIG } from '../config/edition';
import { useI18n } from '../i18n';

export function StoreLink() {
  const { t } = useI18n();
  if (!EDITION_CONFIG.showStoreLink) return null;
  return (
    <div className="store-link">
      <p className="store-link__lead">{t('store.lead')}</p>
      {EDITION_CONFIG.storeUrl ? (
        <a
          className="button button--primary"
          href={EDITION_CONFIG.storeUrl}
          target="_blank"
          rel="noopener noreferrer"
        >
          {t('store.open')}
        </a>
      ) : (
        <p className="panel__hint">{t('store.comingSoon')}</p>
      )}
    </div>
  );
}
