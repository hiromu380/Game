import { useEffect, useRef, useState } from 'react';
import { useI18n } from '../i18n';
import { useSettings } from '../settings';

/** 上の帯のメニュー: 言語・音・説明・やめる を1つにまとめる */
export function TopMenu({
  onToggleLang,
  onQuit,
}: {
  onToggleLang: () => void;
  onQuit: () => void;
}) {
  const { t } = useI18n();
  const { settings, update } = useSettings();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  // 外を押す・Esc で閉じる
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        root.current?.querySelector<HTMLElement>('.topmenu__toggle')?.focus();
      }
    };
    document.addEventListener('pointerdown', away);
    document.addEventListener('keydown', key);
    return () => {
      document.removeEventListener('pointerdown', away);
      document.removeEventListener('keydown', key);
    };
  }, [open]);
  const item = (label: string, onClick: () => void, pressed?: boolean) => (
    <button
      className="topmenu__item"
      role="menuitem"
      aria-pressed={pressed}
      onClick={() => {
        onClick();
        if (pressed === undefined) setOpen(false);
      }}
    >
      {label}
    </button>
  );
  return (
    <div className="topmenu" ref={root}>
      <button
        className="button button--ghost topmenu__toggle"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        {t('menu.open')}
      </button>
      {open && (
        <div className="topmenu__list" role="menu" aria-label={t('menu.open')}>
          {item(
            settings.sound ? t('sound.on') : t('sound.off'),
            () => update({ sound: !settings.sound }),
            settings.sound,
          )}
          {item(
            settings.help ? t('help.on') : t('help.off'),
            () => update({ help: !settings.help }),
            settings.help,
          )}
          {item(t('lang.toggle'), onToggleLang)}
          {item(t('top.quit'), onQuit)}
        </div>
      )}
    </div>
  );
}
