import { describe, expect, it } from 'vitest';
import { boutScript, poseAt } from '../src/playback/boutScript';
import { parseSettings } from '../src/save';

describe('取組の演出の台本', () => {
  it('同じ取組なら同じ動き', () => {
    expect(boutScript('yorikiri', 'E', 42)).toEqual(boutScript('yorikiri', 'E', 42));
  });

  it('押し出し・寄り切り: 負けた側が土俵の外（半径 1 より外）で終わる', () => {
    for (const k of ['oshidashi', 'yorikiri', 'okuridashi', 'tsuridashi']) {
      for (const w of ['E', 'W'] as const) {
        const s = boutScript(k, w, 7);
        const end = poseAt(s, s.duration);
        const loser = w === 'E' ? end.west : end.east;
        const winner = w === 'E' ? end.east : end.west;
        expect(Math.hypot(loser.x, loser.y)).toBeGreaterThan(1);
        expect(Math.hypot(winner.x, winner.y)).toBeLessThan(1);
      }
    }
  });

  it('投げ・はたき: 負けた側が倒れる（大きく傾く）', () => {
    for (const k of ['uwatenage', 'hatakikomi', 'kotenage']) {
      const s = boutScript(k, 'W', 3);
      const end = poseAt(s, s.duration);
      expect(Math.abs(end.east.rot)).toBeGreaterThan(45);
      expect(Math.abs(end.west.rot)).toBe(0);
    }
  });

  it('始まりは拍子木、最初は東が右・西が左', () => {
    const s = boutScript('oshidashi', 'E', 1);
    expect(s.frames[0]!.sound).toBe('clap');
    const p = poseAt(s, 0);
    expect(p.east.x).toBeGreaterThan(0);
    expect(p.west.x).toBeLessThan(0);
  });
});

describe('ユーザー設定', () => {
  it('版1（言語だけ）は効果音を入れて版2にする。壊れていれば既定', () => {
    expect(parseSettings(JSON.stringify({ version: 1, lang: 'en' }))).toEqual({
      version: 2,
      lang: 'en',
      sound: true,
    });
    expect(parseSettings(JSON.stringify({ version: 2, lang: 'ja', sound: false })).sound).toBe(
      false,
    );
    expect(parseSettings('{oops')).toEqual({ version: 2, lang: 'ja', sound: true });
  });
});
