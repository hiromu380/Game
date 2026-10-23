/**
 * 売却エリア: 盤面のパーツをここへドラッグすると売却する（確認なし）
 * パーツをドラッグしている間だけ出し、返金額を出す（ふだんは出さない: 一覧の最後の行を隠さないように）。
 * 売れないパーツ（スイッチ）はその旨を出す
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
  if (!dragging) return null;
  const label = refund === null ? t('sellZone.cannotSell') : t('sellZone.drop', { refund });
  return (
    <div className={`sell-zone is-active ${refund === null ? 'is-disabled' : ''}`} data-drop="sell">
      <UiIcon name="sell" />
      <span>{label}</span>
    </div>
  );
}
