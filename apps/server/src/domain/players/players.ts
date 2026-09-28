/**
 * プレイヤー: 匿名登録・認証・表示名
 *
 * - 登録時に ID と秘密トークンを発行する。トークンは端末に保存してもらい、サーバーはハッシュだけ持つ
 * - 認証ヘッダー: `Authorization: Bearer <playerId>.<secret>`（ID で1行引いてハッシュを照合する）
 * - 表示名は登録時に自動でつける（NAME_RULES.defaultPrefix + ID の先頭4文字）。あとで変更できる
 */
import { NAME_RULES } from '../../config/names';
import { randomHex, sha256Hex, timingSafeEqual } from '../crypto';
import { DomainError, type DomainContext } from '../context';
import type { PlayerRecord } from '../../repositories/types';
import { hashIp } from './privacy';

const ID_BYTES = 12;
const SECRET_BYTES = 24;

/**
 * 匿名登録。人間確認（Turnstile）は呼び出し側（app.ts）で済ませてから呼ぶ
 * @param ip 送信元 IP（HMAC にして保存する。不明なら null）
 */
export async function registerPlayer(
  ctx: DomainContext,
  ip: string | null,
): Promise<{ playerId: string; token: string; displayName: string }> {
  const playerId = randomHex(ID_BYTES);
  const secret = randomHex(SECRET_BYTES);
  const displayName = `${NAME_RULES.defaultPrefix}${playerId.slice(0, 4)}`;
  await ctx.repos.players.create({
    id: playerId,
    tokenHash: await sha256Hex(secret),
    displayName,
    hidden: false,
    createdAt: ctx.now(),
    registeredIpHash: ip ? await hashIp(ctx.config.masterSecret, ip) : null,
  });
  return { playerId, token: `${playerId}.${secret}`, displayName };
}

/** Authorization ヘッダーからプレイヤーを特定する。失敗は unauthorized */
export async function authenticate(
  ctx: DomainContext,
  authorization: string | undefined,
): Promise<PlayerRecord> {
  const match = /^Bearer ([0-9a-f]+)\.([0-9a-f]+)$/.exec(authorization ?? '');
  if (!match) throw new DomainError('unauthorized');
  const player = await ctx.repos.players.findById(match[1]!);
  if (!player || !timingSafeEqual(player.tokenHash, await sha256Hex(match[2]!))) {
    throw new DomainError('unauthorized');
  }
  return player;
}

/** 表示名を正規化して検証する。不正なら null */
export function normalizeName(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  // 全角英数を半角に、互換文字を標準形にそろえ、前後と連続する空白を詰める
  const name = raw.normalize('NFKC').trim().replace(/\s+/g, ' ');
  if (name.length === 0 || [...name].length > NAME_RULES.maxLength) return null;
  if (!NAME_RULES.allowedPattern.test(name)) return null;
  const lower = name.toLowerCase();
  if (NAME_RULES.ngWords.some((ng) => lower.includes(ng))) return null;
  return name;
}

export async function updateName(
  ctx: DomainContext,
  player: PlayerRecord,
  raw: unknown,
): Promise<string> {
  const name = normalizeName(raw);
  if (name === null) throw new DomainError('invalidName');
  await ctx.repos.players.updateName(player.id, name);
  return name;
}
