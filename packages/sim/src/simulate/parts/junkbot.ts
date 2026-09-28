/**
 * ポンコツロボ: シード乱数で決まる方向（上下左右のいずれか）へ、シード乱数で決まる倍率を掛けて送る
 *
 * 倍率は ×0.5〜×3（0.5 刻み。balance/ の junkbot* で変更できる）。小さくなることもある「賭け」のパーツ。
 * 乱数は「方向 → 倍率」の順に引く（順番を変えると同じシードでも結果が変わるので、変えるときは SIM_VERSION を上げる）。
 */
import { ALL_DIR4, dir4ToDir8 } from '../../core/direction';
import { scoreDiv, scoreMul } from '../../core/score';
import type { PartBehavior } from './types';

export const junkbotBehavior: PartBehavior = {
  react: ({ value, rng, rules }) => {
    const dir = ALL_DIR4[rng.nextInt(ALL_DIR4.length)]!;
    const { junkbotMinSteps, junkbotMaxSteps, junkbotStepDivisor } = rules.params;
    const steps = junkbotMinSteps + rng.nextInt(junkbotMaxSteps - junkbotMinSteps + 1);
    // 先に掛けてから割る（切り捨ての誤差を小さくするため）
    const next = scoreDiv(scoreMul(value, steps), junkbotStepDivisor);
    return { emits: [{ dir: dir4ToDir8(dir), value: next }] };
  },
};
