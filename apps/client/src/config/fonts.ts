/**
 * フォントの設定（画面の UI と盤面の文字で共通）
 *
 * 日本語フォントを同梱する（端末任せにすると、日本語フォントのない環境で中国語用の字形になるため）。
 * フォントは M PLUS Rounded 1c（SIL Open Font License 1.1）。外部の CDN は使わず、
 * i18n の文言などで使う文字だけに絞った woff2（tools/fonts/subset.mjs で作る。太さごとに約 90KB）を同梱する。
 *
 * 別のフォントに変えるときは、ここと src/styles/fonts.css、tools/fonts/subset.mjs を差し替える。
 */
export const FONT_FAMILY_NAME = 'M PLUS Rounded 1c';

/** CSS の font-family（同梱フォントが読み込めない場合も日本語の字形になるよう、日本語フォントを後ろに並べる） */
export const FONT_STACK = `'${FONT_FAMILY_NAME}', 'Hiragino Maru Gothic ProN', 'Hiragino Sans', 'Noto Sans JP', 'Yu Gothic', 'Meiryo', sans-serif`;

/** 同梱する太さ（太字 700・900 の指定には 800 を使う: styles/fonts.css） */
export const FONT_WEIGHTS = [400, 800] as const;
