/**
 * 週替わりチャレンジの秘密値と本番シード（CLAUDE.md「シード」）
 *
 * - weekSecret = HMAC(マスター秘密鍵, 'weekly:' + weekId)
 *   週ごとに別の値になるので、締め切り後にその週の分だけ公開しても、他の週は予測できない
 * - 本番シード = HMAC(weekSecret, 'shift:' + shiftIndex) の先頭4バイト（32bit 整数）
 *   その週のあいだ同じ（1週間、同じ盤面・同じ乱数を攻略する）。シフトごとに別の値なので、
 *   確定したシフトのシードを返しても、その挑戦の先のシフトは予測できない
 * - seedCommitment = SHA-256(weekSecret)。週の開始時に公開し、締め切り後に weekSecret と照合できる
 *
 * マスター秘密鍵は公開しない。DB にも秘密値は保存せず、必要なときに毎回導き出す。
 */
import { fromHex, hmacSha256, sha256Hex, toHex } from '../crypto';

/** その週の秘密値（16進） */
export async function deriveWeekSecret(masterSecret: string, weekId: string): Promise<string> {
  return toHex(await hmacSha256(masterSecret, `weekly:${weekId}`));
}

/** 本番シード（シフトごと） */
export async function deriveCommitSeed(weekSecretHex: string, shiftIndex: number): Promise<number> {
  const bytes = await hmacSha256(fromHex(weekSecretHex), `shift:${shiftIndex}`);
  // 先頭4バイトを符号なし32bit整数として読む（シミュレーションの PRNG は32bit シード）
  return ((bytes[0]! << 24) | (bytes[1]! << 16) | (bytes[2]! << 8) | bytes[3]!) >>> 0;
}

/** 本番シードを count シフト分まとめて導く */
export async function commitSeedsFor(
  masterSecret: string,
  weekId: string,
  count: number,
): Promise<number[]> {
  const secret = await deriveWeekSecret(masterSecret, weekId);
  const seeds: number[] = [];
  for (let i = 0; i < count; i++) seeds.push(await deriveCommitSeed(secret, i));
  return seeds;
}

/** 開始時に公開する、秘密値のハッシュ */
export function commitmentOf(weekSecretHex: string): Promise<string> {
  return sha256Hex(fromHex(weekSecretHex));
}
