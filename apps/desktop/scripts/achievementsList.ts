/**
 * Steamworks に登録する実績・統計の一覧を作る（人が管理画面に入力するための表）
 *
 * 定義は packages/sim の ACHIEVEMENTS、名前・説明は apps/client の i18n から取る（二重管理しない）。
 * 生成物は docs/ops/steam-achievements-list.md。定義や文言を変えたら書き出し直す（テストでずれを検出する）。
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ACHIEVEMENTS, type AchievementCondition } from '@chain-factory/sim';

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..');
export const OUTPUT_PATH = join(root, 'docs/ops/steam-achievements-list.md');

type Messages = Record<string, string>;
const readMessages = (lang: string): Messages =>
  JSON.parse(readFileSync(join(root, `apps/client/src/i18n/${lang}.json`), 'utf8')) as Messages;

/** 進捗バーの上限（回数系の条件だけ。Steamworks で統計と結びつける） */
function progressMax(condition: AchievementCondition): number | null {
  switch (condition.kind) {
    case 'record':
      return condition.record === 'totalShipped' ? null : condition.atLeast;
    case 'dailyDays':
      return condition.atLeast;
    default:
      return null;
  }
}

const cell = (text: string) => text.replace(/\|/g, '\\|');

export function buildAchievementsDoc(): string {
  const ja = readMessages('ja');
  const en = readMessages('en');
  const lines = [
    '# Steamworks 登録用: 実績・統計の一覧（自動生成）',
    '',
    '<!-- このファイルは `pnpm --filter @chain-factory/desktop achievements:export` で生成する。手で編集しない -->',
    '',
    '登録の手順は docs/ops/steam-achievements.md。API 名は大文字小文字を含めてそのまま入力する。',
    '',
    '## 実績',
    '',
    '| API 名 | 名前（日本語） | 説明（日本語） | 名前（English） | 説明（English） | 隠し | 進捗の統計 |',
    '| --- | --- | --- | --- | --- | --- | --- |',
  ];
  for (const a of ACHIEVEMENTS) {
    const max = progressMax(a.condition);
    const stat = 'progressStat' in a && max !== null ? `${a.progressStat}（0〜${max}）` : '';
    lines.push(
      `| ${a.id} | ${cell(ja[`achievement.${a.id}.name`] ?? '')} | ${cell(ja[`achievement.${a.id}.desc`] ?? '')} | ${cell(en[`achievement.${a.id}.name`] ?? '')} | ${cell(en[`achievement.${a.id}.desc`] ?? '')} | ${a.hidden ? 'はい' : ''} | ${stat} |`,
    );
  }
  lines.push(
    '',
    '## 統計（回数系のみ）',
    '',
    '| API 名 | 型 | 既定値 | 最小 | 増加のみ | 内容 |',
    '| --- | --- | --- | --- | --- | --- |',
    '| STAT_RUNS | INT | 0 | 0 | はい | 遊んだランの回数 |',
    '| STAT_FULL_CLEARS | INT | 0 | 0 | はい | 全シフトをクリアした回数 |',
    '| STAT_DAILY_DAYS | INT | 0 | 0 | はい | デイリーに参加した日数 |',
    '',
  );
  return lines.join('\n');
}
