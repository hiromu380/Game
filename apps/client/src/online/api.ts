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
  RankingResponse,
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

/** 身元がなければ登録して保存する */
export async function ensureIdentity(): Promise<OnlineIdentity> {
  const saved = loadIdentity();
  if (saved) return saved;
  const res = await request<RegisterPlayerResponse>('POST', '/players');
  const identity: OnlineIdentity = {
    version: 1,
    playerId: res.playerId,
    token: res.token,
    displayName: res.displayName,
  };
  saveIdentity(identity);
  return identity;
}

export const api = {
  getToday: () => request<DailyInfo>('GET', '/daily/today'),

  start: async (dailyId: string) =>
    (
      await request<StartDailyResponse>('POST', `/daily/${dailyId}/start`, {
        token: (await ensureIdentity()).token,
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
      token: (await ensureIdentity()).token,
    }),

  getRanking: (dailyId: string) =>
    request<RankingResponse>('GET', `/daily/${dailyId}/ranking`, {
      token: loadIdentity()?.token,
    }),

  updateName: async (displayName: string) => {
    const identity = await ensureIdentity();
    const res = await request<UpdateNameResponse>('PUT', '/players/me/name', {
      body: { displayName },
      token: identity.token,
    });
    saveIdentity({ ...identity, displayName: res.displayName });
    return res.displayName;
  },
};
