/**
 * 製品版（Steam）への誘導。体験版のラン終了時など、遊びの邪魔にならない場所にだけ出す
 *
 * - デスクトップ版（Steam 体験版）: Steam のオーバーレイで製品版のストアページを開く（使えなければ既定のブラウザ）
 * - Web 版: ストアページのリンク。ストアの URL が未設定なら「近日発売」だけ出す
 */
import { EDITION_CONFIG } from '../config/edition';
import { useI18n } from '../i18n';
import { getPlatform } from '../platform';

export function StoreLink() {
  const { t } = useI18n();
  if (!EDITION_CONFIG.showStoreLink) return null;
  const desktop = getPlatform().kind === 'desktop';
  return (
    <div className="store-link">
      <p className="store-link__lead">{t('store.lead')}</p>
      {desktop ? (
        <button className="button--primary" onClick={() => void getPlatform().openStore()}>
          {t('store.open')}
        </button>
      ) : EDITION_CONFIG.storeUrl ? (
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
