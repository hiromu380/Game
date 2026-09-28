/**
 * 素材の生成（palette.ts の色 → SVG・CSS）
 *
 * 実行: pnpm --filter @chain-factory/client art
 * 書き出し先は apps/client からの相対パス。書き出した結果はリポジトリに含める（ビルド時に生成しない:
 * 素材を人の制作物に差し替えたら、その項目をここから外すだけで済むように）。
 * 書き出し済みのファイルがここの結果とずれていないかはテスト（test/art.test.ts）で確かめる。
 */
import { paletteCss } from './paletteCss';

export function buildArt(): Record<string, string> {
  return {
    'src/styles/palette.css': paletteCss(),
  };
}
