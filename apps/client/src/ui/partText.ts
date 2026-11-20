/**
 * パーツの説明文
 *
 * 説明文中の数値（倍率など）は i18n に直書きせず、ルールの値を差し込む。
 * こうしておくと balance/ やボス修正で数値が変わっても、説明文が自動で追従する。
 */
import type { PartId, RuleSet } from '@chain-factory/sim';
import type { TranslateFn } from '../i18n';

/**
 * 係数が 1 のときは「×1」を書かない短い文にするパーツ（係数のパラメーター名）。
 * レリックなどで係数が 1 でなくなったら、係数入りの文に戻る
 */
const SIMPLE_WHEN_ONE = {
  press: 'pressPerNeighbor',
  coil: 'coilPerNeighbor',
  solar: 'solarPerEmpty',
  magnet: 'magnetPerDock',
} as const;

export function describePart(t: TranslateFn, partId: PartId, rules: RuleSet): string {
  const p = rules.params;
  const simpleParam = SIMPLE_WHEN_ONE[partId as keyof typeof SIMPLE_WHEN_ONE];
  const key =
    simpleParam && p[simpleParam] === 1
      ? (`part.${partId}.descSimple` as const)
      : (`part.${partId}.desc` as const);
  return t(key as `part.${PartId}.desc`, {
    ...p,
    maxIncomePerSim: rules.maxIncomePerSim,
    switchSignalValue: rules.switchSignalValue,
    // ポンコツロボの倍率は「整数 ÷ 整数」で持っているので、表示用に小数へ直す
    junkbotMin: p.junkbotMinSteps / p.junkbotStepDivisor,
    junkbotMax: p.junkbotMaxSteps / p.junkbotStepDivisor,
  });
}
