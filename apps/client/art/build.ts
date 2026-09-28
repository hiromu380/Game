/**
 * 素材を書き出す: pnpm --filter @chain-factory/client art
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildArt } from './index';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const files = buildArt();
for (const [relative, content] of Object.entries(files)) {
  const file = join(root, relative);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, content);
}
console.log(`wrote ${Object.keys(files).length} files`);
