import { execFileSync } from 'node:child_process';

const [base, head] = process.argv.slice(2);
if (!base || !head) {
  console.error('Usage: node .github/scripts/check-sim-version.mjs <base> <head>');
  process.exit(2);
}

function git(...args) {
  return execFileSync('git', args, { encoding: 'utf8' }).trim();
}

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
