/**
 * 画面レイアウトの設定
 */
export const LAYOUT = {
  /**
   * この幅以下を「狭い画面」（スマホ縦画面）として扱う。
   * 盤面の下にショップ・手持ちをタブで切り替えて出し、スクロールなしで盤面全体を操作できるようにする
   */
  compactMaxWidthPx: 600,
  /**
   * 横長の画面（PC・Steam Deck・タブレット横）。アプリとして1画面に収め、ページをスクロールさせない:
   * 画面の幅いっぱいを使い、盤面は画面の高さに合わせ、右の列だけをスクロールする
   */
  fitQuery: '(min-width: 821px) and (orientation: landscape)',
  /**
   * 横長で高さが低い画面（Steam Deck の 1280×800・ノートPC）。上に加えて、ショップ・手持ちをタブで切り替え、
   * 見出しなどを詰める
   */
  shortQuery: '(min-width: 821px) and (orientation: landscape) and (max-height: 860px)',
  /** 横長の画面で、盤面の一辺の上限（px）。シフトの情報などは右の列に置き、盤面は画面の高さいっぱいまで使う */
  boardMaxPx: 1400,
} as const;
