/**
 * 人間確認（Turnstile）のウィジェット。通ったら匿名登録して onRegistered を呼ぶ
 *
 * デイリーに初めて参加するときだけ表示する（ランキングの閲覧・練習には不要）。
 */
import { useEffect, useRef, useState } from 'react';
import { useI18n } from '../../i18n';
import { OnlineError, registerIdentity } from '../../online/api';
import type { OnlineIdentity } from '../../online/identity';
import {
  loadTurnstile,
  TURNSTILE_DUMMY_TOKEN,
  TURNSTILE_SITE_KEY,
  TURNSTILE_TEST_SITE_KEY,
} from '../../online/turnstile';

interface Props {
  onRegistered: (identity: OnlineIdentity) => void;
}

export function HumanCheck({ onRegistered }: Props) {
  const { t, lang } = useI18n();
  const containerRef = useRef<HTMLDivElement>(null);
  const [message, setMessage] = useState<string | null>(null);
  // 最新のコールバックを ref で持つ（ウィジェットは一度だけ描く）
  const onRegisteredRef = useRef(onRegistered);
  useEffect(() => {
    onRegisteredRef.current = onRegistered;
  });

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !TURNSTILE_SITE_KEY) return;
    let widgetId: string | null = null;
    let cancelled = false;
    const register = (token: string) =>
      registerIdentity(token)
        .then((identity) => !cancelled && onRegisteredRef.current(identity))
        .catch((e: unknown) =>
          setMessage(t(`error.online.${e instanceof OnlineError ? e.code : 'network'}`)),
        );

    // 開発用のテストキー: ウィジェットを出さずにダミートークンで登録する
    if (TURNSTILE_SITE_KEY === TURNSTILE_TEST_SITE_KEY) {
      void register(TURNSTILE_DUMMY_TOKEN);
      return () => {
        cancelled = true;
      };
    }

    loadTurnstile()
      .then((turnstile) => {
        if (cancelled) return;
        widgetId = turnstile.render(container, {
          sitekey: TURNSTILE_SITE_KEY,
          theme: 'dark',
          language: lang,
          callback: (token) => void register(token),
          'error-callback': () => setMessage(t('error.online.humanCheckFailed')),
        });
      })
      .catch(() => setMessage(t('error.online.network')));

    return () => {
      cancelled = true;
      if (widgetId) window.turnstile?.remove(widgetId);
    };
  }, [lang, t]);

  return (
    <div className="human-check">
      <p className="panel__hint">{t('online.humanCheck')}</p>
      {TURNSTILE_SITE_KEY ? (
        <div ref={containerRef} />
      ) : (
        <p className="panel__hint daily__error">{t('online.notConfigured')}</p>
      )}
      {message && <p className="panel__hint daily__error">{message}</p>}
    </div>
  );
}
