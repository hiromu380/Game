/**
 * プラットフォームの違い（Web / デスクトップ）を吸収する窓口
 *
 * ゲーム本体は Steam を直接知らない。実績・認証チケット・ストアを開くなどは、このインターフェース経由で呼ぶ
 * （CLAUDE.md「デスクトップ版」）。Web 版は何もしない実装。
 */
import type { PlatformInfo, ScreenRect, StatId } from '@chain-factory/shared';
import { EDITION, EDITION_CONFIG } from '../config/edition';
import { getDesktopBridge } from './bridge';

export interface Platform {
  kind: 'web' | 'desktop';
  info(): Promise<PlatformInfo | null>;
  /** サーバー認証用のチケット。Web 版・Steam なしは null */
  authTicket(): Promise<string | null>;
  unlockAchievement(id: string): Promise<boolean>;
  setStats(stats: Partial<Record<StatId, number>>): Promise<boolean>;
  /** 製品版のストアページを開く */
  openStore(): Promise<void>;
  /** 外部 URL を開く（Web 版は新しいタブ、デスクトップ版は許可リストの URL だけ既定のブラウザで） */
  openExternal(url: string): Promise<void>;
  showKeyboard(rect: ScreenRect): Promise<boolean>;
}

const webPlatform: Platform = {
  kind: 'web',
  info: async () => null,
  authTicket: async () => null,
  unlockAchievement: async () => false,
  setStats: async () => false,
  openStore: async () => {
    if (EDITION_CONFIG.storeUrl) window.open(EDITION_CONFIG.storeUrl, '_blank', 'noopener');
  },
  openExternal: async (url) => {
    window.open(url, '_blank', 'noopener');
  },
  showKeyboard: async () => false,
};

function desktopPlatform(): Platform | null {
  const bridge = getDesktopBridge();
  if (!bridge) return null;
  return {
    kind: 'desktop',
    info: () => bridge.info(),
    authTicket: () => bridge.authTicket(),
    // 体験版では実績を送らない（CLAUDE.md。メインプロセス側でも拒否する）
    unlockAchievement: (id) =>
      EDITION === 'demo' ? Promise.resolve(false) : bridge.unlockAchievement(id),
    setStats: (stats) => (EDITION === 'demo' ? Promise.resolve(false) : bridge.setStats(stats)),
    openStore: () => bridge.openStore(),
    openExternal: (url) => bridge.openExternal(url),
    showKeyboard: (rect) => bridge.showKeyboard(rect),
  };
}

let cached: Platform | null = null;

export function getPlatform(): Platform {
  cached ??= desktopPlatform() ?? webPlatform;
  return cached;
}

/**
 * 文字入力欄にフォーカスしたとき、Steam Deck なら画面上キーボードを出す（それ以外では何もしない）。
 * 位置は入力欄の場所（ウィンドウ内のピクセル）。キーボードが入力欄を隠さない位置に出る
 */
export function requestOnScreenKeyboard(element: HTMLElement): void {
  const platform = getPlatform();
  if (platform.kind !== 'desktop') return;
  const rect = element.getBoundingClientRect();
  const scale = window.devicePixelRatio || 1;
  const px = (v: number) => Math.max(0, Math.round(v * scale));
  void platform.showKeyboard({
    x: px(rect.left),
    y: px(rect.top),
    width: px(rect.width),
    height: px(rect.height),
  });
}
