/**
 * デイリーの秘密値と本番シード（CLAUDE.md「シード」）
 *
 * - dailySecret = HMAC(マスター秘密鍵, 'daily:' + dailyId)
 *   日ごとに別の値になるので、締め切り後にその日の分だけ公開しても、他の日は予測できない
 * - 本番シード = HMAC(dailySecret, 'shift:' + shiftIndex) の先頭4バイト（32bit 整数）
 *   シフトごとに別の値なので、確定したシフトのシードを返しても先のシフトは予測できない
 * - seedCommitment = SHA-256(dailySecret)。開始時に公開し、締め切り後に dailySecret と照合できる
 *
 * マスター秘密鍵は公開しない。DB にも秘密値は保存せず、必要なときに毎回導き出す。
 */
import { fromHex, hmacSha256, sha256Hex, toHex } from '../crypto';

/** その日の秘密値（16進） */
export async function deriveDailySecret(masterSecret: string, dailyId: string): Promise<string> {
  return toHex(await hmacSha256(masterSecret, `daily:${dailyId}`));
}

/** その日の本番シード（シフトごと） */
export async function deriveCommitSeed(
  dailySecretHex: string,
  shiftIndex: number,
): Promise<number> {
  const bytes = await hmacSha256(fromHex(dailySecretHex), `shift:${shiftIndex}`);
  // 先頭4バイトを符号なし32bit整数として読む（シミュレーションの PRNG は32bit シード）
  return ((bytes[0]! << 24) | (bytes[1]! << 16) | (bytes[2]! << 8) | bytes[3]!) >>> 0;
}

/** 開始時に公開する、秘密値のハッシュ */
export function commitmentOf(dailySecretHex: string): Promise<string> {
  return sha256Hex(fromHex(dailySecretHex));
}
