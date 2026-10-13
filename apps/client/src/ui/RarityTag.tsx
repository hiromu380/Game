/**
 * レア度の札（記号つきの文字で示し、色だけに頼らない）。ショップ・レリックの候補・図鑑・コレクションで共通
 */
import { BALANCE, type Rarity, type RelicId, type RunState } from '@chain-factory/sim';
import { useI18n } from '../i18n';

export function RarityTag({ rarity }: { rarity: Rarity }) {
  const { t } = useI18n();
  return <span className={`rarity-tag rarity-tag--${rarity}`}>{t(`rarity.${rarity}`)}</span>;
}

/** レリックのレア度（ランの設定に無い = レア度を導入する前のランは、balance/ の値） */
export function relicRarity(run: RunState | null, id: RelicId): Rarity {
  return run?.config.relics?.rarity?.[id] ?? BALANCE.relics.rarity?.[id] ?? 'common';
}
