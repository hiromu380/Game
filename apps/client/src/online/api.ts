/**
 * API クライアント（apps/server と通信する）
 *
 * - 接続先は同じオリジンの /api（開発時は Vite のプロキシで wrangler dev へ転送）。
 *   別の場所に置く場合はビルド時に VITE_API_BASE を指定する
 * - 失敗は OnlineError（サーバーのエラーコード or 'network' / 'steamUnavailable'）として投げる
 * - 身元: Web 版は人間確認つきの匿名登録、デスクトップ版は Steam のチケットでの登録・再ログイン
 *   （デスクトップ版は 401 のとき Steam で取り直して1回だけやり直す。トークンが別の端末で発行し直された場合など）
 */
import type {
  ApiError,
  ApiErrorCode,
  CommitRequest,
  CommitResponse,
  MarketResponse,
  ProvisionalRankingResponse,
  RegisterPlayerRequest,
  RegisterPlayerResponse,
  ReplayResponse,
  StartAttemptResponse,
  SteamAuthRequest,
  UpdateNameResponse,
  WeeklyAttemptView,
  WeeklyInfo,
  WeeklyLatestResponse,
  WeeklyResultsResponse,
} from '@chain-factory/shared';
import { getPlatform } from '../platform';
import { loadIdentity, saveIdentity, type OnlineIdentity } from './identity';

const API_BASE: string = import.meta.env.VITE_API_BASE ?? '';

/** steamUnavailable: デスクトップ版で Steam が動いていない（チケットが取れない） */
export type OnlineErrorCode = ApiErrorCode | 'network' | 'steamUnavailable';

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
  return storeIdentity(await request<RegisterPlayerResponse>('POST', '/players', { body }));
}

function storeIdentity(res: RegisterPlayerResponse): OnlineIdentity {
  const identity: OnlineIdentity = {
    version: 1,
    playerId: res.playerId,
    token: res.token,
    displayName: res.displayName,
  };
  saveIdentity(identity);
  return identity;
}

/** Steam で本人確認できるか（デスクトップ版で Steam が動いている） */
export async function canUseSteamAuth(): Promise<boolean> {
  const info = await getPlatform().info();
  return info?.steam === 'ready';
}

/** Steam のチケットで登録・再ログインして身元を保存する（同じ Steam アカウントなら同じプレイヤー） */
export async function signInWithSteam(): Promise<OnlineIdentity> {
  const platform = getPlatform();
  const info = await platform.info();
  const ticket = info?.steam === 'ready' ? await platform.authTicket() : null;
  if (!info || !ticket) throw new OnlineError('steamUnavailable');
  const body: SteamAuthRequest = { appId: info.appId, ticket };
  return storeIdentity(await request<RegisterPlayerResponse>('POST', '/auth/steam', { body }));
}

/**
 * 認証が必要な呼び出し。身元がなければ unauthorized（Web 版は画面側で人間確認 → registerIdentity を促す）。
 * Steam が使えるときは、身元がない・401 のときに Steam で取り直して1回だけやり直す
 */
async function withAuth<T>(call: (identity: OnlineIdentity) => Promise<T>): Promise<T> {
  const identity = loadIdentity() ?? ((await canUseSteamAuth()) ? await signInWithSteam() : null);
  if (!identity) throw new OnlineError('unauthorized');
  try {
    return await call(identity);
  } catch (e) {
    if (!(e instanceof OnlineError && e.code === 'unauthorized') || !(await canUseSteamAuth())) {
      throw e;
    }
    return call(await signInWithSteam());
  }
}

/** ログインしていればトークンを付ける（なくても読める API 用） */
const optionalToken = () => ({ token: loadIdentity()?.token });

export const api = {
  /** 今週の情報（ログインしていれば自分の状況つき） */
  getCurrentWeek: () => request<WeeklyInfo>('GET', '/weekly/current', optionalToken()),

  getMarket: () => request<MarketResponse>('GET', '/market/latest'),

  /** 今日の挑戦を始める（1日1回） */
  start: async (weekId: string) =>
    (
      await withAuth(({ token }) =>
        request<StartAttemptResponse>('POST', `/weekly/${weekId}/attempts`, { token }),
      )
    ).attempt,

  /** その日の自分の挑戦。まだ始めていなければ null */
  getAttempt: async (weekId: string, dayId: string): Promise<WeeklyAttemptView | null> => {
    if (!loadIdentity()) return null;
    try {
      return await withAuth(({ token }) =>
        request<WeeklyAttemptView>('GET', `/weekly/${weekId}/attempts/${dayId}`, { token }),
      );
    } catch (e) {
      if (e instanceof OnlineError && e.code === 'notFound') return null;
      throw e;
    }
  },

  commit: async (weekId: string, dayId: string, body: CommitRequest) =>
    withAuth(({ token }) =>
      request<CommitResponse>('POST', `/weekly/${weekId}/attempts/${dayId}/commit`, {
        body,
        token,
      }),
    ),

  /** 当週の暫定ランキング */
  getProvisional: (weekId: string) =>
    request<ProvisionalRankingResponse>('GET', `/weekly/${weekId}/provisional`, optionalToken()),

  /** 確定した結果発表（締め切り後の週） */
  getResults: (weekId: string) =>
    request<WeeklyResultsResponse>('GET', `/weekly/${weekId}/results`, optionalToken()),

  getReplay: (weekId: string, rank: number) =>
    request<ReplayResponse>('GET', `/weekly/${weekId}/results/${rank}/replay`),

  /** 結果が確定した週の一覧（新しい順） */
  getLatest: () => request<WeeklyLatestResponse>('GET', '/weekly/latest'),

  updateName: async (displayName: string) => {
    const res = await withAuth(({ token }) =>
      request<UpdateNameResponse>('PUT', '/players/me/name', { body: { displayName }, token }),
    );
    // 再ログインで身元が変わっている場合があるので、保存済みの最新を読み直してから名前を書き換える
    const identity = loadIdentity();
    if (identity) saveIdentity({ ...identity, displayName: res.displayName });
    return res.displayName;
  },
};
