/**
 * Steamworks に登録する実績アイコン（PNG）を src/assets/achievements/*.svg から作る
 * 実行: node apps/client/build/achievements/generate.mjs （Playwright と Chromium が必要）
 *
 * 出力: apps/desktop/release/achievements/（git 管理外。人が Steamworks にアップロードする: docs/ops/steam-achievements.md）
 *   <ID>.png        解除済みのアイコン
 *   <ID>_locked.png 未解除のアイコン（グレースケール・少し暗く）
 * 大きさは SIZE（要確認: Steamworks の指定。docs/ops/steam-achievements.md）
 */
import { mkdirSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SIZE = 256;
const here = dirname(fileURLToPath(import.meta.url));
const srcDir = join(here, '../../src/assets/achievements');
const outDir = join(here, '../../../desktop/release/achievements');
mkdirSync(outDir, { recursive: true });

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright');
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: SIZE, height: SIZE } });
const files = readdirSync(srcDir).filter((f) => f.endsWith('.svg'));
for (const file of files) {
  const data = Buffer.from(readFileSync(join(srcDir, file))).toString('base64');
  for (const locked of [false, true]) {
    const filter = locked ? 'filter: grayscale(1) brightness(0.65);' : '';
    await page.setContent(
      `<body style="margin:0;background:#1a1c20"><img style="width:${SIZE}px;height:${SIZE}px;display:block;${filter}" src="data:image/svg+xml;base64,${data}"></body>`,
    );
    // eslint-disable-next-line no-undef -- ブラウザ内で実行される関数
    await page.waitForFunction(() => document.images[0]?.complete);
    const id = file.replace(/\.svg$/, '');
    await page.screenshot({ path: join(outDir, `${id}${locked ? '_locked' : ''}.png`) });
  }
}
await browser.close();
console.log(`wrote ${files.length * 2} files to ${outDir}`);
