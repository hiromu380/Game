/**
 * Steam のストア用の画像: 規定（capsules.json）の形・書き出しの検証・サイズごとの SVG
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import config from '../build/store/capsules.json';
import { readImageInfo, validateCapsule } from '../build/store/validate.mjs';
import { CAPSULE_IDS, capsuleFiles } from '../art/keyvisual/capsules';

const LOGO_HEAD = Buffer.from(
  readFileSync(join(__dirname, '../src/assets/logo/logo-dark-bg.svg')).subarray(0, 60),
).toString('base64');

/** 大きさだけ入った PNG のバイト列（シグネチャ + IHDR） */
function fakePng(width: number, height: number, size = 64): Uint8Array {
  const b = new Uint8Array(size);
  b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52]);
  new DataView(b.buffer).setUint32(16, width);
  new DataView(b.buffer).setUint32(20, height);
  return b;
}

/** 大きさだけ入った JPEG のバイト列（SOI + APP0 + SOF0） */
function fakeJpeg(width: number, height: number): Uint8Array {
  const app0 = [0xff, 0xe0, 0x00, 0x04, 0x00, 0x00];
  const sof = [
    0xff,
    0xc0,
    0x00,
    0x11,
    0x08,
    height >> 8,
    height & 0xff,
    width >> 8,
    width & 0xff,
    3,
  ];
  return new Uint8Array([0xff, 0xd8, ...app0, ...sof, ...new Array(16).fill(0)]);
}

describe('ストア用の画像の規定（capsules.json）', () => {
  it('必要な画像がそろい、大きさ・形式・容量の上限が正しい形', () => {
    const ids = config.capsules.map((c) => c.id);
    expect(ids).toEqual(
      expect.arrayContaining([
        'header',
        'small',
        'main',
        'vertical',
        'library',
        'hero',
        'background',
        'libraryLogo',
      ]),
    );
    expect(new Set(ids).size).toBe(ids.length);
    expect([...ids].sort()).toEqual([...CAPSULE_IDS].sort());
    expect(config.maxBytes).toBe(2 * 1024 * 1024);
    for (const c of config.capsules) {
      expect(c.width).toBeGreaterThan(0);
      expect(c.height).toBeGreaterThan(0);
      expect(['png', 'jpg']).toContain(c.format);
      expect(c.file.endsWith(`.${c.format}`)).toBe(true);
    }
  });

  it('Library Hero はロゴなしで、重要な要素の範囲（中央）を持つ。透過の画像は PNG', () => {
    const hero = config.capsules.find((c) => c.id === 'hero')!;
    expect(hero.logo).toBe(false);
    expect(hero.safeArea).toEqual([860, 380]);
    for (const c of config.capsules.filter((c) => 'transparent' in c && c.transparent)) {
      expect(c.format).toBe('png');
    }
  });
});

describe('書き出した画像の検証', () => {
  const spec = { file: 'header_capsule.png', width: 920, height: 430, format: 'png' };

  it('PNG・JPEG の形式と大きさを読む', () => {
    expect(readImageInfo(fakePng(920, 430))).toEqual({ format: 'png', width: 920, height: 430 });
    expect(readImageInfo(fakeJpeg(3840, 1240))).toEqual({
      format: 'jpg',
      width: 3840,
      height: 1240,
    });
    expect(readImageInfo(new Uint8Array([1, 2, 3]))).toBeNull();
  });

  it('規定どおりなら合格、大きさ・形式・容量が違えば理由を返す', () => {
    expect(validateCapsule(spec, fakePng(920, 430), 1024)).toEqual([]);
    expect(validateCapsule(spec, fakePng(921, 430), 1024)[0]).toContain('大きさ');
    expect(validateCapsule(spec, fakeJpeg(920, 430), 1024)[0]).toContain('形式');
    expect(validateCapsule(spec, fakePng(920, 430, 2048), 1024)[0]).toContain('容量');
    expect(validateCapsule(spec, new Uint8Array(10), 1024)[0]).toContain('読めない');
  });
});

describe('サイズごとの SVG（art/keyvisual/capsules.ts）', () => {
  const files = capsuleFiles();

  it('すべての画像に、規定と同じ大きさの SVG がある（書き出し済みのファイルとも一致）', () => {
    for (const c of config.capsules) {
      const path = `build/store/svg/${c.id}.svg`;
      expect(files[path], c.id).toContain(`viewBox="0 0 ${c.width} ${c.height}"`);
      expect(readFileSync(join(__dirname, '..', path), 'utf8')).toBe(files[path]);
    }
  });

  it('ロゴは規定どおりの画像にだけ入る（Library Hero・ページ背景には入れない）', () => {
    for (const c of config.capsules) {
      // ロゴの SVG の先頭 60 バイト（viewBox 0 0 253 90）を base64 にしたもの
      const hasLogo = files[`build/store/svg/${c.id}.svg`]!.includes(LOGO_HEAD);
      expect(hasLogo, c.id).toBe(c.logo);
    }
  });
});
