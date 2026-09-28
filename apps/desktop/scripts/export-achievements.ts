/**
 * Steamworks 登録用の実績・統計の一覧を書き出す
 *   pnpm --filter @chain-factory/desktop achievements:export
 */
import { writeFileSync } from 'node:fs';
import { buildAchievementsDoc, OUTPUT_PATH } from './achievementsList';

writeFileSync(OUTPUT_PATH, buildAchievementsDoc());
console.log(`wrote ${OUTPUT_PATH}`);
