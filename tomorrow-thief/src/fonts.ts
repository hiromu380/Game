/**
 * 文字のフォント（同梱した日本語フォント。端末に入っているフォントで漢字の字形が変わらないように）
 *
 * - 見出し・作品名・台の上の文字: しっぽり明朝
 * - 本文・金額・数字: 禅角ゴシック New
 * ファイルは src/assets/fonts/（scripts/fonts.mjs でサブセット化。OFL.txt）
 */
import mincho700 from './assets/fonts/shippori-mincho-700.woff2';
import gothic500 from './assets/fonts/zen-kaku-gothic-new-500.woff2';
import gothic700 from './assets/fonts/zen-kaku-gothic-new-700.woff2';

export const FONT_TITLE = '"TT Mincho", "Yu Mincho", "Hiragino Mincho ProN", serif';
export const FONT_BODY = '"TT Gothic", "Yu Gothic UI", "Hiragino Sans", "Meiryo", sans-serif';

const FACES: [string, string, string][] = [
  ['TT Mincho', mincho700, '700'],
  ['TT Gothic', gothic500, '500'],
  ['TT Gothic', gothic700, '700'],
];

/** フォントを読み込む（Canvas に描く前に済ませる。失敗しても端末のフォントで続ける） */
export async function loadFonts(): Promise<void> {
  await Promise.all(
    FACES.map(async ([family, url, weight]) => {
      try {
        const face = new FontFace(family, `url(${url})`, { weight, display: 'block' });
        document.fonts.add(await face.load());
      } catch {
        // 読み込めなくても遊べる
      }
    }),
  );
}
