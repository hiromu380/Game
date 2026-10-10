/**
 * 同梱フォントのサブセット化（日本語の字形で表示するため。端末のフォントに頼らない）
 *
 *   PYFTSUBSET=<pyftsubset のパス> node scripts/fonts.mjs
 *
 * - 見出し・作品名: しっぽり明朝（Shippori Mincho）／本文・金額: 禅角ゴシック New（Zen Kaku Gothic New）
 *   どちらも SIL Open Font License 1.1（src/assets/fonts/OFL.txt）
 * - 収録する文字: src/ と index.html の文字（コメントは除く）+ 英数字記号 + ひらがな・カタカナ全部
 * - TTF は Google Fonts から取得する（scripts/.cache。git 管理外）
 * 文言を変えたら実行し直す（新しい漢字が入っていないとテストが失敗する: test/fonts.test.ts）
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const outDir = join(root, 'src/assets/fonts');
const cacheDir = join(here, '.cache');

export const FONTS = [
  { family: 'Shippori Mincho', file: 'shippori-mincho', weights: [700] },
  { family: 'Zen Kaku Gothic New', file: 'zen-kaku-gothic-new', weights: [500, 700] },
];

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|html|css)$/.test(name)) out.push(p);
  }
  return out;
}

/** コメント（/* … *\/・行末の // …・<!-- … -->）を取り除く */
function stripComments(text) {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/(^|[^:'"`])\/\/.*$/gm, '$1');
}

/** 収録する文字 */
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
  for (const c of '×÷±→←↑↓…・〜￥▸▶◀★☆○●◎') chars.add(c);
  for (const file of [...walk(join(root, 'src')), join(root, 'index.html')]) {
    for (const c of stripComments(readFileSync(file, 'utf8'))) if (c.codePointAt(0) > 0x7e) chars.add(c);
  }
  for (const c of ['\n', '\r', '\t']) chars.delete(c);
  return [...chars].sort((a, b) => a.codePointAt(0) - b.codePointAt(0)).join('');
}

async function fetchTtf(family, weight) {
  mkdirSync(cacheDir, { recursive: true });
  const file = join(cacheDir, `${family.replace(/ /g, '-')}-${weight}.ttf`);
  if (existsSync(file)) return file;
  const css = await (
    await fetch(`https://fonts.googleapis.com/css2?family=${family.replace(/ /g, '+')}:wght@${weight}`, {
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
  const pyftsubset = process.env.PYFTSUBSET ?? 'pyftsubset';
  for (const font of FONTS) {
    for (const weight of font.weights) {
      const ttf = await fetchTtf(font.family, weight);
      const out = join(outDir, `${font.file}-${weight}.woff2`);
      execFileSync(pyftsubset, [ttf, `--text-file=${join(here, 'charset.txt')}`, '--flavor=woff2', '--layout-features=*', '--no-hinting', `--output-file=${out}`]);
      console.log(`${out}: ${Math.round(statSync(out).size / 1024)} KB`);
    }
  }
  console.log(`${[...charset].length} 文字`);
}
