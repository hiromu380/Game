/**
 * 同梱フォントのサブセット化（M PLUS Rounded 1c・SIL Open Font License 1.1）
 *
 *   node tools/fonts/subset.mjs
 *
 * 1. 収録する文字を集める: i18n の全文言 + 英数字記号 + ひらがな・カタカナ全部 + よく使う記号
 *    → tools/fonts/charset.txt（テストで「i18n の文字がすべて入っているか」を確かめる）
 * 2. フォントの TTF を Google Fonts から取得する（tools/fonts/.cache。git 管理外。リポジトリには入れない）
 * 3. pyftsubset（fonttools。`pip install fonttools brotli`）で太さごとに woff2 を作る
 *    → apps/client/src/assets/fonts/（ライセンス文 OFL.txt と一緒に同梱する）
 *
 * i18n の文言を変えたら実行し直す（新しい漢字が入っていないとテストが失敗する）。
 * 表示名など収録外の文字は、端末の日本語フォントで表示される（config/fonts.ts の FONT_STACK）。
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '../..');
const outDir = join(root, 'apps/client/src/assets/fonts');
const cacheDir = join(here, '.cache');
const FAMILY = 'M PLUS Rounded 1c';
const WEIGHTS = [400, 800];

/** 収録する文字 */
export function collectCharset() {
  const chars = new Set();
  const addRange = (from, to) => {
    for (let c = from; c <= to; c++) chars.add(String.fromCodePoint(c));
  };
  addRange(0x20, 0x7e); // 英数字・記号
  addRange(0x3000, 0x303f); // 句読点・かっこ（、。「」など）
  addRange(0x3041, 0x309f); // ひらがな
  addRange(0x30a0, 0x30ff); // カタカナ
  addRange(0xff01, 0xff5e); // 全角英数字・記号
  for (const c of '×÷±→←↑↓…・〜￥─━│┃※○●◎△▲▽▼□■◇◆★☆♪') chars.add(c);
  for (const lang of ['ja', 'en']) {
    const messages = JSON.parse(
      readFileSync(join(root, `apps/client/src/i18n/${lang}.json`), 'utf8'),
    );
    for (const text of Object.values(messages)) for (const c of text) chars.add(c);
  }
  chars.delete('\n');
  return [...chars].sort((a, b) => a.codePointAt(0) - b.codePointAt(0)).join('');
}

/** Google Fonts から TTF の URL を得て取得する（古いブラウザの User-Agent にすると TTF の URL が返る） */
async function fetchTtf(weight) {
  mkdirSync(cacheDir, { recursive: true });
  const file = join(cacheDir, `${weight}.ttf`);
  if (existsSync(file)) return file;
  const css = await (
    await fetch(
      `https://fonts.googleapis.com/css2?family=${FAMILY.replace(/ /g, '+')}:wght@${weight}`,
      { headers: { 'User-Agent': 'Mozilla/4.0' } },
    )
  ).text();
  const url = /url\((https:[^)]+\.ttf)\)/.exec(css)?.[1];
  if (!url) throw new Error(`TTF の URL が見つかりません: ${css.slice(0, 200)}`);
  writeFileSync(file, Buffer.from(await (await fetch(url)).arrayBuffer()));
  return file;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const charset = collectCharset();
  writeFileSync(join(here, 'charset.txt'), `${charset}\n`);
  mkdirSync(outDir, { recursive: true });
  const pyftsubset = process.env.PYFTSUBSET ?? 'pyftsubset';
  for (const weight of WEIGHTS) {
    const ttf = await fetchTtf(weight);
    const out = join(outDir, `m-plus-rounded-1c-${weight}.woff2`);
    execFileSync(pyftsubset, [
      ttf,
      `--text-file=${join(here, 'charset.txt')}`,
      '--flavor=woff2',
      '--layout-features=*',
      '--no-hinting',
      `--output-file=${out}`,
    ]);
    console.log(`${out}: ${Math.round(statSync(out).size / 1024)} KB`);
  }
  console.log(`${[...charset].length} 文字`);
}
