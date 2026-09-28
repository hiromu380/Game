/**
 * デスクトップ版の本人確認: Steam のチケットで登録・再ログインする（人間確認の代わり）
 *
 * 開いたら自動で1回試す。Steam が動いていない・Steam 側の障害のときは理由と「再試行」を出す。
 * 同じ Steam アカウントなら別の端末でも同じプレイヤーになる（進行中のデイリーも続きから遊べる）。
 */
import { useCallback, useEffect, useState } from 'react';
import { useI18n } from '../../i18n';
import { OnlineError, signInWithSteam, type OnlineErrorCode } from '../../online/api';
import type { OnlineIdentity } from '../../online/identity';

interface Props {
  onRegistered: (identity: OnlineIdentity) => void;
}

export function SteamSignIn({ onRegistered }: Props) {
  const { t } = useI18n();
  const [error, setError] = useState<OnlineErrorCode | null>(null);
  const [busy, setBusy] = useState(true);

  // 状態の更新は結果が返ってから（開いた直後の1回目は初期状態のまま待つ）
  const signIn = useCallback(() => {
    signInWithSteam()
      .then(onRegistered)
      .catch((e: unknown) => setError(e instanceof OnlineError ? e.code : 'network'))
      .finally(() => setBusy(false));
  }, [onRegistered]);

  useEffect(signIn, [signIn]);

  const retry = () => {
    setBusy(true);
    setError(null);
    signIn();
  };

  return (
    <div className="human-check">
      {busy && <p className="panel__hint">{t('online.steamSignIn')}</p>}
      {error && (
        <>
          <p className="panel__hint daily__error">{t(`error.online.${error}`)}</p>
          <button onClick={retry}>{t('online.retry')}</button>
        </>
      )}
    </div>
  );
}
