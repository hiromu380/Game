import { useI18n } from '../i18n';

/** 見せ場をまとめて飛ばして、場所の結果へ（Esc でも押せる。桜井氏の「演出は必ずスキップできる」） */
export function SkipButton({ onSkip }: { onSkip: () => void }) {
  const { t } = useI18n();
  return (
    <button className="button" data-dismiss onClick={onSkip}>
      {t('highlight.skipAll')}
    </button>
  );
}
