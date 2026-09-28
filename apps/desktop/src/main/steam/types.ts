/**
 * Steam アダプターのインターフェース（自前の型）
 *
 * メインプロセスの他の部分はこの型だけを見る。steamworks-ffi-node を知っているのは steamworksAdapter.ts だけ
 * （ライブラリを差し替えるときはそこだけを書き直す）。
 * Steam が使えないとき（起動していない・初期化に失敗・SDK がない）は unavailableSteam を使い、ゲームはオフラインで遊べる。
 */
import type { ScreenRect, StatId } from '@chain-factory/shared';

/** 実績の ID の形（Steamworks に登録する API 名。例: ACH_FIRST_SHIP） */
export const ACHIEVEMENT_ID_PATTERN = /^ACH_[A-Z0-9_]{1,60}$/;

export interface SteamAdapter {
  readonly available: boolean;
  isSteamDeck(): boolean;
  /** サーバー認証用のチケット（16進文字列）。取得できなければ null */
  getWebApiTicket(identity: string): Promise<string | null>;
  unlockAchievement(id: string): Promise<boolean>;
  setStats(stats: Partial<Record<StatId, number>>): Promise<boolean>;
  /** オーバーレイでストアページを開く。オーバーレイが使えなければ false（呼び出し側がブラウザで開く） */
  openStoreOverlay(appId: number): boolean;
  /** 画面上キーボード（Steam Deck のみ）。出せたら true */
  showKeyboard(rect: ScreenRect): boolean;
  /** Steam のコールバックを処理する（定期的に呼ぶ。Web API チケットの受け取りなどに必要） */
  runCallbacks(): void;
  shutdown(): void;
}

/** Steam が使えないときの実装（すべて「何もしない」） */
export const unavailableSteam: SteamAdapter = {
  available: false,
  isSteamDeck: () => false,
  getWebApiTicket: async () => null,
  unlockAchievement: async () => false,
  setStats: async () => false,
  openStoreOverlay: () => false,
  showKeyboard: () => false,
  runCallbacks: () => {},
  shutdown: () => {},
};
