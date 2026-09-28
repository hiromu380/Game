/**
 * サーバーの数値設定（上限・件数など）
 * ゲームバランスの数値は packages/sim/src/balance.ts、こちらは API・運用まわりの値だけを置く。
 */
export const SERVER_LIMITS = {
  /** 1シフトの操作ログの最大手数（これを超える提出は不正扱い。通常のプレイは数十手） */
  maxOpsPerShift: 2000,
  /** リクエスト本文の最大バイト数 */
  maxBodyBytes: 256 * 1024,
  /** ランキングの上位表示件数 */
  rankingTop: 50,
  /** 自分の前後に表示する件数（片側） */
  rankingAround: 5,
} as const;
