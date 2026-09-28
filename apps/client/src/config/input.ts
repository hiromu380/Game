/**
 * 操作の設定
 */
export const INPUT_CONFIG = {
  /** この時間（ミリ秒）押し続けたら長押し（スマホで「手持ちに戻す」） */
  longPressMs: 500,
  /** この距離（盤面のピクセル）以上動かしたらドラッグ（置いたパーツを別のマスへ動かす） */
  dragThresholdPx: 10,
} as const;
