/**
 * steamworks-ffi-node を使った Steam アダプター（メインプロセスでのみ初期化する）
 *
 * - SDK の redistributable（steam_api64.dll など）はライセンス上リポジトリに入れない。人が Steamworks SDK から
 *   `apps/desktop/steamworks_sdk/redistributable_bin/` に置く（docs/ops/steam-sdk.md）
 * - ライブラリ・SDK・Steam クライアントのどれかが無ければ unavailableSteam を返す（ゲームは起動して遊べる）
 * - 実機での確認は人が行う（docs/ops/steam-testing.md）。ここでの呼び出し方は型定義（0.11.3）から書いている
 */
import type { StatId } from '@chain-factory/shared';
import { unavailableSteam, type SteamAdapter } from './types';

/** ライブラリの型（使う部分だけ。import すると Steam のない環境で読み込みに失敗するため require で読む） */
interface SteamworksSdk {
  setSdkPath(path: string): void;
  restartAppIfNecessary(appId: number): boolean;
  init(options: { appId: number }): boolean;
  runCallbacks(): void;
  shutdown(): void;
  achievements: { unlockAchievement(name: string): Promise<boolean> };
  stats: { setStatInt(name: string, value: number): Promise<boolean> };
  user: {
    getAuthTicketForWebApi(identity?: { genericString?: string }): Promise<{
      success: boolean;
      ticketHex: string;
    }>;
  };
  utils: {
    isSteamRunningOnSteamDeck(): boolean;
    isOverlayEnabled(): boolean;
    showFloatingGamepadTextInput(mode: number, x: number, y: number, w: number, h: number): boolean;
  };
  overlay: { activateGameOverlayToStore(appId: number, flag?: number): void };
}

/** 画面上キーボードの種類: 1行入力（EFloatingGamepadTextInputMode.SingleLine） */
const KEYBOARD_SINGLE_LINE = 0;

export type SteamStartResult =
  | { kind: 'ready'; steam: SteamAdapter }
  /** Steam 経由で起動し直すので、このプロセスはすぐ終了する */
  | { kind: 'restarting' }
  | { kind: 'unavailable'; reason: string; steam: SteamAdapter };

export function startSteam(options: {
  appId: number;
  sdkPath: string;
  restartThroughSteam: boolean;
  loadLibrary?: () => { getInstance(): SteamworksSdk };
}): SteamStartResult {
  let sdk: SteamworksSdk;
  try {
    const lib = options.loadLibrary
      ? options.loadLibrary()
      : // eslint-disable-next-line @typescript-eslint/no-require-imports -- Steam がない環境でも起動できるよう、使うときに読み込む
        (require('steamworks-ffi-node') as { default: { getInstance(): SteamworksSdk } }).default;
    sdk = lib.getInstance();
    sdk.setSdkPath(options.sdkPath);
    if (options.restartThroughSteam && sdk.restartAppIfNecessary(options.appId)) {
      return { kind: 'restarting' };
    }
    if (!sdk.init({ appId: options.appId })) {
      return { kind: 'unavailable', reason: 'init failed', steam: unavailableSteam };
    }
  } catch (error) {
    return { kind: 'unavailable', reason: String(error), steam: unavailableSteam };
  }
  return { kind: 'ready', steam: wrap(sdk) };
}

const STAT_NAMES: Record<StatId, string> = {
  STAT_RUNS: 'STAT_RUNS',
  STAT_FULL_CLEARS: 'STAT_FULL_CLEARS',
  STAT_DAILY_DAYS: 'STAT_DAILY_DAYS',
};

function wrap(sdk: SteamworksSdk): SteamAdapter {
  const safe = async <T>(fn: () => Promise<T>, fallback: T): Promise<T> => {
    try {
      return await fn();
    } catch {
      return fallback;
    }
  };
  return {
    available: true,
    isSteamDeck: () => {
      try {
        return sdk.utils.isSteamRunningOnSteamDeck();
      } catch {
        return false;
      }
    },
    getWebApiTicket: (identity) =>
      safe(async () => {
        // 要確認: genericString がそのまま GetAuthTicketForWebApi の identity として渡るか（docs/ops/steam-testing.md）
        const result = await sdk.user.getAuthTicketForWebApi({ genericString: identity });
        return result.success && /^[0-9a-fA-F]+$/.test(result.ticketHex) ? result.ticketHex : null;
      }, null),
    unlockAchievement: (id) => safe(() => sdk.achievements.unlockAchievement(id), false),
    setStats: (stats) =>
      safe(async () => {
        let ok = true;
        for (const [id, value] of Object.entries(stats) as [StatId, number][]) {
          ok = (await sdk.stats.setStatInt(STAT_NAMES[id], value)) && ok;
        }
        return ok;
      }, false),
    openStoreOverlay: (appId) => {
      try {
        if (!sdk.utils.isOverlayEnabled()) return false;
        sdk.overlay.activateGameOverlayToStore(appId, 0);
        return true;
      } catch {
        return false;
      }
    },
    showKeyboard: (rect) => {
      try {
        if (!sdk.utils.isSteamRunningOnSteamDeck()) return false;
        return sdk.utils.showFloatingGamepadTextInput(
          KEYBOARD_SINGLE_LINE,
          rect.x,
          rect.y,
          rect.width,
          rect.height,
        );
      } catch {
        return false;
      }
    },
    runCallbacks: () => {
      try {
        sdk.runCallbacks();
      } catch {
        // コールバックの失敗でゲームは止めない
      }
    },
    shutdown: () => {
      try {
        sdk.shutdown();
      } catch {
        // 終了時の失敗は無視する
      }
    },
  };
}
