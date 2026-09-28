/**
 * 外部 ID プロバイダー（Steam など）でのログイン
 *
 * - ドメインは「プロバイダーで確認済みの外部 ID（subject）」だけを扱い、Steam の API は知らない（adapters/steamAuth.ts）
 * - 外部 ID は個人を特定しうるので、マスター秘密鍵つきの HMAC にしてから保存・検索する（CLAUDE.md「Steam 連携」）
 * - 初回はプレイヤーを作る。2回目以降は同じプレイヤーにトークンを発行し直す
 *   （トークンは1つだけなので、別の端末のトークンは使えなくなる。その端末は 401 → 再ログインで取り直す）
 */
import type { ExternalProvider } from '../../repositories/types';
import { hmacSha256, randomHex, sha256Hex, toHex } from '../crypto';
import { DomainError, type DomainContext } from '../context';
import { registerPlayer } from './players';

export type ExternalAuthResult =
  | { ok: true; subject: string }
  | { ok: false; reason: 'appIdNotAllowed' | 'invalidTicket' | 'providerError' };

/** 外部 ID プロバイダー（チケットを確かめて外部 ID を返す） */
export interface ExternalAuthProvider {
  verify(input: { appId: number; ticket: string }): Promise<ExternalAuthResult>;
}

const SECRET_BYTES = 24;

/** 失敗の理由 → API のエラー（詳しい理由はサーバーのログにだけ残す） */
const ERROR_OF = {
  appIdNotAllowed: 'forbidden',
  invalidTicket: 'unauthorized',
  providerError: 'serviceUnavailable',
} as const;

export async function hashSubject(
  masterSecret: string,
  provider: ExternalProvider,
  subject: string,
): Promise<string> {
  return toHex(await hmacSha256(masterSecret, `external:${provider}:${subject}`));
}

/** 本文の形を確かめる（App ID は正の整数、チケットは長さ上限つきの16進） */
export function parseTicketRequest(body: unknown): { appId: number; ticket: string } | null {
  if (typeof body !== 'object' || body === null) return null;
  const { appId, ticket } = body as Record<string, unknown>;
  if (!Number.isSafeInteger(appId) || (appId as number) <= 0) return null;
  if (typeof ticket !== 'string' || !/^[0-9a-fA-F]{2,8192}$/.test(ticket)) return null;
  return { appId: appId as number, ticket };
}

export async function signInWithExternal(
  ctx: DomainContext,
  provider: ExternalProvider,
  verifier: ExternalAuthProvider,
  body: unknown,
  ip: string | null,
): Promise<{ playerId: string; token: string; displayName: string }> {
  const request = parseTicketRequest(body);
  if (!request) throw new DomainError('badRequest');
  const result = await verifier.verify(request);
  if (!result.ok) {
    // 詳しい理由はサーバーのログにだけ残す（外部 ID・チケットは出さない）
    console.warn(`external sign-in failed provider=${provider} reason=${result.reason}`);
    throw new DomainError(ERROR_OF[result.reason], result.reason);
  }

  const subjectHash = await hashSubject(ctx.config.masterSecret, provider, result.subject);
  const existing = await reissueToken(ctx, provider, subjectHash);
  if (existing) return existing;

  // 初回: プレイヤーを作ってから外部 ID と結びつける。同時に初回ログインが2回来た場合は、
  // 先に結びついた方を使う（後の方が作ったプレイヤーは誰にも使われないまま残るだけで、害はない）
  const created = await registerPlayer(ctx, ip);
  const linked = await ctx.repos.externalAccounts.create({
    provider,
    subjectHash,
    playerId: created.playerId,
    createdAt: ctx.now(),
  });
  if (linked) return created;
  const winner = await reissueToken(ctx, provider, subjectHash);
  if (!winner) throw new Error('external account vanished during sign-in');
  return winner;
}

/** 結びついたプレイヤーがいれば、トークンを発行し直して返す */
async function reissueToken(
  ctx: DomainContext,
  provider: ExternalProvider,
  subjectHash: string,
): Promise<{ playerId: string; token: string; displayName: string } | null> {
  const playerId = await ctx.repos.externalAccounts.findPlayerId(provider, subjectHash);
  if (!playerId) return null;
  const player = await ctx.repos.players.findById(playerId);
  if (!player) return null;
  const secret = randomHex(SECRET_BYTES);
  await ctx.repos.players.updateTokenHash(playerId, await sha256Hex(secret));
  return { playerId, token: `${playerId}.${secret}`, displayName: player.displayName };
}
