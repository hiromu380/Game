import { execFileSync } from 'node:child_process';

const [requestedBase, head] = process.argv.slice(2);
if (!requestedBase || !head) {
  console.error('Usage: node .github/scripts/check-sim-version.mjs <base> <head>');
  process.exit(2);
}

function git(...args) {
  return execFileSync('git', args, { encoding: 'utf8' }).trim();
}

function tryGit(...args) {
  try {
    return execFileSync('git', args, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return null;
  }
}

/**
 * 比べる基準のコミット。強制プッシュ（履歴の書き換え）の後は、プッシュ前の先頭がチェックアウトに残っておらず
 * head とも共通の祖先を持たないことがあるので、そのときは既定のブランチ（origin/main）との分岐点で比べる
 */
function resolveBase() {
  if (tryGit('merge-base', requestedBase, head)) return requestedBase;
  const fallback = tryGit('merge-base', 'origin/main', head);
  if (fallback) {
    console.log(
      `Base ${requestedBase} is not reachable from ${head}; comparing with origin/main instead.`,
    );
    return fallback;
  }
  console.log(`Base ${requestedBase} is not reachable and origin/main is unavailable; skipping.`);
  process.exit(0);
}

const base = resolveBase();

const changedFiles = git('diff', '--name-only', `${base}...${head}`).split(/\r?\n/).filter(Boolean);
const behaviorChanged = changedFiles.some(
  (file) => /^packages\/sim\/src\/.*\.ts$/.test(file) && file !== 'packages/sim/src/version.ts',
);

if (!behaviorChanged) {
  console.log('No simulation behavior files changed.');
  process.exit(0);
}

function simVersion(revision) {
  const source = git('show', `${revision}:packages/sim/src/version.ts`);
  const match = source.match(/export const SIM_VERSION = '(\d+)';/);
  if (!match) throw new Error(`Could not read SIM_VERSION from ${revision}`);
  return Number(match[1]);
}

const previous = simVersion(base);
const current = simVersion(head);
if (current <= previous) {
  console.error(
    `Simulation behavior changed, but SIM_VERSION did not increase (${previous} -> ${current}).`,
  );
  process.exit(1);
}

console.log(`SIM_VERSION increased: ${previous} -> ${current}`);
