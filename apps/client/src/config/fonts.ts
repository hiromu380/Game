/**
 * フォントの設定（画面の UI と盤面の文字で共通）
 *
 * 日本語フォントを同梱する（端末任せにすると、日本語フォントのない環境で中国語用の字形になるため）。
 * フォントは M PLUS Rounded 1c（SIL Open Font License 1.1。@fontsource から配信ファイルを同梱し、
 * 外部の CDN は使わない）。文字の範囲ごとに分かれたファイルのうち、画面で使う文字の分だけが読み込まれる。
 *
 * 別のフォントに変えるときは、ここと src/fonts.ts の import を差し替える。
 */
export const FONT_FAMILY_NAME = 'M PLUS Rounded 1c';

/** CSS の font-family（同梱フォントが読み込めない場合も日本語の字形になるよう、日本語フォントを後ろに並べる） */
export const FONT_STACK = `'${FONT_FAMILY_NAME}', 'Hiragino Maru Gothic ProN', 'Hiragino Sans', 'Noto Sans JP', 'Yu Gothic', 'Meiryo', sans-serif`;

/**
 * 同梱する太さ。フォントの定義ファイルは太さ1つで約110KB あるので2つに絞る
 * （太字 700・900 の指定には、いちばん近い 800 が使われる）
 */
export const FONT_WEIGHTS = [400, 800] as const;
