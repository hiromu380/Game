/**
 * 本番の前の確認の設定（state/commitCheck.ts・ui/CommitConfirm.tsx）
 */
export const COMMIT_CHECK_CONFIG = {
  /**
   * ランダムに動くパーツ（ポンコツロボ）があるとき、成功の見込みを出すために試す回数。
   * 1回の simulate は 1ms 未満なので、確認の画面を開くたびに試しても重くない
   */
  oddsSamples: 20,
  /**
   * 見込みを出すときのシードの用途番号（deriveSeed の2番目）。sim の用途（1〜8）とぶつからない番号にする。
   * 本番シードは使わない（デイリーの本番シードはサーバーの秘密値なので、そもそも手元にない）
   */
  oddsSeedLabel: 101,
} as const;
