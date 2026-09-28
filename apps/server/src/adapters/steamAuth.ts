/**
 * Steam の認証チケットの検証（ISteamUserAuth/AuthenticateUserTicket）
 *
 * Steam 固有の処理はここに閉じ込め、ドメインは ExternalAuthProvider だけを見る。
 * パブリッシャーキー（STEAM_WEB_API_KEY）は Workers の Secrets にだけ置く（クライアントには絶対に含めない）。
 *
 * 要確認（公式ドキュメントで確かめる。docs/ops/steam-setup.md）:
 * - パブリッシャーキーは partner.steam-api.com で使う（api.steampowered.com ではない）
 * - 応答の形 { response: { params: { result: 'OK', steamid, ownersteamid, vacbanned, publisherbanned } } }、
 *   失敗は { response: { error: { errorcode, errordesc } } }
 * - identity はクライアントが GetAuthTicketForWebApi に渡した文字列と一致させる
 */
import type { ExternalAuthProvider } from '../domain/players/externalAuth';

const AUTHENTICATE_URL = 'https://partner.steam-api.com/ISteamUserAuth/AuthenticateUserTicket/v1/';

export interface SteamAuthConfig {
  /** パブリッシャーキー。未設定なら Steam 認証は使えない（serviceUnavailable） */
  apiKey: string | null;
  /** 受け付ける App ID（製品版・体験版） */
  allowedAppIds: readonly number[];
  /** Web API チケットの identity（デスクトップ版の STEAM_TICKET_IDENTITY と同じ値） */
  identity: string;
}

interface AuthenticateResponse {
  response?: {
    params?: { result?: string; steamid?: string; publisherbanned?: boolean };
    error?: { errorcode?: number; errordesc?: string };
  };
}

export function steamTicketVerifier(
  config: SteamAuthConfig,
  fetchFn: typeof fetch = fetch,
): ExternalAuthProvider {
  return {
    async verify({ appId, ticket }) {
      if (!config.allowedAppIds.includes(appId)) return { ok: false, reason: 'appIdNotAllowed' };
      if (!config.apiKey) return { ok: false, reason: 'providerError' };
      const url = new URL(AUTHENTICATE_URL);
      url.searchParams.set('key', config.apiKey);
      url.searchParams.set('appid', String(appId));
      url.searchParams.set('ticket', ticket);
      url.searchParams.set('identity', config.identity);
      let json: AuthenticateResponse;
      try {
        const res = await fetchFn(url.toString());
        if (!res.ok) {
          // 5xx・429 は Steam 側の障害。401/403 はキーの誤り（設定の問題なのでログで気づけるようにする）
          console.warn(`[steam] AuthenticateUserTicket HTTP ${res.status}`);
          return { ok: false, reason: 'providerError' };
        }
        json = (await res.json()) as AuthenticateResponse;
      } catch {
        return { ok: false, reason: 'providerError' };
      }
      const params = json.response?.params;
      if (params?.result !== 'OK' || !params.steamid || !/^\d{1,20}$/.test(params.steamid)) {
        if (json.response?.error) {
          // キーは出さない。エラーの番号と説明だけをサーバーのログに残す
          console.warn(
            `[steam] AuthenticateUserTicket failed: ${json.response.error.errorcode} ${json.response.error.errordesc}`,
          );
        }
        return { ok: false, reason: 'invalidTicket' };
      }
      // パブリッシャーが BAN したアカウントはランキングに参加させない
      if (params.publisherbanned === true) return { ok: false, reason: 'invalidTicket' };
      return { ok: true, subject: params.steamid };
    },
  };
}

/** Steam 認証を使わない（テスト・Steam の設定がない環境） */
export const steamDisabled: ExternalAuthProvider = {
  verify: async () => ({ ok: false, reason: 'providerError' }),
};
