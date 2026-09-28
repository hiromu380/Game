/**
 * 素材の生成（palette.ts の色 → SVG・CSS）
 *
 * 実行: pnpm --filter @chain-factory/client art
 * 書き出し先は apps/client からの相対パス。書き出した結果はリポジトリに含める（ビルド時に生成しない:
 * 素材を人の制作物に差し替えたら、その項目をここから外すだけで済むように）。
 * 書き出し済みのファイルがここの結果とずれていないかはテスト（test/art.test.ts）で確かめる。
 */
import { mascotFiles } from './mascot';
import { paletteCss } from './paletteCss';
import { previewHtml } from './preview';

export function buildArt(): Record<string, string> {
  const files: Record<string, string> = {
    'src/styles/palette.css': paletteCss(),
    ...mascotFiles(),
  };
  files['art/preview.html'] = previewHtml([
    ...Object.keys(files),
    // 生成していない既存の素材も並べる
    ...EXISTING_ASSETS,
  ]);
  return files;
}

/** 生成スクリプトの対象外の素材（プレビューにだけ出す） */
const EXISTING_ASSETS: string[] = [];
