import { describe, expect, it } from 'vitest';
import { createGame, type GameState } from '@ichimon/sim';
import { compoundCast, keikobaCast, KEIKOBA_SPOTS } from '../src/art/hakoniwa/actors';
import { FOOT, PERSON, personPixels, type Pose } from '../src/art/hakoniwa/people';
import { VOICE_VARIANTS, voiceOf, type VoiceKind } from '../src/voice';
import ja from '../src/i18n/ja.json';
import en from '../src/i18n/en.json';
import { play } from '../../sim/test/play';

function mine(g: GameState) {
  return g.rikishi.filter((r) => r.stableId === g.player.stableId);
}

describe('箱庭の人（ドット絵）', () => {
  const poses: Pose[] = [
    'idle',
    'shiko',
    'teppo',
    'suriashi',
    'push',
    'sit',
    'lie',
    'oyakata',
    'oyakataSit',
    'sweep',
  ];
  it('どの姿も枠に収まり、足元の近くに絵がある。2コマは違う絵', () => {
    for (const pose of poses) {
      const look = { pose, skin: 1, mawashi: 'black', hair: 'mage', build: 1 } as const;
      const a = personPixels({ ...look, frame: 0 });
      const b = personPixels({ ...look, frame: 1 });
      expect(a.width).toBe(PERSON.width);
      expect(a.height).toBe(PERSON.height);
      let filled = 0;
      for (let i = 3; i < a.data.length; i += 4) if (a.data[i]! > 0) filled++;
      expect(filled, pose).toBeGreaterThan(60);
      // 足元の行のあたりに不透明な点がある（宙に浮かない）
      let foot = 0;
      for (let y = FOOT.y - 3; y <= FOOT.y + 1; y++)
        for (let x = 0; x < a.width; x++) if (a.data[(y * a.width + x) * 4 + 3]! > 0) foot++;
      expect(foot, pose).toBeGreaterThan(0);
      if (pose !== 'lie' && pose !== 'sit' && pose !== 'oyakataSit')
        expect(Buffer.from(a.data).equals(Buffer.from(b.data)), pose).toBe(false);
    }
  });

  it('同じ見た目は同じ絵（左右の反転は別の絵）', () => {
    const look = {
      pose: 'teppo',
      frame: 0,
      skin: 0,
      mawashi: 'white',
      hair: 'mage',
      build: 2,
    } as const;
    expect(personPixels(look)).toBe(personPixels({ ...look }));
    expect(
      Buffer.from(personPixels(look).data).equals(
        Buffer.from(personPixels({ ...look, flip: true }).data),
      ),
    ).toBe(false);
  });
});

describe('箱庭の人の配置', () => {
  it('稽古場: 弟子は1人1か所。けが人は出ず、親方が座敷にいる', () => {
    const g = play(5, 8);
    const hurt = mine(g)[0]!;
    hurt.injury = 2;
    const { keikoba, overflow } = keikobaCast(g);
    const ids = keikoba.flatMap((a) => (a.rikishiId === null ? [] : [a.rikishiId]));
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).not.toContain(hurt.id);
    expect(keikoba.filter((a) => a.rikishiId === null)).toHaveLength(1);
    expect(ids.length + overflow.length).toBe(mine(g).length - 1);
    // 足元が重ならない
    const feet = new Set(keikoba.map((a) => `${a.x},${a.y}`));
    expect(feet.size).toBe(keikoba.length);
  });

  it('稽古の方針で、することが変わる（押し→鉄砲、休養→見取り）', () => {
    const g = createGame({ seed: 3 });
    const rs = mine(g);
    for (const r of rs) {
      r.policy = 'body';
      r.injury = 0;
    }
    rs[0]!.policy = 'oshi';
    if (rs[1]) rs[1].policy = 'rest';
    const { keikoba } = keikobaCast(g);
    const pose = (id: number) => keikoba.find((a) => a.rikishiId === id)?.look.pose;
    expect(pose(rs[0]!.id)).toBe('teppo');
    if (rs[1]) expect(pose(rs[1].id)).toBe('sit');
    for (const r of rs.slice(2)) expect(['shiko', undefined]).toContain(pose(r.id));
  });

  it('申し合いは2人そろったときだけ（1人なら四股）', () => {
    const g = createGame({ seed: 3 });
    const rs = mine(g);
    for (const r of rs) {
      r.policy = 'body';
      r.injury = 0;
    }
    rs[0]!.policy = 'yotsu';
    expect(keikobaCast(g).keikoba.some((a) => a.look.pose === 'push')).toBe(false);
    if (rs[1]) {
      rs[1].policy = 'yotsu';
      const push = keikobaCast(g).keikoba.filter((a) => a.look.pose === 'push');
      expect(push).toHaveLength(KEIKOBA_SPOTS.ring.length);
    }
  });

  it('その週の行動の場面: 申し合いは2人が土俵、個別指導は親方が向かい、胸を借りるはよその関取', () => {
    const g = play(5, 8);
    const rs = mine(g);
    for (const r of rs) r.injury = 0;
    const [a, b] = [rs[rs.length - 1]!, rs[rs.length - 2]!];
    const ring = (c: ReturnType<typeof keikobaCast>) =>
      c.keikoba.filter((x) => KEIKOBA_SPOTS.ring.some((s) => s.x === x.x && s.y === x.y));
    const spar = ring(keikobaCast(g, KEIKOBA_SPOTS, { kind: 'spar', a: a.id, b: b.id }));
    expect(spar.map((x) => x.rikishiId)).toEqual([a.id, b.id]);
    const coach = keikobaCast(g, KEIKOBA_SPOTS, { kind: 'coach', id: a.id }).keikoba;
    expect(ring({ keikoba: coach, overflow: [] }).map((x) => x.key)).toEqual([
      `r${a.id}`,
      'oyakata',
    ]);
    expect(coach.filter((x) => x.key === 'oyakata')).toHaveLength(1);
    const mune = ring(keikobaCast(g, KEIKOBA_SPOTS, { kind: 'mune', id: a.id }));
    expect(mune[1]).toMatchObject({ guest: true, rikishiId: null });
    // 弟子は1人1か所のまま
    const ids = coach.flatMap((x) => (x.rikishiId === null ? [] : [x.rikishiId]));
    expect(new Set(ids).size).toBe(ids.length);
    // けがで出られない週は、ふだんの稽古場
    a.injury = 2;
    expect(keikobaCast(g, KEIKOBA_SPOTS, { kind: 'coach', id: a.id })).toEqual(keikobaCast(g));
  });

  it('休ませる週は座って休み、出稽古の週は留守（稽古場に誰もいない）', () => {
    const g = play(5, 8);
    for (const r of mine(g)) r.injury = 0;
    const rest = keikobaCast(g, KEIKOBA_SPOTS, { kind: 'rest' }).keikoba;
    expect(rest.filter((a) => a.rikishiId !== null).every((a) => a.look.pose === 'sit')).toBe(true);
    expect(rest.some((a) => a.key === 'oyakata')).toBe(true);
    const feet = new Set(rest.map((a) => `${a.x},${a.y}`));
    expect(feet.size).toBe(rest.length);
    expect(keikobaCast(g, KEIKOBA_SPOTS, { kind: 'degeiko' }).keikoba).toEqual([]);
  });

  it('外観: けが人は布団、弟子は1人1か所、親方が立つ', () => {
    const g = play(5, 8);
    const hurt = mine(g)[0]!;
    hurt.injury = 2;
    const cast = compoundCast(g);
    const ids = cast.flatMap((a) => (a.rikishiId === null ? [] : [a.rikishiId]));
    expect(new Set(ids).size).toBe(ids.length);
    expect(cast.find((a) => a.rikishiId === hurt.id)?.look.pose).toBe('lie');
    expect(cast.filter((a) => a.rikishiId === null)).toHaveLength(1);
    expect(compoundCast(g)).toEqual(cast);
  });
});

describe('弟子の一言', () => {
  it('すべての一言が日本語・英語にある', () => {
    for (const [kind, n] of Object.entries(VOICE_VARIANTS)) {
      for (let i = 0; i < n; i++) {
        expect(ja, `${kind}.${i}`).toHaveProperty([`voice.${kind}.${i}`]);
        expect(en, `${kind}.${i}`).toHaveProperty([`voice.${kind}.${i}`]);
      }
    }
  });

  it('けが・新弟子・疲れを先に言う。同じ場所では同じ言葉', () => {
    const g = play(7, 6);
    const kindOf = (key: string) => key.split('.')[1] as VoiceKind;
    for (const r of mine(g)) {
      const key = voiceOf(g, r, null);
      expect(ja).toHaveProperty([key]);
      expect(voiceOf(g, r, null)).toBe(key);
    }
    const r = mine(g)[0]!;
    expect(kindOf(voiceOf(g, { ...r, injury: 1 }, null))).toBe('injured');
    expect(kindOf(voiceOf(g, { ...r, injury: 0, fatigue: 90 }, null))).toBe('tired');
    expect(
      kindOf(voiceOf(g, { ...r, injury: 0, fatigue: 0, career: { ...r.career, basho: 0 } }, null)),
    ).toBe('newcomer');
  });
});
