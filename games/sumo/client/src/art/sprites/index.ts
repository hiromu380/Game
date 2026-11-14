/**
 * 取り込んだドット絵（client/build/import-sprites.py が書き出す manifest.json と画像）
 */
import manifest from './manifest.json';

const urls = import.meta.glob<string>('../../assets/sprites/*.png', {
  eager: true,
  import: 'default',
});

export interface SpriteEntry {
  files: string[];
  size: [number, number];
  anchor: [number, number];
}

const entries = manifest as unknown as Record<string, SpriteEntry>;

/** 絵の大きさ・足元と、コマの画像の URL（まだ取り込んでいなければ null） */
export function sprite(name: string, frame = 0): (SpriteEntry & { url: string }) | null {
  const e = entries[name];
  const file = e?.files[frame];
  const url = file ? urls[`../../assets/sprites/${file}`] : undefined;
  return e && url ? { ...e, url } : null;
}
