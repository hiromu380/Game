/**
 * SteamPipe（steamcmd でのアップロード）用のビルド設定ファイルを作る
 *
 *   STEAM_APP_ID_FULL=... STEAM_DEPOT_ID_FULL=... node scripts/steampipe.mjs full [--preview]
 *   STEAM_APP_ID_DEMO=... STEAM_DEPOT_ID_DEMO=... node scripts/steampipe.mjs demo [--preview]
 *
 * steampipe/app_build.vdf.template の {{...}} を埋めて release/steampipe/app_build_<App ID>.vdf に書き出す。
 * アップロード自体は人が steamcmd で行う（docs/ops/steam-build.md）。App ID・Depot ID は秘密値ではないが、
 * Steamworks で発行されるまで決まらないので環境変数で渡す。--preview は「アップロードせずに内容だけ確認」
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const edition = process.argv[2];
if (edition !== 'full' && edition !== 'demo') {
  throw new Error('usage: node scripts/steampipe.mjs full|demo [--preview]');
}
const suffix = edition.toUpperCase();
const appId = process.env[`STEAM_APP_ID_${suffix}`];
const depotId = process.env[`STEAM_DEPOT_ID_${suffix}`];
if (!/^\d+$/.test(appId ?? '') || !/^\d+$/.test(depotId ?? '')) {
  throw new Error(`STEAM_APP_ID_${suffix} と STEAM_DEPOT_ID_${suffix} に数字を指定してください`);
}

const outDir = join(root, 'release/steampipe');
mkdirSync(outDir, { recursive: true });
const version = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).version;
const values = {
  APP_ID: appId,
  DEPOT_ID: depotId,
  DESC: `Chain Factory ${edition} ${version}`,
  // steamcmd はこのファイルの場所からの相対パスで解釈する
  BUILD_OUTPUT: './output/',
  CONTENT_ROOT: `../${edition}/win-unpacked/`,
  PREVIEW: process.argv.includes('--preview') ? '1' : '0',
};
const vdf = readFileSync(join(root, 'steampipe/app_build.vdf.template'), 'utf8').replace(
  /\{\{(\w+)\}\}/g,
  (_, key) => values[key],
);
const file = join(outDir, `app_build_${appId}.vdf`);
writeFileSync(file, vdf);
console.log(`wrote ${file}`);
