import { sprite } from './sprites';

/** 画面のアイコン（取り込んだ絵 ui_*。20×20 を2倍で）。取り込んでいなければ何も出さない。飾りなので読み上げない */
export function Icon({ id, scale = 1 }: { id: string; scale?: number }) {
  const s = sprite(id);
  if (!s) return null;
  return (
    <img
      className="ui-icon"
      src={s.url}
      alt=""
      aria-hidden="true"
      width={s.size[0] * scale}
      height={s.size[1] * scale}
    />
  );
}
