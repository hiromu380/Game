import { describe, expect, it } from 'vitest';
import { KIMARITE } from '@ichimon/sim';
import { makeT, type MessageKey } from '../src/i18n';
import { boutFlow, boutScript, linesAt, poseAt, type Side } from '../src/playback/boutScript';
import { DEFAULT_SETTINGS, parseSettings } from '../src/save';

const STYLES = ['oshi', 'yotsu', 'waza'] as const;

function scriptFor(kimarite: string, winner: Side, seed: number, styles = STYLES) {
  const flow = boutFlow({
    kimarite,
    winner,
    eastStyle: styles[seed % 3]!,
    westStyle: styles[(seed + 1) % 3]!,
    seed,
  });
  return { flow, script: boutScript(flow, seed) };
}

describe('取組の演出の台本', () => {
  it('同じ取組なら同じ流れ・同じ動き', () => {
    expect(scriptFor('yorikiri', 'E', 42)).toEqual(scriptFor('yorikiri', 'E', 42));
  });

  it('押し・寄り・吊り・送り: 負けた側が土俵の外、勝った側は中で終わる', () => {
    for (const k of KIMARITE.filter((x) =>
      ['thrust', 'push', 'force', 'lift', 'behind'].includes(x.motion),
    )) {
      for (const w of ['E', 'W'] as const) {
        for (let seed = 1; seed < 30; seed++) {
          const { script } = scriptFor(k.id, w, seed);
          const end = poseAt(script, script.duration);
          const loser = w === 'E' ? end.west : end.east;
          const winner = w === 'E' ? end.east : end.west;
          expect(Math.abs(loser.x)).toBeGreaterThan(1);
          expect(Math.abs(winner.x)).toBeLessThan(1);
        }
      }
    }
  });

  it('投げ・捻り・掛け・はたき: 負けた側が倒れ、勝った側は立っている', () => {
    for (const k of KIMARITE.filter((x) =>
      ['throw', 'twist', 'trip', 'slapDown', 'backward', 'selfFall'].includes(x.motion),
    )) {
      const { script } = scriptFor(k.id, 'W', 3);
      const end = poseAt(script, script.duration);
      expect(Math.abs(end.east.rot)).toBeGreaterThan(45);
      expect(Math.abs(end.west.rot)).toBeLessThan(30);
    }
  });

  it('逆転の技: 攻めた側（負けた側）が先に前に出る。うっちゃりは勝った側の後ろへ落ちる', () => {
    const { flow, script } = scriptFor('utchari', 'E', 5);
    expect(flow.beats.find((b) => b.kind === 'pressIn')!.by).toBe('W');
    const end = poseAt(script, script.duration);
    expect(end.west.x).toBeGreaterThan(1);
    expect(end.east.x).toBeLessThan(1);
    const isami = scriptFor('isamiashi', 'W', 5).script;
    const e2 = poseAt(isami, isami.duration);
    expect(e2.east.x).toBeLessThan(-1);
  });

  it('始まりは拍子木と行司の掛け声、最初は東が右・西が左。決着の前に実況が流れる', () => {
    const { script } = scriptFor('oshidashi', 'E', 1);
    expect(script.frames[0]!.sound).toBe('clap');
    expect(script.lines[0]).toMatchObject({ key: 'bout.call.hakkeyoi', gyoji: true });
    const p = poseAt(script, 0);
    expect(p.east.x).toBeGreaterThan(0);
    expect(p.west.x).toBeLessThan(0);
    expect(linesAt(script, script.finishAt).at(-1)!.key).toBe('bout.finish.push');
    for (let i = 1; i < script.frames.length; i++)
      expect(script.frames[i]!.t).toBeGreaterThan(script.frames[i - 1]!.t);
  });

  it('82手と非技5つすべてに名前と分類があり、実況の行がどちらの言語でも文になる', () => {
    expect(KIMARITE).toHaveLength(87);
    for (const lang of ['ja', 'en'] as const) {
      const t = makeT(lang);
      for (const k of KIMARITE) {
        expect(t(`kimarite.${k.id}` as MessageKey)).not.toMatch(/^kimarite\./);
        expect(t(`kimarite.group.${k.group}` as MessageKey)).not.toMatch(/^kimarite\./);
        for (let seed = 1; seed < 8; seed++) {
          const { script } = scriptFor(k.id, seed % 2 ? 'E' : 'W', seed);
          for (const l of script.lines) {
            const text = t(l.key as MessageKey, { a: 'A', b: 'B' });
            expect(text).not.toMatch(/^bout\.|\{/);
          }
        }
      }
    }
  });
});

describe('ユーザー設定', () => {
  it('版1・2は版3に（版1は効果音を入れる。案内ははじめから）。壊れていれば既定', () => {
    expect(parseSettings(JSON.stringify({ version: 1, lang: 'en' }))).toEqual({
      ...DEFAULT_SETTINGS,
      lang: 'en',
    });
    expect(parseSettings(JSON.stringify({ version: 2, lang: 'ja', sound: false })).sound).toBe(
      false,
    );
    expect(parseSettings('{oops')).toEqual(DEFAULT_SETTINGS);
    const v3 = {
      ...DEFAULT_SETTINGS,
      guide: { dismissed: true, done: ['bout', 9], tips: ['ledger'] },
    };
    expect(parseSettings(JSON.stringify(v3)).guide).toEqual({
      dismissed: true,
      done: ['bout'],
      tips: ['ledger'],
    });
  });
});
