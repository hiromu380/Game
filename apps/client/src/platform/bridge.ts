/**
 * デスクトップ版の preload が公開する API（window.chainFactory）を取り出す。Web 版では null
 */
import type { DesktopBridge } from '@chain-factory/shared';

declare global {
  interface Window {
    chainFactory?: DesktopBridge;
  }
}

export function getDesktopBridge(): DesktopBridge | null {
  return typeof window !== 'undefined' && window.chainFactory ? window.chainFactory : null;
}
