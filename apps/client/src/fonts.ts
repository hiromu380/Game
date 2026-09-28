/**
 * 同梱フォントの読み込み（@font-face の定義。実際のフォントファイルは使う文字の分だけ、必要になったときに読み込まれる）
 * 太さは config/fonts.ts の FONT_WEIGHTS と合わせる。
 * 定義ファイルが大きいので、main.tsx から非同期で読み込む（最初の表示を待たせない）
 */
import '@fontsource/m-plus-rounded-1c/400.css';
import '@fontsource/m-plus-rounded-1c/800.css';
