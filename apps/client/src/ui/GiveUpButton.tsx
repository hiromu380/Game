/**
 * 「諦める」ボタン（ランを途中でやめて結果画面へ）
 * 押し間違えないよう、1回目で確認の表示に変わり、もう一度押すと諦める
 */
import { useState } from 'react';
import { useI18n } from '../i18n';

export function GiveUpButton({ disabled, onGiveUp }: { disabled: boolean; onGiveUp: () => void }) {
  const { t } = useI18n();
  const [confirming, setConfirming] = useState(false);
  return (
    <button
      className={confirming ? 'button--danger' : 'button--ghost'}
      disabled={disabled}
      onClick={() => {
        if (!confirming) {
          setConfirming(true);
          return;
        }
        setConfirming(false);
        onGiveUp();
      }}
      onBlur={() => setConfirming(false)}
    >
      {confirming ? t('giveUp.confirm') : t('giveUp.button')}
    </button>
  );
}
