/**
 * けがの部位の書き方（文言は i18n から）
 */
import type { InjuryPart, Wound } from '@ichimon/sim';
import type { MessageKey, TranslateFn } from './i18n';

export function partName(t: TranslateFn, part: InjuryPart): string {
  return t(`injury.part.${part}` as MessageKey);
}

/** 「右膝」「腰」 */
export function woundName(t: TranslateFn, w: Pick<Wound, 'part' | 'side'>): string {
  const part = partName(t, w.part);
  return w.side ? t(`injury.side.${w.side}` as MessageKey, { part }) : part;
}
