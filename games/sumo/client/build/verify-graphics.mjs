/** ブラウザによる造形・画面・復旧検証。製品のエントリには含めない。
 * 先に pnpm --filter @ichimon/client build を実行する。
 * Playwrightを別途導入し、PLAYWRIGHT_MODULEで絶対パスを指定してもよい。
 */
/* global document, window, HTMLCanvasElement, requestAnimationFrame, innerWidth, getComputedStyle */
import { createServer, preview } from 'vite';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
const { chromium: playwright } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const client = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const output = resolve(process.env.REVIEW_OUTPUT || join(client, 'build/.review-output'));
const launch = () =>
  playwright.launch({
    executablePath: process.env.CHROMIUM_EXECUTABLE_PATH || undefined,
    args: process.env.CHROMIUM_ARGS_JSON
      ? JSON.parse(process.env.CHROMIUM_ARGS_JSON)
      : ['--enable-unsafe-swiftshader'],
    headless: true,
  });
const live = await createServer({
  root: client,
  server: { host: '127.0.0.1', port: 5175, strictPort: true },
});
await live.listen();
const built = await preview({
  root: client,
  preview: { host: '127.0.0.1', port: 5174, strictPort: true },
});

/** 遅延肖像は各表示領域を通してから撮影する。フォールバックの混在を防ぐ。 */
async function settlePortraits(page) {
  for (const portrait of await page.locator('.portrait-3d').all()) {
    await portrait.scrollIntoViewIfNeeded();
    await portrait.locator('img').waitFor({ timeout: 10000 });
  }
  await page.evaluate(() => window.scrollTo(0, 0));
}

async function screens() {
  const out = join(output, 'screens');
  mkdirSync(out, { recursive: true });
  let browser;
  try {
    for (const width of [390, 1280]) {
      browser = await launch();
      const page = await browser.newPage({
        viewport: { width, height: 900 },
        deviceScaleFactor: width === 390 ? 3 : 1.5,
        isMobile: width === 390,
        hasTouch: width === 390,
      });
      await page.addInitScript(() => {
        Math.random = () => 0.37621;
      });
      const errors = [];
      page.on('pageerror', (e) => errors.push(e.message));
      await page.goto('http://127.0.0.1:5174/');
      await page.waitForTimeout(1300);
      await page.evaluate(() => document.fonts.ready);
      await settlePortraits(page);
      await page.screenshot({ path: `${out}/title-${width}.png`, fullPage: true });
      await page.getByRole('button', { name: '部屋を開く', exact: true }).click();
      await page.waitForTimeout(1000);
      await settlePortraits(page);
      await page.screenshot({ path: `${out}/stable-${width}.png`, fullPage: true });
      for (const [name, file] of [
        ['番付', 'banzuke'],
        ['帳簿', 'ledger'],
        ['一門', 'lineage'],
      ]) {
        await page.getByRole('tab', { name, exact: true }).click();
        await page.waitForTimeout(400);
        await page.screenshot({ path: `${out}/${file}-${width}.png`, fullPage: true });
      }
      await page.getByRole('button', { name: '本場所へ', exact: true }).click();
      await page.waitForTimeout(500);
      await page.locator('.modal__box').evaluate((el) => {
        el.scrollTop = 0;
      });
      await page.screenshot({ path: `${out}/report-${width}.png` });
      await page.locator('.modal__box').evaluate((el) => {
        el.scrollTop = el.scrollHeight;
      });
      await page.screenshot({ path: `${out}/report-bottom-${width}.png` });
      await page.locator('.modal__box').evaluate((el) => {
        el.scrollTop = 0;
      });
      await page.locator('button.star').first().click();
      await page.locator('.modal__box--bout canvas').waitFor();
      await page.waitForTimeout(1100);
      await page.screenshot({ path: `${out}/bout-action-${width}.png`, fullPage: false });
      await page.waitForTimeout(3300);
      await page.screenshot({ path: `${out}/bout-final-${width}.png`, fullPage: false });
      const summary = {
        width,
        errors,
        overflow: await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
        canvas: await page.locator('canvas').count(),
      };
      await page.getByRole('button', { name: '閉じる', exact: true }).click();
      await page.getByRole('button', { name: '閉じる', exact: true }).click();
      await page.getByRole('tab', { name: '帳簿', exact: true }).click();
      for (const [i, table] of (await page.locator('table.ledger').all()).entries()) {
        await table.screenshot({ path: `${out}/ledger-table-${i + 1}-${width}.png` });
      }
      await page.screenshot({ path: `${out}/ledger-populated-${width}.png`, fullPage: true });
      assert.equal(await page.locator('table.ledger').count(), 3);
      assert.equal(errors.length, 0);
      assert.equal(summary.overflow, false);
      assert.equal(summary.canvas, 1);
      writeFileSync(`${out}/screen-${width}.json`, JSON.stringify(summary, null, 2));
      console.log(JSON.stringify(summary));
      await browser.close();
    }
  } finally {
    await browser?.close();
  }
}

async function graphics() {
  const out = join(output, 'graphics');
  mkdirSync(out, { recursive: true });
  let browser;
  const results = [];
  try {
    for (const width of [390, 1280]) {
      browser = await launch();
      const page = await browser.newPage({
        viewport: { width, height: 900 },
        deviceScaleFactor: width === 390 ? 3 : 1.5,
        isMobile: width === 390,
        hasTouch: width === 390,
      });
      const errors = [];
      page.on('pageerror', (e) => errors.push(e.message));
      page.on('console', (m) => {
        if (m.type() === 'error') errors.push(m.text());
      });
      await page.addInitScript(() => {
        window.__gl = [];
        const get = HTMLCanvasElement.prototype.getContext;
        HTMLCanvasElement.prototype.getContext = function (type, ...args) {
          const ctx = get.call(this, type, ...args);
          if (ctx && type.startsWith('webgl') && !window.__gl.includes(ctx)) window.__gl.push(ctx);
          return ctx;
        };
      });
      await page.goto('http://127.0.0.1:5175/build/review.html');
      await page.waitForTimeout(1800);
      await page.screenshot({ path: `${out}/models-${width}.png`, fullPage: true });
      await page.evaluate(async () => {
        const { mountStage } = await import('/src/art/three/stage.ts');
        const { rikishiLook } = await import('/src/art/look.ts');
        const { boutScript, poseAt } = await import('/src/playback/boutScript.ts');
        window.__qa = { mountStage, rikishiLook, boutScript, poseAt };
        const base = {
          weight: 150,
          stableId: 1,
          careerBasho: 40,
          sekitori: true,
          yokozuna: false,
          injured: false,
          fatigue: 0,
        };
        window.__looks = [
          rikishiLook({ ...base, id: 3 }),
          rikishiLook({ ...base, id: 4, weight: 175, stableId: 2 }),
        ];
      });
      for (const kimarite of ['oshidashi', 'uwatenage', 'hatakikomi', 'oshitaoshi']) {
        await page.evaluate(
          ({ kimarite }) => {
            window.__stage?.dispose();
            let old = document.getElementById('test-stage');
            old.replaceWith(old.cloneNode());
            const { mountStage, boutScript, poseAt } = window.__qa;
            const script = boutScript(kimarite, 'E', 78);
            const time = script.duration;
            const input = {
              east: window.__looks[0],
              west: window.__looks[1],
              pose: poseAt(script, time),
              arms: 'side',
              winner: 'E',
              motion: { time, clash: script.frames[1].t, duration: time },
            };
            window.__stage = mountStage(document.getElementById('test-stage'), input);
          },
          { kimarite },
        );
        await page.locator('#test-stage').screenshot({ path: `${out}/${kimarite}-${width}.png` });
      }
      const performance = await page.evaluate(async () => {
        window.__stage.dispose();
        let old = document.getElementById('test-stage');
        old.replaceWith(old.cloneNode());
        const { mountStage, boutScript, poseAt } = window.__qa;
        const script = boutScript('uwatenage', 'W', 78);
        const stage = mountStage(document.getElementById('test-stage'), {
          east: window.__looks[0],
          west: window.__looks[1],
          pose: poseAt(script, 0),
          arms: 'side',
          winner: null,
        });
        window.__stage = stage;
        const times = [];
        let last = 0;
        const start = performance.now();
        await new Promise((resolve) => {
          function tick(now) {
            if (last) times.push(now - last);
            last = now;
            const t = Math.min((now - start) / 1000, script.duration);
            stage.update({
              east: window.__looks[0],
              west: window.__looks[1],
              pose: poseAt(script, t),
              arms: t > 0.6 ? 'push' : 'side',
              winner: t === script.duration ? 'W' : null,
              motion: { time: t, clash: script.frames[1].t, duration: script.duration },
            });
            if (t < script.duration) requestAnimationFrame(tick);
            else resolve();
          }
          requestAnimationFrame(tick);
        });
        const m = stage.metrics();
        stage.dispose();
        times.sort((a, b) => a - b);
        return {
          ...m,
          rafP50: times[Math.floor(times.length * 0.5)],
          rafP95: times[Math.floor(times.length * 0.95)],
        };
      });
      const stress = await page.evaluate(async () => {
        const { mountStage, boutScript, poseAt } = window.__qa;
        const script = boutScript('uwatenage', 'E', 78);
        let canvas = document.getElementById('test-stage');
        const count = () => window.__gl.filter((gl) => !gl.isContextLost()).length;
        const before = count();
        const heaps = [];
        const afterDispose = [];
        for (let i = 0; i < 20; i++) {
          const next = canvas.cloneNode();
          canvas.replaceWith(next);
          canvas = next;
          const s = mountStage(canvas, {
            east: window.__looks[0],
            west: window.__looks[1],
            pose: poseAt(script, script.duration),
            arms: 'side',
            winner: 'E',
          });
          s.dispose();
          s.dispose();
          await new Promise((r) => setTimeout(r, 25));
          afterDispose.push(s.metrics().geometries);
          if (window.gc) window.gc();
          heaps.push(performance.memory?.usedJSHeapSize);
        }
        return {
          before,
          after: count(),
          created: window.__gl.length,
          geometriesAfterDispose: afterDispose,
          heaps,
        };
      });
      assert.equal(errors.length, 0);
      assert.ok(stress.after <= stress.before && stress.after <= 1);
      assert.ok(stress.geometriesAfterDispose.every((n) => n === 0));
      results.push({ width, performance, stress, errors });
      console.log(JSON.stringify(results.at(-1)));
      await browser.close();
    }
  } finally {
    await browser?.close();
    writeFileSync(`${out}/results.json`, JSON.stringify(results, null, 2));
  }
}

async function recovery() {
  const out = join(output, 'recovery');
  mkdirSync(out, { recursive: true });
  const result = [];
  let browser;
  try {
    for (const mode of ['normal', 'no-webgl', 'chunk-failure', 'reduced', 'png']) {
      browser = await launch();
      const page = await browser.newPage({
        viewport: { width: 390, height: 844 },
        deviceScaleFactor: 3,
        isMobile: true,
        hasTouch: true,
        reducedMotion: mode === 'reduced' ? 'reduce' : 'no-preference',
      });
      await page.addInitScript(() => {
        Math.random = () => 0.37621;
      });
      const errors = [];
      page.on('pageerror', (e) => errors.push(e.message));
      if (mode === 'no-webgl')
        await page.addInitScript(() => {
          const get = HTMLCanvasElement.prototype.getContext;
          HTMLCanvasElement.prototype.getContext = function (type, ...args) {
            return type.startsWith('webgl') ? null : get.call(this, type, ...args);
          };
        });
      if (mode === 'png')
        await page.addInitScript(() => {
          const get = HTMLCanvasElement.prototype.toDataURL;
          HTMLCanvasElement.prototype.toDataURL = function (type, ...args) {
            return get.call(this, type === 'image/webp' ? 'image/png' : type, ...args);
          };
        });
      if (mode === 'chunk-failure')
        await page.route('**/BoutStage3D-*.js', (route) => route.abort());
      if (mode === 'normal')
        await page.addInitScript(() => {
          window.__gl = [];
          const get = HTMLCanvasElement.prototype.getContext;
          HTMLCanvasElement.prototype.getContext = function (type, ...args) {
            const gl = get.call(this, type, ...args);
            if (gl && type.startsWith('webgl') && !window.__gl.includes(gl)) window.__gl.push(gl);
            return gl;
          };
        });
      await page.goto('http://127.0.0.1:5174/');
      await page.getByRole('button', { name: '部屋を開く', exact: true }).click();
      await page.getByRole('button', { name: '本場所へ', exact: true }).click();
      if (mode === 'normal')
        await page.route('**/BoutStage3D-*.js', async (route) => {
          await new Promise((r) => setTimeout(r, 1000));
          await route.continue();
        });
      await page.locator('button.star').first().click();
      if (mode === 'normal') {
        await page.waitForTimeout(500);
        const loadingResult = await page.locator('.bout__result').innerText();
        await page.waitForSelector('.dohyo--3d > canvas');
        await page.waitForTimeout(150);
        const afterReady = await page.locator('.bout__result').innerText();
        await page.evaluate(() => {
          document.dispatchEvent(new Event('visibilitychange'));
        });
        await page.evaluate(() =>
          document
            .querySelector('.dohyo--3d canvas')
            .getContext('webgl2')
            .getExtension('WEBGL_lose_context')
            .loseContext(),
        );
        await page.waitForSelector('svg.dohyo');
        const lostFallback = await page.locator('svg.dohyo').count();
        await page.getByRole('button', { name: '閉じる', exact: true }).click();
        const heap = [];
        for (let i = 0; i < 20; i++) {
          await page.locator('button.star').first().click();
          await page.waitForSelector('.dohyo--3d canvas');
          await page.waitForTimeout(70);
          await page.getByRole('button', { name: '閉じる', exact: true }).click();
          await page.waitForTimeout(25);
          heap.push(
            await page.evaluate(() => window.__gl.filter((gl) => !gl.isContextLost()).length),
          );
        }
        await page.locator('button.star').first().click();
        await page.waitForSelector('.dohyo--3d canvas');
        await page.waitForTimeout(3300);
        result.push({
          mode,
          loadingResult,
          afterReady,
          lostFallback,
          activeContextsAfterClose: heap,
          final: await page.locator('.bout__result').innerText(),
          errors,
        });
      } else {
        await page.waitForSelector('.bout__result.is-done', { timeout: 8000 });
        if (mode === 'reduced' || mode === 'png') await page.waitForSelector('.dohyo--3d canvas');
        const before = await page.locator('.bout__result').innerText();
        const img = await page
          .locator('img')
          .first()
          .getAttribute('src')
          .catch(() => null);
        const canvas = await page.locator('.dohyo--3d canvas').count(),
          svg = await page.locator('svg.dohyo').count();
        let stable = null;
        if (mode === 'reduced') {
          const a = await page.locator('.dohyo--3d canvas').evaluate((c) => c.toDataURL());
          await page.waitForTimeout(400);
          const b = await page.locator('.dohyo--3d canvas').evaluate((c) => c.toDataURL());
          stable = a === b;
        }
        result.push({
          mode,
          canvas,
          svg,
          result: before,
          png: img?.startsWith('data:image/png'),
          stable,
          errors,
        });
      }
      const check = result.at(-1);
      assert.equal(errors.length, 0);
      if (mode === 'normal') {
        assert.equal(check.lostFallback, 1);
        assert.ok(check.activeContextsAfterClose.every((n) => n <= 1));
        assert.equal(check.afterReady, 'はっけよい…');
      } else if (mode === 'no-webgl' || mode === 'chunk-failure') {
        assert.equal(check.svg, 1);
        assert.equal(check.canvas, 0);
      } else if (mode === 'reduced') {
        assert.equal(check.stable, true);
        assert.equal(check.canvas, 1);
      } else if (mode === 'png') assert.equal(check.png, true);
      await page.screenshot({ path: `${out}/${mode}-390.png`, fullPage: true });
      console.log(JSON.stringify(result.at(-1)));
      await browser.close();
    }
  } finally {
    await browser?.close();
    writeFileSync(`${out}/results.json`, JSON.stringify(result, null, 2));
  }
}

/** 長い名前・関取・横綱・けが・分家を表示専用のセーブで確認する。simは実行しない。 */
async function edgecases() {
  const out = join(output, 'edgecases');
  mkdirSync(out, { recursive: true });
  for (const width of [390, 1280]) {
    const browser = await launch();
    try {
      const page = await browser.newPage({
        viewport: { width, height: 900 },
        hasTouch: width === 390,
      });
      const errors = [];
      page.on('pageerror', (e) => errors.push(e.message));
      await page.goto('http://127.0.0.1:5174/');
      await page.getByRole('button', { name: '部屋を開く', exact: true }).click();
      await page.waitForFunction(() => localStorage.getItem('ichimon.save'));
      await page.evaluate(() => {
        const g = JSON.parse(localStorage.getItem('ichimon.save'));
        const mine = g.rikishi.filter((r) => r.stableId === g.player.stableId);
        mine[0].name = '朝ノ海朝ノ海朝ノ海朝ノ海朝ノ海';
        mine[0].weight = 175;
        mine[0].career.basho = 60;
        mine[0].injury = 2;
        mine[0].fatigue = 80;
        mine[1].name = 'LongUnbrokenWrestlerNameForLayoutReview';
        mine[1].weight = 95;
        mine[1].career.basho = 35;
        const ids = [mine[0].id, mine[1].id];
        g.banzuke = [...ids, ...g.banzuke.filter((id) => !ids.includes(id))];
        g.titles[ids[0]] = 'Y';
        g.titles[ids[1]] = 'O';
        const root = g.player.family[0];
        g.player.family.push({
          ...root,
          id: 901,
          parentId: root.id,
          kind: 'branch',
          name: '分家の親方',
          stableId: g.stables.find((x) => x.id !== g.player.stableId).id,
        });
        g.player.family.push({
          ...root,
          id: 902,
          parentId: root.id,
          kind: 'waiting',
          name: '待機の親方',
        });
        localStorage.setItem('ichimon.save', JSON.stringify(g));
      });
      await page.reload();
      await page.waitForTimeout(1400);
      await page.evaluate(() => document.fonts.ready);
      await page.locator('.card').first().scrollIntoViewIfNeeded();
      await page.locator('.card__portrait img').first().waitFor();
      for (const i of [0, 1])
        await page
          .locator('.card')
          .nth(i)
          .screenshot({ path: `${out}/state-card-${i + 1}-${width}.png` });
      await page.screenshot({ path: `${out}/states-${width}.png`, fullPage: true });
      assert.equal(
        await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
        false,
      );
      await page.locator('.tabs__tab').nth(3).click();
      await page.waitForTimeout(400);
      await page.screenshot({ path: `${out}/branches-${width}.png`, fullPage: true });
      assert.equal(
        await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
        false,
      );
      await page.getByRole('button', { name: 'English', exact: true }).click();
      await page.locator('.tabs__tab').nth(1).click();
      await page.screenshot({ path: `${out}/english-${width}.png`, fullPage: true });
      assert.equal(
        await page
          .locator('.banzuke__name')
          .first()
          .evaluate((el) => getComputedStyle(el).writingMode),
        'horizontal-tb',
      );
      assert.equal(errors.length, 0);
      console.log(JSON.stringify({ edgecases: width, errors }));
    } finally {
      await browser.close();
    }
  }
}

try {
  const selected = process.argv.slice(2);
  for (const [name, run] of Object.entries({ screens, graphics, recovery, edgecases })) {
    if (!selected.length || selected.includes(name)) await run();
  }
} finally {
  await live.close();
  await new Promise((resolve) => built.httpServer.close(resolve));
}
