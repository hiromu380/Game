/**
 * パーツの小さなアイコン（ショップ・手持ち用）。見た目はアセットマニフェストに従う
 */
import type { PartId } from '@chain-factory/sim';
import { PART_ASSETS, toCssColor } from '../assets/manifest';

export function PartIcon({ partId }: { partId: PartId }) {
  const asset = PART_ASSETS[partId];
  if (asset.kind === 'image') return <img className="part-icon" src={asset.src} alt="" />;
  return (
    <span
      className={`part-icon part-icon--${asset.shape}`}
      style={{ backgroundColor: toCssColor(asset.color) }}
      aria-hidden
    >
      <span className="part-icon__glyph">{asset.glyph}</span>
    </span>
  );
}
