/**
 * IP アドレスの扱い（CLAUDE.md「配信と運用」）
 *
 * - 生の IP は保存しない。登録時の IP を「マスター秘密鍵つきの HMAC」にして保存する
 *   （秘密値つきなので、IP の総当たりで元に戻すことはできない。同じ IP からの大量登録の調査にだけ使う）
 * - 保存期間（設定値）を過ぎたら定期ジョブで消す
 */
import { hmacSha256, toHex } from '../crypto';
import type { DomainContext } from '../context';

const DAY_MS = 24 * 60 * 60 * 1000;

export async function hashIp(masterSecret: string, ip: string): Promise<string> {
  return toHex(await hmacSha256(masterSecret, `ip:${ip}`));
}

/** ジョブ本体: 保存期間を過ぎた IP のハッシュを消す */
export async function runIpPurgeJob(ctx: DomainContext): Promise<{ purged: number }> {
  const before = ctx.now() - ctx.config.ipHashRetentionDays * DAY_MS;
  return { purged: await ctx.repos.players.clearIpHashesBefore(before) };
}
