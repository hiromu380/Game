/**
 * PNG のアプリアイコン（public/icon-180.png・icon-512.png）を public/icon.svg から作る
 * 実行: node apps/client/build/icons/generate.mjs （Playwright と Chromium が必要。アイコンの絵を変えたときだけ実行する）
 * ホーム画面のアイコンは透過だと端末ごとに背景が変わるので、背景色（パレットの bg）を敷く
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const publicDir = join(here, '../../public');
const icon = readFileSync(join(publicDir, 'icon.svg'), 'utf8');
const palette = readFileSync(join(here, '../../src/styles/palette.css'), 'utf8');
const bg = /--bg: (#[0-9a-f]{6})/.exec(palette)[1];

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright');
const browser = await chromium.launch();
for (const size of [180, 512]) {
  const page = await browser.newPage({ viewport: { width: size, height: size } });
  const pad = Math.round(size * 0.1);
  await page.setContent(
    `<body style="margin:0;background:${bg};display:flex;align-items:center;justify-content:center;width:${size}px;height:${size}px">` +
      `<img style="width:${size - pad * 2}px;height:${size - pad * 2}px" src="data:image/svg+xml;base64,${Buffer.from(icon).toString('base64')}"></body>`,
  );
  await page.screenshot({ path: join(publicDir, `icon-${size}.png`) });
  await page.close();
}
await browser.close();
console.log('wrote public/icon-180.png, public/icon-512.png');
