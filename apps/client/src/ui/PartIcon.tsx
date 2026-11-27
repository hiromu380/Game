/**
 * パーツの小さなアイコン（ショップ・手持ち用）。見た目はアセットマニフェストに従う
 */
import type { PartId } from '@chain-factory/sim';
import { PART_ASSETS } from '../assets/manifest';

export function PartIcon({
  partId,
  size = 40,
  golden = false,
}: {
  partId: PartId;
  size?: number;
  /** 金色パーツ（金の縁取り。名前にも「金色の」が付くので色だけには頼らない） */
  golden?: boolean;
}) {
  return (
    <img
      className={golden ? 'part-icon part-icon--golden' : 'part-icon'}
      src={PART_ASSETS[partId].src}
      width={size}
      height={size}
      alt=""
      draggable={false}
    />
  );
}
