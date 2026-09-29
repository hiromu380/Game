/**
 * スコア共有カード（結果画面から X へ投稿する画像）の設定
 *
 * - URL: 製品版は Steam ストア（VITE_STORE_URL）、体験版は Web 体験版（VITE_SITE_URL）。未設定なら今開いているオリジン
 * - 投稿の本文は i18n の share.*（#ChainFactory を含む）
 * - カードの色は palette.ts、画像は素材マニフェストから取る（share/card.ts・share/renderCard.ts）
 */
import { EDITION, EDITION_CONFIG } from './edition';

export const SHARE_CONFIG = {
  /** カードの大きさ（X 向けの横長と、正方形） */
  sizes: {
    landscape: { width: 1200, height: 675 },
    square: { width: 1080, height: 1080 },
  },
  /** 出荷量の文字の大きさ（桁が多いときは最小まで縮める） */
  scoreFont: { max: 132, min: 44 },
  /** 数字1文字の幅の目安（文字の大きさに対する比。枠に収めるための見積もり） */
  digitWidthRatio: 0.62,
} as const;

export type ShareCardSize = keyof typeof SHARE_CONFIG.sizes;

/** 今開いているサイトの URL（ビルド時の設定。なければ今開いているオリジン） */
export function siteUrl(): string {
  return import.meta.env.VITE_SITE_URL ?? window.location.origin;
}

/** カードと投稿に載せる URL（製品版は Steam ストア、体験版は Web 体験版） */
export function shareUrl(): string {
  if (EDITION === 'full' && EDITION_CONFIG.storeUrl) return EDITION_CONFIG.storeUrl;
  return siteUrl();
}
