/** 同じ外見と画角からは常に同じ画像キャッシュキーになる。 */
import type { Look } from './look';

export type PortraitVariant = 'bust' | 'full';
export function portraitKey(look: Look, variant: PortraitVariant): string {
  return `${variant}:${JSON.stringify(look)}`;
}
