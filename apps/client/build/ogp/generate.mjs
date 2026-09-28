/**
 * OGP 画像（public/ogp.png）を ogp.html から作る
 * 実行: node apps/client/build/ogp/generate.mjs （Playwright と Chromium が必要。文言を変えたときだけ実行する）
 */
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright');
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
await page.goto(pathToFileURL(join(here, 'ogp.html')).href);
await page.screenshot({ path: join(here, '../../public/ogp.png') });
await browser.close();
console.log('wrote public/ogp.png');
