/**
 * パーツの説明文
 *
 * 説明文中の数値（倍率など）は i18n に直書きせず、ルールの値を差し込む。
 * こうしておくと balance.ts やボス修正で数値が変わっても、説明文が自動で追従する。
 */
import type { PartId, RuleSet } from '@chain-factory/sim';
import type { TranslateFn } from '../i18n';

export function describePart(t: TranslateFn, partId: PartId, rules: RuleSet): string {
  return t(`part.${partId}.desc`, { ...rules.params, maxIncomePerSim: rules.maxIncomePerSim });
}
