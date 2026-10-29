/**
 * 見出しフォントのサブセット化（Kaisei Tokumin ExtraBold・SIL Open Font License 1.1）
 *
 *   PYFTSUBSET=<pyftsubset の場所> node games/sumo/client/build/subset-font.mjs
 *
 * 収録する文字: i18n の全文言 + 四股名・年寄名に使う字（sim/src/core/names.ts）+ 英数字・かな・よく使う記号
 * TTF は Google Fonts から取得する（build/.font-cache。git 管理外）。出力は src/assets/fonts/ に OFL.txt と一緒に置く。
 * i18n の文言や名前の字を変えたら実行し直す（足りない字があるとテストが失敗する）。
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const client = join(here, '..');
const outDir = join(client, 'src/assets/fonts');
const cacheDir = join(here, '.font-cache');

export function collectCharset() {
  const chars = new Set();
  const addRange = (from, to) => {
    for (let c = from; c <= to; c++) chars.add(String.fromCodePoint(c));
  };
  addRange(0x20, 0x7e);
  addRange(0x3000, 0x303f);
  addRange(0x3041, 0x309f);
  addRange(0x30a0, 0x30ff);
  addRange(0xff01, 0xff5e);
  for (const c of '×÷±→←↑↓…・〜￥○●◎△▲▽▼□■◇◆★☆々〆') chars.add(c);
  for (const lang of ['ja', 'en']) {
    const messages = JSON.parse(readFileSync(join(client, `src/i18n/${lang}.json`), 'utf8'));
    for (const text of Object.values(messages)) for (const c of text) chars.add(c);
  }
  // 名前に使う字（配列の文字列リテラルの中の字を全部）
  const names = readFileSync(join(client, '../sim/src/core/names.ts'), 'utf8');
  for (const m of names.matchAll(/'([^']*)'/g)) for (const c of m[1]) chars.add(c);
  for (const c of '蒙御免番付東西幕内十両幕下三段目序二段序ノ口前頭小結関脇大関横綱') chars.add(c);
  chars.delete('\n');
  return [...chars].sort((a, b) => a.codePointAt(0) - b.codePointAt(0)).join('');
}

async function fetchTtf() {
  mkdirSync(cacheDir, { recursive: true });
  const file = join(cacheDir, 'kaisei-tokumin-800.ttf');
  if (existsSync(file)) return file;
  const css = await (
    await fetch('https://fonts.googleapis.com/css2?family=Kaisei+Tokumin:wght@800', {
      headers: { 'User-Agent': 'Mozilla/4.0' },
    })
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
  const out = join(outDir, 'kaisei-tokumin-800.woff2');
  execFileSync(process.env.PYFTSUBSET ?? 'pyftsubset', [
    await fetchTtf(),
    `--text-file=${join(here, 'charset.txt')}`,
    '--flavor=woff2',
    '--layout-features=*',
    '--no-hinting',
    `--output-file=${out}`,
  ]);
  console.log(`${out}: ${Math.round(statSync(out).size / 1024)} KB, ${[...charset].length} 文字`);
}
