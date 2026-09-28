/**
 * 売却エリア: 盤面のパーツをここへドラッグすると売却する（確認なし）
 * ふだんは小さく案内だけ出し、ドラッグ中は返金額を出して目立たせる。売れないパーツ（スイッチ）はその旨を出す
 */
import { useI18n } from '../i18n';
import { UiIcon } from './UiIcon';

interface Props {
  /** パーツをドラッグ中か */
  dragging: boolean;
  /** ドラッグ中のパーツを売ったときの返金額（売れないパーツなら null） */
  refund: number | null;
}

export function SellZone({ dragging, refund }: Props) {
  const { t } = useI18n();
  const label = !dragging
    ? t('sellZone.idle')
    : refund === null
      ? t('sellZone.cannotSell')
      : t('sellZone.drop', { refund });
  return (
    <div
      className={`sell-zone ${dragging ? 'is-active' : ''} ${dragging && refund === null ? 'is-disabled' : ''}`}
      data-drop="sell"
    >
      <UiIcon name="sell" />
      <span>{label}</span>
    </div>
  );
}
