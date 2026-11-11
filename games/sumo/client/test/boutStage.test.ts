import { describe, expect, it } from 'vitest';
import { BOUT_STAGE, boutSprites, stageShake } from '../src/playback/boutStage';
import { boutFlow, boutScript, poseAt } from '../src/playback/boutScript';
import { personPixels } from '../src/art/hakoniwa/people';

describe('取組の舞台（ドット絵）', () => {
  const script = (seed: number, kimarite: string, winner: 'E' | 'W') =>
    boutScript(boutFlow({ kimarite, winner, eastStyle: 'oshi', westStyle: 'yotsu', seed }), seed);

  it('仕切り → 押し合い → 決着。向き合って立ち、行司は勝った方へ軍配を上げる', () => {
    const s = script(11, 'yorikiri', 'E');
    const clash = s.frames[1]!.t;
    const at = (time: number, winner: 'E' | 'W' | null) =>
      boutSprites({ pose: poseAt(s, time), time, clash, winner });
    const start = at(0, null);
    expect(start.map((x) => x.who)[0]).toBe('gyoji');
    const w = start.find((x) => x.who === 'W')!;
    const e = start.find((x) => x.who === 'E')!;
    expect(w.pose).toBe('shikiri');
    expect(w.x).toBeLessThan(e.x);
    // 西は右を、東は左を向く
    expect(w.flip).toBe(true);
    expect(e.flip).toBe(false);
    const mid = at(clash + 0.05, null);
    expect(mid.find((x) => x.who === 'E')!.pose).toBe('push');
    const end = at(s.duration, 'E');
    expect(end.find((x) => x.who === 'gyoji')).toMatchObject({ frame: 1, flip: true });
    expect(end.find((x) => x.who === 'E')!.pose).toBe('idle');
  });

  it('どの決まり手でも、絵は舞台の中に収まる', () => {
    const { width, height } = BOUT_STAGE;
    for (const [i, k] of [
      'oshidashi',
      'uwatenage',
      'hatakikomi',
      'utchari',
      'isamiashi',
    ].entries()) {
      for (const winner of ['E', 'W'] as const) {
        const s = script(20 + i, k, winner);
        for (let time = 0; time <= s.duration; time += 0.1) {
          for (const sp of boutSprites({
            pose: poseAt(s, time),
            time,
            clash: s.frames[1]!.t,
            winner: time >= s.finishAt ? winner : null,
          })) {
            expect(sp.x, `${k} x`).toBeGreaterThan(16);
            expect(sp.x, `${k} x`).toBeLessThan(width - 16);
            expect(sp.y, `${k} y`).toBeGreaterThan(40);
            expect(sp.y, `${k} y`).toBeLessThan(height - 2);
          }
        }
      }
    }
  });

  it('当たった瞬間と決まった瞬間だけ揺れる', () => {
    expect(stageShake(0.2, 0.6, 3)).toBe(0);
    expect(stageShake(0.61, 0.6, 3)).not.toBe(0);
    expect(stageShake(1.5, 0.6, 3)).toBe(0);
    expect(stageShake(3.1, 0.6, 3)).not.toBe(0);
  });

  it('仕切りと行司の絵がある。締め込みの色で絵が変わる', () => {
    const base = { frame: 0, skin: 1, mawashi: 'black', hair: 'mage', build: 1 } as const;
    const filled = (d: Uint8ClampedArray) => d.filter((_, i) => i % 4 === 3 && d[i]! > 0).length;
    expect(filled(personPixels({ ...base, pose: 'shikiri' }).data)).toBeGreaterThan(80);
    const down = personPixels({ ...base, pose: 'gyoji', frame: 0 }).data;
    const up = personPixels({ ...base, pose: 'gyoji', frame: 1 }).data;
    expect(Buffer.from(down).equals(Buffer.from(up))).toBe(false);
    const plain = personPixels({ ...base, pose: 'push' }).data;
    const colored = personPixels({ ...base, pose: 'push', cloth: '#5b3d6e' }).data;
    expect(Buffer.from(plain).equals(Buffer.from(colored))).toBe(false);
  });
});
