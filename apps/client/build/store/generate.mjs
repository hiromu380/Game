/**
 * Steam ストア用の画像を作る
 *   node apps/client/build/store/generate.mjs            … カプセル画像など（svg/<id>.svg から。規定は capsules.json）
 *   node apps/client/build/store/generate.mjs --screenshots <URL>
 *                                                        … ゲーム画面のスクリーンショット（撮影モードのビルドを開いた URL）
 * Playwright と Chromium が必要。出力は apps/desktop/release/store/（git 管理外。人がアップロードする: docs/ops/store-assets.md）
 *
 * カプセル画像は、書き出したあとに大きさ・形式・容量（capsules.json）を検証し、違反があれば失敗にする（終了コード 1）。
 * SVG は `pnpm --filter @chain-factory/client art` で作る（art/keyvisual/capsules.ts）。
 * 画像の大きさは Steamworks の「グラフィックアセット」の指定に合わせる（要確認: 提出時に最新の指定を確かめる）
 */
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { validateCapsule } from './validate.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const outDir = join(here, '../../../desktop/release/store');
mkdirSync(outDir, { recursive: true });
const config = JSON.parse(readFileSync(join(here, 'capsules.json'), 'utf8'));

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright');
const browser = await chromium.launch();

const args = process.argv.slice(2);
if (args[0] === '--screenshots') {
  await screenshots(args[1] ?? 'http://localhost:5173/');
} else {
  const problems = [];
  for (const spec of config.capsules) {
    const page = await browser.newPage({ viewport: { width: spec.width, height: spec.height } });
    const src = pathToFileURL(join(here, 'svg', `${spec.id}.svg`)).href;
    // SVG を原寸で1枚だけ表示して撮る（透過のロゴは背景なし）
    // （about:blank からは file:// の画像を読めないので、書き出し先に一時の HTML を置いて開く）
    const html = join(outDir, `_${spec.id}.html`);
    writeFileSync(
      html,
      `<html><body style="margin:0;background:${spec.transparent ? 'transparent' : '#000'}"><img src="${src}" width="${spec.width}" height="${spec.height}" style="display:block"></body></html>`,
    );
    await page.goto(pathToFileURL(html).href);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(300);
    const bytes = await page.screenshot(
      spec.format === 'jpg'
        ? { type: 'jpeg', quality: 88 }
        : { type: 'png', omitBackground: Boolean(spec.transparent) },
    );
    writeFileSync(join(outDir, spec.file), bytes);
    problems.push(...validateCapsule(spec, bytes, config.maxBytes));
    console.log(`${spec.file}: ${spec.width}×${spec.height} ${(bytes.length / 1024).toFixed(0)}KB`);
    await page.close();
    rmSync(html);
  }
  if (problems.length > 0) {
    console.error(`規定に合わない画像があります:\n- ${problems.join('\n- ')}`);
    process.exitCode = 1;
  } else {
    console.log(
      `wrote ${config.capsules.length} files to ${outDir}（大きさ・形式・容量の検証: 合格）`,
    );
  }
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
