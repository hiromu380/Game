/**
 * Steam ストア用の画像を作る
 *   node apps/client/build/store/generate.mjs            … カプセル画像など（capsule.html から）
 *   node apps/client/build/store/generate.mjs --screenshots <URL>
 *                                                        … ゲーム画面のスクリーンショット（撮影モードのビルドを開いた URL）
 * Playwright と Chromium が必要。出力は apps/desktop/release/store/（git 管理外。人がアップロードする: docs/ops/store-assets.md）
 *
 * 画像の大きさは Steamworks の「グラフィックアセット」の指定に合わせる（要確認: 提出時に最新の指定を確かめる）
 */
import { mkdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const outDir = join(here, '../../../desktop/release/store');
mkdirSync(outDir, { recursive: true });

/** 画像の種類 → [ファイル名, 幅, 高さ, capsule.html のレイアウト] */
const CAPSULES = [
  ['header_capsule.png', 920, 430, 'header'],
  ['small_capsule.png', 462, 174, 'small'],
  ['main_capsule.png', 1232, 706, 'main'],
  ['vertical_capsule.png', 748, 896, 'vertical'],
  ['library_capsule.png', 600, 900, 'vertical'],
  ['library_hero.png', 3840, 1240, 'hero'],
  ['library_logo.png', 1280, 720, 'libraryLogo'],
];

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright');
const browser = await chromium.launch();

const args = process.argv.slice(2);
if (args[0] === '--screenshots') {
  await screenshots(args[1] ?? 'http://localhost:5173/');
} else {
  for (const [file, width, height, kind] of CAPSULES) {
    const page = await browser.newPage({ viewport: { width, height } });
    await page.goto(`${pathToFileURL(join(here, 'capsule.html')).href}?kind=${kind}`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(300);
    await page.screenshot({ path: join(outDir, file), omitBackground: kind === 'libraryLogo' });
    await page.close();
  }
  console.log(`wrote ${CAPSULES.length} files to ${outDir}`);
}
await browser.close();

/**
 * ゲーム画面（1920×1080）: 撮影モードで見本の盤面を読み込み、指定したシードで本番を再生して撮る
 * 盤面は screenshot-boards.json（撮影モードの「盤面を書き出す」で作ったもの。ui: full / minimal / none、
 * seed を指定すると本番を再生し、waitMs ミリ秒後に撮る）
 */
async function screenshots(url) {
  const shots = JSON.parse(readFileSync(join(here, 'screenshot-boards.json'), 'utf8'));
  let n = 0;
  for (const shot of shots) {
    // 1280×720 を 1.5 倍で描いて 1920×1080 にする（高さの低い画面のレイアウトで、盤面が大きく写る）
    const page = await browser.newPage({
      viewport: { width: 1280, height: 720 },
      deviceScaleFactor: 1.5,
    });
    await page.goto(url);
    await page.locator('.title__actions .button--primary').click();
    await page.locator('.board-canvas').waitFor();
    await page.locator('.capture textarea').fill(JSON.stringify(shot.board));
    await page.locator('.capture button').nth(-2).click(); // 読み込む
    // UI の表示（撮影モードのパネルの1行目: 全部・最小限・なし）
    const uiIndex = ['full', 'minimal', 'none'].indexOf(shot.ui ?? 'full');
    await page.locator('.capture .button-row').first().locator('button').nth(uiIndex).click();
    if (shot.seed !== undefined) {
      await page.locator('.capture input').fill(String(shot.seed));
      await page.locator('.capture button').last().click(); // このシードで本番
      await page.waitForTimeout(shot.waitMs ?? 3000);
    }
    await page.keyboard.press('c'); // 撮影モードのパネルを隠す
    await page.mouse.move(0, 0);
    await page.waitForTimeout(200);
    await page.screenshot({ path: join(outDir, `screenshot_${++n}.png`) });
    await page.close();
  }
  console.log(`wrote ${n} screenshots to ${outDir}`);
}
