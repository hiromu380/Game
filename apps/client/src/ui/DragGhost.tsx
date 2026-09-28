/**
 * 置いたパーツをドラッグしている間、指・マウスについてくるパーツの絵
 * （盤面の外まで動かせるよう、盤面の描画とは別に画面の上に重ねる）
 */
import type { PartId } from '@chain-factory/sim';
import { useEffect, useState } from 'react';
import { PART_ASSETS } from '../assets/manifest';

const SIZE = 56;

/** 手持ちへ戻す落とし先か（手持ちの一覧・手持ちのタブ） */
export function isInventoryDropZone(el: Element | null): boolean {
  return !!el?.closest('[data-panel="inventory"], [data-drop="inventory"]');
}

export function DragGhost({ partId }: { partId: PartId }) {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const [overInventory, setOverInventory] = useState(false);
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      setPos({ x: e.clientX, y: e.clientY });
      setOverInventory(isInventoryDropZone(document.elementFromPoint(e.clientX, e.clientY)));
    };
    window.addEventListener('pointermove', onMove);
    return () => window.removeEventListener('pointermove', onMove);
  }, []);
  if (!pos) return null;
  return (
    <img
      className={`drag-ghost ${overInventory ? 'is-over-inventory' : ''}`}
      src={PART_ASSETS[partId].src}
      alt=""
      width={SIZE}
      height={SIZE}
      style={{ left: pos.x - SIZE / 2, top: pos.y - SIZE / 2 }}
    />
  );
}
