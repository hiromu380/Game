/**
 * UI アイコン（ボタンの文字の前に添える）。装飾なので読み上げない
 */
import { UI_ICONS, type UiIconName } from '../assets/manifest';

export function UiIcon({ name, size = 18 }: { name: UiIconName; size?: number }) {
  return (
    <img className="ui-icon" src={UI_ICONS[name]} width={size} height={size} alt="" aria-hidden />
  );
}
