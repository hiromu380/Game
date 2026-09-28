/**
 * 設定画面（モーダル）: 言語・演出の強さ・画面の揺れ・音量
 */
import type { EffectStrength } from '../config/effects';
import { useI18n, type Lang } from '../i18n';
import { useSettings } from './SettingsContext';

const STRENGTHS: EffectStrength[] = ['full', 'reduced', 'minimal'];
const LANGS: Lang[] = ['ja', 'en'];
const VOLUMES = ['masterVolume', 'seVolume', 'bgmVolume'] as const;

export function SettingsPanel({ onClose }: { onClose: () => void }) {
  const { t } = useI18n();
  const { settings, updateSettings } = useSettings();

  return (
    <div className="modal" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="modal__body panel" onClick={(e) => e.stopPropagation()}>
        <h2 className="panel__title">{t('settings.title')}</h2>

        <div className="settings__row">
          <span>{t('settings.language')}</span>
          <div className="segmented">
            {LANGS.map((lang) => (
              <button
                key={lang}
                className={settings.lang === lang ? 'is-active' : ''}
                onClick={() => updateSettings({ lang })}
              >
                {t(`settings.lang.${lang}`)}
              </button>
            ))}
          </div>
        </div>

        <div className="settings__row">
          <span>{t('settings.effects')}</span>
          <div className="segmented">
            {STRENGTHS.map((strength) => (
              <button
                key={strength}
                className={settings.effects === strength ? 'is-active' : ''}
                onClick={() => updateSettings({ effects: strength })}
              >
                {t(`settings.effects.${strength}`)}
              </button>
            ))}
          </div>
        </div>

        <label className="settings__row">
          <span>{t('settings.shake')}</span>
          <input
            type="checkbox"
            checked={settings.shake}
            onChange={(e) => updateSettings({ shake: e.target.checked })}
          />
        </label>
        <p className="panel__hint">{t('settings.shakeHint')}</p>

        {VOLUMES.map((key) => (
          <label key={key} className="settings__row">
            <span>{t(`settings.${key}`)}</span>
            <input
              type="range"
              min={0}
              max={100}
              value={settings[key]}
              disabled={settings.muted}
              onChange={(e) => updateSettings({ [key]: Number(e.target.value) })}
            />
          </label>
        ))}
        <label className="settings__row">
          <span>{t('settings.muted')}</span>
          <input
            type="checkbox"
            checked={settings.muted}
            onChange={(e) => updateSettings({ muted: e.target.checked })}
          />
        </label>
        <p className="panel__hint">{t('settings.bgmHint')}</p>

        <div className="settings__row">
          <span>{t('settings.tutorial')}</span>
          <button
            className="button--small"
            disabled={!settings.tutorialDone}
            onClick={() => updateSettings({ tutorialDone: false })}
          >
            {t('settings.tutorialAgain')}
          </button>
        </div>
        {!settings.tutorialDone && <p className="panel__hint">{t('settings.tutorialPending')}</p>}

        <div className="button-row">
          <button className="button--primary" onClick={onClose} data-close>
            {t('settings.close')}
          </button>
        </div>
      </div>
    </div>
  );
}
