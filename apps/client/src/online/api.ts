/**
 * API クライアント（apps/server と通信する）
 *
 * - 接続先は同じオリジンの /api（開発時は Vite のプロキシで wrangler dev へ転送）。
 *   別の場所に置く場合はビルド時に VITE_API_BASE を指定する
 * - 失敗は OnlineError（サーバーのエラーコード or 'network'）として投げる
 */
import type {
  ApiError,
  ApiErrorCode,
  CommitRequest,
  CommitResponse,
  DailyInfo,
  DailySessionView,
  MarketResponse,
  RankingResponse,
  RegisterPlayerRequest,
  RegisterPlayerResponse,
  StartDailyResponse,
  UpdateNameResponse,
} from '@chain-factory/shared';
import { loadIdentity, saveIdentity, type OnlineIdentity } from './identity';

const API_BASE: string = import.meta.env.VITE_API_BASE ?? '';

export type OnlineErrorCode = ApiErrorCode | 'network';

export class OnlineError extends Error {
  constructor(readonly code: OnlineErrorCode) {
    super(code);
  }
}

async function request<T>(
  method: string,
  path: string,
  options: { body?: unknown; token?: string } = {},
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}/api${path}`, {
      method,
      headers: {
        ...(options.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
      },
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });
  } catch {
    throw new OnlineError('network');
  }
  const json = (await res.json().catch(() => null)) as unknown;
  if (!res.ok) {
    const code = (json as Partial<ApiError> | null)?.error;
    throw new OnlineError(code ?? 'network');
  }
  return json as T;
}

/**
 * 匿名登録して身元を保存する。人間確認（Turnstile）のトークンが必要
 * （大量の ID 生成で相場・ランキングを荒らされないように。ui/online/HumanCheck.tsx で取得する）
 */
export async function registerIdentity(turnstileToken: string): Promise<OnlineIdentity> {
  const body: RegisterPlayerRequest = { turnstileToken };
  const res = await request<RegisterPlayerResponse>('POST', '/players', { body });
  const identity: OnlineIdentity = {
    version: 1,
    playerId: res.playerId,
    token: res.token,
    displayName: res.displayName,
  };
  saveIdentity(identity);
  return identity;
}

/** 登録済みの身元。まだなら unauthorized（画面側で人間確認 → registerIdentity を促す） */
function requireIdentity(): OnlineIdentity {
  const identity = loadIdentity();
  if (!identity) throw new OnlineError('unauthorized');
  return identity;
}

export const api = {
  getToday: () => request<DailyInfo>('GET', '/daily/today'),

  getMarket: () => request<MarketResponse>('GET', '/market/latest'),

  start: async (dailyId: string) =>
    (
      await request<StartDailyResponse>('POST', `/daily/${dailyId}/start`, {
        token: requireIdentity().token,
      })
    ).session,

  /** 自分の進行状況。まだ始めていなければ null */
  getSession: async (dailyId: string): Promise<DailySessionView | null> => {
    const identity = loadIdentity();
    if (!identity) return null;
    try {
      return await request<DailySessionView>('GET', `/daily/${dailyId}/session`, {
        token: identity.token,
      });
    } catch (e) {
      if (e instanceof OnlineError && e.code === 'notFound') return null;
      throw e;
    }
  },

  commit: async (dailyId: string, body: CommitRequest) =>
    request<CommitResponse>('POST', `/daily/${dailyId}/commit`, {
      body,
      token: requireIdentity().token,
    }),

  getRanking: (dailyId: string) =>
    request<RankingResponse>('GET', `/daily/${dailyId}/ranking`, {
      token: loadIdentity()?.token,
    }),

  updateName: async (displayName: string) => {
    const identity = requireIdentity();
    const res = await request<UpdateNameResponse>('PUT', '/players/me/name', {
      body: { displayName },
      token: identity.token,
    });
    saveIdentity({ ...identity, displayName: res.displayName });
    return res.displayName;
  },
};
