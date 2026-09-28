/**
 * 素材のプレビューページ（art/preview.html）: すべての SVG を 24・48・96px、暗い背景と明るい背景で並べる
 * 「48px でシルエットだけで区別できるか」「24px で意味がわかるか」を目で確かめるためのもの（docs/art-style.md）
 * ブラウザで直接開く（file://）。ゲームのビルドには含めない
 */
export function previewHtml(files: string[]): string {
  const svgs = files.filter((f) => f.endsWith('.svg')).sort();
  const groups = new Map<string, string[]>();
  for (const f of svgs) {
    const dir = f.split('/').slice(0, -1).join('/');
    groups.set(dir, [...(groups.get(dir) ?? []), f]);
  }
  const sections = [...groups]
    .map(
      ([dir, list]) => `<h2>${dir}</h2>
<div class="grid">${list
        .map(
          (f) =>
            `<figure><div class="sizes">${[24, 48, 96]
              .map((s) => `<img src="../${f}" width="${s}" height="${s}" alt="">`)
              .join('')}</div><div class="sizes light">${[24, 48]
              .map((s) => `<img src="../${f}" width="${s}" height="${s}" alt="">`)
              .join('')}</div><figcaption>${f.split('/').pop()}</figcaption></figure>`,
        )
        .join('\n')}</div>`,
    )
    .join('\n');
  return `<!doctype html>
<!-- 素材のプレビュー（art/ のスクリプトで生成。手で編集しない） -->
<html lang="ja">
<head>
<meta charset="UTF-8">
<title>Chain Factory 素材プレビュー</title>
<style>
body { margin: 16px; background: #1a1c20; color: #eef0f3; font-family: sans-serif; }
h2 { font-size: 14px; margin: 16px 0 8px; color: #ffc107; }
.grid { display: flex; flex-wrap: wrap; gap: 8px; }
figure { margin: 0; padding: 6px; background: #262a31; border-radius: 8px; }
.sizes { display: flex; align-items: flex-end; gap: 6px; }
.light { background: #eceff1; border-radius: 4px; padding: 2px; margin-top: 4px; }
figcaption { font-size: 10px; color: #a3aab5; margin-top: 4px; }
</style>
</head>
<body>
<h1>素材プレビュー</h1>
${sections}
</body>
</html>
`;
}
