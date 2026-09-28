/**
 * パーツの小さなアイコン（ショップ・手持ち用）。見た目はアセットマニフェストに従う
 */
import type { PartId } from '@chain-factory/sim';
import { PART_ASSETS } from '../assets/manifest';

export function PartIcon({ partId, size = 40 }: { partId: PartId; size?: number }) {
  return (
    <img
      className="part-icon"
      src={PART_ASSETS[partId].src}
      width={size}
      height={size}
      alt=""
      draggable={false}
    />
  );
}
