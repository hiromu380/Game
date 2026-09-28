/**
 * ロゴ・実績アイコン用の文字（線で描く工業風のブロック体）
 *
 * 画像として読み込んだ SVG では Web フォントが使えないため、文字は線（path）で描く。
 * 1文字は高さ 24 の箱に収め、幅は文字ごと。太い線を2回重ねて「輪郭つきの文字」にする。
 */
import { INK } from '../src/assets/palette';
import { group, line } from './svg';

interface Glyph {
  width: number;
  d: string;
}

const GLYPHS: Record<string, Glyph> = {
  A: { width: 16, d: 'M1 24 L8 0 L15 24 M4 15 H12' },
  B: { width: 14, d: 'M2 24 V0 H8 a5.5 5.5 0 0 1 0 11 H2 H9 a6.5 6.5 0 0 1 0 13 Z' },
  C: { width: 15, d: 'M15 0 H7 a6 6 0 0 0 -6 6 V18 a6 6 0 0 0 6 6 H15' },
  F: { width: 14, d: 'M14 0 H2 V24 M2 12 H11' },
  H: { width: 15, d: 'M2 0 V24 M13 0 V24 M2 12 H13' },
  I: { width: 4, d: 'M2 0 V24' },
  M: { width: 18, d: 'M2 24 V0 L9 14 L16 0 V24' },
  N: { width: 15, d: 'M2 24 V0 L13 24 V0' },
  O: {
    width: 16,
    d: 'M6 0 H10 a6 6 0 0 1 6 6 V18 a6 6 0 0 1 -6 6 H6 a6 6 0 0 1 -6 -6 V6 a6 6 0 0 1 6 -6 Z',
  },
  R: { width: 15, d: 'M2 24 V0 H9 a6 6 0 0 1 0 12 H2 M8 12 L15 24' },
  T: { width: 16, d: 'M0 0 H16 M8 0 V24' },
  Y: { width: 16, d: 'M0 0 L8 12 L16 0 M8 12 V24' },
  '0': {
    width: 14,
    d: 'M5 0 H9 a5 5 0 0 1 5 5 V19 a5 5 0 0 1 -5 5 H5 a5 5 0 0 1 -5 -5 V5 a5 5 0 0 1 5 -5 Z',
  },
  '1': { width: 10, d: 'M2 5 L7 0 V24 M2 24 H11' },
  '2': { width: 14, d: 'M1 5 a6 5 0 0 1 12 1 q0 5 -13 18 H14' },
  '3': { width: 14, d: 'M1 1 H13 L6 10 a7 7 0 1 1 -6 11' },
  '5': { width: 14, d: 'M13 0 H2 L1 11 a7 7 0 1 1 0 11' },
  '7': { width: 14, d: 'M0 0 H14 L5 24' },
  '8': {
    width: 14,
    d: 'M7 11 a5 5.5 0 1 1 0 -11 a5 5.5 0 1 1 0 11 a6 6.5 0 1 1 0 13 a6 6.5 0 1 1 0 -13 Z',
  },
  '9': { width: 14, d: 'M13 8 a6 7 0 1 1 0 -1 V14 q0 10 -11 10' },
  '%': { width: 18, d: 'M16 0 L2 24 M4 2 a2.5 3 0 1 0 0.1 0 Z M14 17 a2.5 3 0 1 0 0.1 0 Z' },
  '×': { width: 12, d: 'M1 7 L11 17 M11 7 L1 17' },
  ' ': { width: 6, d: '' },
};

const SPACING = 5;

/** 文字列の幅（高さ 24 のとき） */
export function textWidth(text: string): number {
  return [...text].reduce((w, c, i) => w + GLYPHS[c]!.width + (i > 0 ? SPACING : 0), 0);
}

/**
 * 文字列を描く。(x, y) は左上、scale 倍（高さ 24 × scale）
 * fill: 文字の色、outline: 縁の色（null なら縁なし）
 */
export function lettering(
  text: string,
  options: {
    x: number;
    y: number;
    scale?: number;
    fill: string;
    outline?: string | null;
    weight?: number;
    anchor?: 'start' | 'middle';
  },
): string {
  const { scale = 1, fill, outline = INK.outline, weight = 5, anchor = 'start' } = options;
  const x = anchor === 'middle' ? options.x - (textWidth(text) * scale) / 2 : options.x;
  let cursor = 0;
  const glyphPaths: string[] = [];
  for (const c of text) {
    const glyph = GLYPHS[c];
    if (!glyph) throw new Error(`lettering: no glyph for "${c}"`);
    if (glyph.d) glyphPaths.push(`<path transform="translate(${cursor} 0)" d="${glyph.d}"/>`);
    cursor += glyph.width + SPACING;
  }
  const body = glyphPaths.join('');
  return group(
    { transform: `translate(${x} ${options.y}) scale(${scale})` },
    ...(outline ? [group(line(outline, weight + 4), body)] : []),
    group(line(fill, weight), body),
  );
}

/** 使える文字（テスト・確認用） */
export const LETTERING_CHARS = Object.keys(GLYPHS).join('');
