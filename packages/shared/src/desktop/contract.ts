/**
 * デスクトップ版（Electron）のメインプロセスとゲーム本体（レンダラー）の間の取り決め
 *
 * - レンダラーは Node も Steam も直接使えない（sandbox）。preload が `window.chainFactory` に
 *   この DesktopBridge だけを公開し、中身はすべて IPC（ipcRenderer.invoke）でメインプロセスへ送る
 * - チャンネル名・引数・戻り値はここで固定し、メインプロセス側で必ず引数を検証する（apps/desktop/src/main/ipc）
 * - Steam の用語はここに出さない（ゲーム本体はプラットフォームの違いを知らなくてよいように）。
 *   例外は認証チケットのように Steam 以外に対応しようがないものだけ
 */

/** IPC のチャンネル名 */
export const IPC_CHANNELS = {
  storageReadAll: 'storage:readAll',
  storageWrite: 'storage:write',
  platformInfo: 'platform:info',
  authTicket: 'platform:authTicket',
  unlockAchievement: 'platform:unlockAchievement',
  setStats: 'platform:setStats',
  openStore: 'platform:openStore',
  showKeyboard: 'platform:showKeyboard',
  openExternal: 'platform:openExternal',
  readDemoSave: 'storage:readDemoSave',
} as const;

/**
 * 保存できるキー（Web 版の localStorage のキーと同じ名前）。
 * デスクトップ版はキーごとに別の JSON ファイルへ保存する。cloud: true のものが Steam Auto-Cloud の対象
 */
export const STORAGE_ENTRIES = {
  'chain-factory:save': { file: 'save.json', cloud: true },
  'chain-factory:settings': { file: 'settings.json', cloud: true },
  // 認証トークンは端末ごと。Steam 版は起動時に取り直せるので同期しない
  'chain-factory:online': { file: 'identity.json', cloud: false },
} as const;

export type StorageKey = keyof typeof STORAGE_ENTRIES;

export function isStorageKey(value: unknown): value is StorageKey {
  return typeof value === 'string' && Object.hasOwn(STORAGE_ENTRIES, value);
}

/** 1つの値の最大サイズ（文字数）。セーブは数十 KB 程度なので十分に余裕がある */
export const STORAGE_MAX_VALUE_LENGTH = 1_000_000;

/** Steam 統計（回数系だけ。CLAUDE.md「Steam 連携」） */
export const STAT_IDS = ['STAT_RUNS', 'STAT_FULL_CLEARS', 'STAT_DAILY_DAYS'] as const;
export type StatId = (typeof STAT_IDS)[number];

export interface PlatformInfo {
  /** 製品版か体験版か（メインプロセスの設定。レンダラーのビルド設定と一致するはず） */
  edition: 'full' | 'demo';
  /** Steam が使えるか（起動していない・初期化に失敗したときは unavailable） */
  steam: 'ready' | 'unavailable';
  isSteamDeck: boolean;
  /** Steam の App ID（Steam が使えないときも設定値を返す。サーバーへの認証に使う） */
  appId: number;
}

/** 画面上の矩形（画面上キーボードの表示位置の指定に使う。整数） */
export interface ScreenRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** preload が `window.chainFactory` に公開する API */
export interface DesktopBridge {
  readAll(): Promise<Partial<Record<StorageKey, string>>>;
  write(key: StorageKey, value: string): Promise<void>;
  info(): Promise<PlatformInfo>;
  /** サーバー認証用のチケット（16進文字列）。Steam が使えなければ null */
  authTicket(): Promise<string | null>;
  /** 実績を解除する。送れたら true（体験版・Steam なしでは false） */
  unlockAchievement(id: string): Promise<boolean>;
  setStats(stats: Partial<Record<StatId, number>>): Promise<boolean>;
  /** 製品版のストアページを開く（オーバーレイ、使えなければ既定のブラウザ） */
  openStore(): Promise<void>;
  /** 画面上キーボードを出す（Steam Deck のときだけ）。出せたら true */
  showKeyboard(rect: ScreenRect): Promise<boolean>;
  /** 許可リストにある外部 URL を既定のブラウザで開く */
  openExternal(url: string): Promise<void>;
  /**
   * 同じ PC にある体験版のセーブ（save.json の中身）。製品版だけが読める。なければ null
   * （製品版の初回起動時に、体験版のデータを引き継ぐかを聞くため）
   */
  readDemoSave(): Promise<string | null>;
}
