/**
 * 画面の見やすさの確認用スクリーンショット（UI 改善の前後比較: docs/ui-review/）
 *
 *   pnpm --filter @chain-factory/client ui-review <before|after|wip> [URL]
 *   （wip は作業中の確認用で docs/ui-review/wip/ に出す。git 管理外）
 *
 * - URL は開発サーバー（pnpm dev。既定 http://localhost:5173/）。撮影モードではないふつうのビルドを開く
 * - 状態（ラン）は sim で作ってセーブとして書き込み、画面を開いてから操作で「選択中」「試運転後」などにする
 * - 画面サイズ × 状態 × 言語のスクリーンショットと、横スクロール・ヘッダーのはみ出しの検査結果（report.md）を書き出す
 * Playwright と Chromium が必要（PLAYWRIGHT_MODULE で Playwright の場所を指定できる。`playwright install` はしない）
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createSave } from '@chain-factory/shared';
import {
  addItem,
  chooseEvent,
  commitShift,
  createRun,
  isEventPending,
  useFloorPermit as spendFloorPermit,
  type RunState,
} from '@chain-factory/sim';

const phase = process.argv[2] === 'after' ? 'after' : process.argv[2] === 'wip' ? 'wip' : 'before';
/** 撮る画像を絞る（ファイル名の正規表現。例: UI_REVIEW_ONLY='1280x800-ja-trial'） */
const only = process.env.UI_REVIEW_ONLY ? new RegExp(process.env.UI_REVIEW_ONLY) : null;
const url = process.argv[3] ?? 'http://localhost:5173/';
const here = dirname(fileURLToPath(import.meta.url));
const outDir = join(here, '../../../../docs/ui-review', phase);
mkdirSync(outDir, { recursive: true });

// ---- 状態（ラン）を作る ----

/** 1日目の朝（床は ×2 のみ・ボーナス床あり） */
const day1 = (): RunState => createRun(5);

/** 3日目の朝まで進めたラン（×3 床・使用不可・夜の予告・今日の出来事あり）。配置権を1枚使った床も置く */
function day3(): RunState {
  const original = createRun(18);
  let run: RunState = {
    ...original,
    config: { ...original.config, shifts: original.config.shifts.map((s) => ({ ...s, quota: 0 })) },
  };
  while (run.shiftIndex < 6) {
    if (isEventPending(run)) {
      const chosen = chooseEvent(run, 0);
      if (chosen.ok) run = chosen.state;
    }
    const committed = commitShift(run);
    if ('error' in committed) throw new Error(committed.error);
    run = committed.state;
  }
  if (isEventPending(run)) {
    const chosen = chooseEvent(run, 0);
    if (chosen.ok) run = chosen.state;
  }
  run = { ...run, config: { ...run.config, shifts: original.config.shifts } };
  const given = addItem(run, 'floorPermit');
  if (given.ok) {
    const used = spendFloorPermit(given.state);
    run = used.ok ? used.state : given.state;
  }
  return run;
}

/** 予算が足りない（ショップのパーツを買えない） */
const poor = (): RunState => ({ ...createRun(5), budget: 0 });

// ---- 画面サイズ ----

interface Viewport {
  name: string;
  width: number;
  height: number;
  /** ブラウザの拡大（200% は CSS の幅が半分・画素は2倍） */
  scale?: number;
}
const VIEWPORTS: Viewport[] = [
  { name: '1920x1080', width: 1920, height: 1080 },
  { name: '1366x768', width: 1366, height: 768 },
  { name: '1280x800', width: 1280, height: 800 },
  { name: '390x844', width: 390, height: 844 },
  { name: '1280x800-zoom200', width: 640, height: 400, scale: 2 },
];

// ---- 状態（操作） ----

/** Playwright の型（このリポジトリは Playwright に依存しないので、使う分だけ書く） */
interface Locator {
  click(): Promise<void>;
  first(): Locator;
  last(): Locator;
  isVisible(): Promise<boolean>;
  waitFor(options?: { timeout?: number }): Promise<void>;
  boundingBox(): Promise<{ x: number; y: number; width: number; height: number } | null>;
}
interface Page {
  locator(selector: string): Locator;
  mouse: { move(x: number, y: number): Promise<void>; click(x: number, y: number): Promise<void> };
  keyboard: { press(key: string): Promise<void> };
  waitForTimeout(ms: number): Promise<void>;
  goto(url: string): Promise<unknown>;
  addInitScript<T>(fn: (arg: T) => void, arg: T): Promise<void>;
  screenshot(options: { path: string; type?: 'jpeg' | 'png'; quality?: number }): Promise<unknown>;
  evaluate<R>(fn: () => R): Promise<R>;
  close(): Promise<void>;
}
interface Browser {
  newPage(options: {
    viewport: { width: number; height: number };
    deviceScaleFactor: number;
  }): Promise<Page>;
  close(): Promise<void>;
}
interface Scene {
  name: string;
  run: () => RunState;
  act?: (page: Page) => Promise<void>;
}

async function openInventory(page: Page) {
  const tab = page.locator('.tabs__tab').first();
  if (await tab.isVisible()) await tab.click();
}

async function clickCell(page: Page, x: number, y: number, hoverOnly = false) {
  const canvas = page.locator('.board-container canvas').first();
  const box = (await canvas.boundingBox())!;
  const px = box.x + (box.width * (x + 0.5 + 0.25)) / 7.5;
  const py = box.y + (box.height * (y + 0.5 + 0.25)) / 7.5;
  if (hoverOnly) await page.mouse.move(px, py);
  else await page.mouse.click(px, py);
}

async function trial(page: Page, waitDone = true) {
  await page.locator('.controls .button--secondary').first().click();
  if (waitDone) await page.locator('.playback-panel').waitFor({ timeout: 20000 });
}

const SCENES: Scene[] = [
  { name: 'idle', run: day1 },
  {
    name: 'selected',
    run: day1,
    act: async (page) => {
      await openInventory(page);
      await page.locator('[data-panel="inventory"] .item-button').first().click();
      await clickCell(page, 3, 3, true);
    },
  },
  { name: 'poor', run: poor },
  {
    name: 'trial-done',
    run: day1,
    act: async (page) => {
      await openInventory(page);
      await page.locator('[data-panel="inventory"] .item-button').first().click();
      await clickCell(page, 1, 3);
      await trial(page);
    },
  },
  {
    name: 'trial-then-changed',
    run: day1,
    act: async (page) => {
      await openInventory(page);
      await page.locator('[data-panel="inventory"] .item-button').first().click();
      await clickCell(page, 1, 3);
      await trial(page);
      await page.keyboard.press('Escape');
      await page
        .locator('.playback-panel button')
        .last()
        .click()
        .catch(() => {});
      await openInventory(page);
      await page.locator('[data-panel="inventory"] .item-button').first().click();
      await clickCell(page, 2, 3);
    },
  },
  {
    name: 'playing',
    run: day1,
    act: async (page) => {
      await openInventory(page);
      await page.locator('[data-panel="inventory"] .item-button').first().click();
      await clickCell(page, 1, 3);
      await trial(page, false);
      await page.waitForTimeout(700);
    },
  },
  {
    name: 'commit-failed',
    run: day1,
    act: async (page) => {
      await page.locator('.controls .button--primary').first().click();
      await page.locator('.commit-confirm .button--primary').click();
      await page.waitForTimeout(6000);
    },
  },
  { name: 'day3-floors', run: day3 },
];

// ---- 撮影 ----

const { chromium } = (await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright')) as {
  chromium: { launch(): Promise<Browser> };
};
const browser = await chromium.launch();
const report: string[] = [
  `# UI の確認（${phase}）`,
  '',
  `撮影: ${new Date().toISOString()}・${url}`,
  '',
  '| 画面サイズ | 言語 | 状態 | 横スクロール | ヘッダーのはみ出し | 画像 |',
  '|---|---|---|---|---|---|',
];

for (const viewport of VIEWPORTS) {
  for (const lang of ['ja', 'en'] as const) {
    for (const scene of SCENES) {
      // 英語と 200% 拡大は、主な状態だけ撮る（枚数を抑える）
      const main = scene.name === 'idle' || scene.name === 'day3-floors';
      if ((lang === 'en' || viewport.scale) && !main) continue;
      if (only && !only.test(`${viewport.name}-${lang}-${scene.name}`)) continue;
      const page = await browser.newPage({
        viewport: { width: viewport.width, height: viewport.height },
        deviceScaleFactor: viewport.scale ?? 1,
      });
      const settings = {
        version: 3,
        lang,
        effects: 'full',
        shake: true,
        reduceFlashes: false,
        masterVolume: 80,
        seVolume: 80,
        bgmVolume: 60,
        muted: true,
        tutorialDone: true,
      };
      const save = JSON.stringify(createSave(scene.run()));
      await page.addInitScript(
        ([s, v]: string[]) => {
          localStorage.setItem('chain-factory:settings', s!);
          localStorage.setItem('chain-factory:save', v!);
        },
        [JSON.stringify(settings), save],
      );
      await page.goto(url);
      await page.waitForTimeout(600);
      // タイトル画面から「続きから」で入る
      await page.locator('.title__actions .button--primary').click();
      await page.waitForTimeout(1200);
      let note = '';
      try {
        await scene.act?.(page);
      } catch (e) {
        note = `（操作に失敗: ${(e as Error).message.split('\n')[0]}）`;
      }
      await page.waitForTimeout(400);
      // リポジトリに置くので JPEG（画質 80）で軽くする
      const file = `${viewport.name}-${lang}-${scene.name}.jpg`;
      await page.screenshot({ path: join(outDir, file), type: 'jpeg', quality: 80 });
      const check = await page.evaluate(() => {
        const doc = document.documentElement;
        const header = document.querySelector('.app-header, header');
        const right = header ? header.getBoundingClientRect().right : 0;
        const overflowing = header
          ? [...header.querySelectorAll('*')].some(
              (el) => el.getBoundingClientRect().right > window.innerWidth + 1,
            )
          : false;
        return {
          hscroll: doc.scrollWidth > doc.clientWidth + 1,
          header: overflowing || right > window.innerWidth + 1,
        };
      });
      report.push(
        `| ${viewport.name} | ${lang} | ${scene.name}${note} | ${check.hscroll ? 'あり' : 'なし'} | ${check.header ? 'あり' : 'なし'} | [${file}](${file}) |`,
      );
      await page.close();
    }
  }
}
await browser.close();
writeFileSync(join(outDir, 'report.md'), report.join('\n') + '\n');
console.log(`wrote ${outDir}`);
