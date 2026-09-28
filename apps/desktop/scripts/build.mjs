/**
 * デスクトップ版のビルド
 *   node scripts/build.mjs --edition full|demo [--skip-client]
 *
 * 1. ゲーム本体（apps/client）を、API の場所と版を指定してビルドし、apps/desktop/renderer に出力する
 * 2. メインプロセスと preload を esbuild で1ファイルずつにまとめる（設定は define で埋め込む）
 */
import { execFileSync } from 'node:child_process';
import { rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { EDITIONS } from '../editions.config.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const editionName = args[args.indexOf('--edition') + 1] ?? 'full';
const config = EDITIONS[editionName];
if (!config) throw new Error(`unknown edition: ${editionName}`);

if (!args.includes('--skip-client')) {
  const outDir = join(root, 'renderer');
  rmSync(outDir, { recursive: true, force: true });
  execFileSync(
    'pnpm',
    [
      '--filter',
      '@chain-factory/client',
      'exec',
      'vite',
      'build',
      '--outDir',
      outDir,
      '--emptyOutDir',
    ],
    {
      stdio: 'inherit',
      env: { ...process.env, VITE_EDITION: config.edition, VITE_API_BASE: config.apiOrigin },
    },
  );
}

const common = {
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node22',
  // electron は実行環境が持っている。steamworks-ffi-node は FFI のため束ねずに node_modules から読む
  external: ['electron', 'steamworks-ffi-node'],
  logLevel: 'info',
};
await build({
  ...common,
  entryPoints: [join(root, 'src/main/index.ts')],
  outfile: join(root, 'dist/main.cjs'),
  define: { __DESKTOP_CONFIG__: JSON.stringify(config) },
});
await build({
  ...common,
  entryPoints: [join(root, 'src/preload/index.ts')],
  outfile: join(root, 'dist/preload.cjs'),
});
console.log(`built desktop (${editionName})`);
