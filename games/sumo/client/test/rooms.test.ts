import { describe, expect, it } from 'vitest';
import { createGame, HAPPENINGS } from '@ichimon/sim';
import { hasRoom, ROOM_SPOTS, ROOMS, roomCast } from '../src/art/hakoniwa/actors';
import { happeningPicture } from '../src/eventScene';
import ja from '../src/i18n/ja.json';
import en from '../src/i18n/en.json';

describe('部屋の中', () => {
  it('部屋の名前が日本語・英語にある', () => {
    for (const r of ROOMS) {
      expect(ja).toHaveProperty([`scene.room.${r}`]);
      expect(en).toHaveProperty([`scene.room.${r}`]);
    }
  });

  it('けが人は大部屋で横になり、休養の弟子は居間で座る。同じ状態なら同じ並び', () => {
    const g = createGame({ seed: 3 });
    const mine = g.rikishi.filter((r) => r.stableId === g.player.stableId);
    mine[0]!.injury = 2;
    mine[1]!.injury = 0;
    mine[1]!.policy = 'rest';
    const oobeya = roomCast(g, 'room_oobeya');
    expect(oobeya.find((a) => a.rikishiId === mine[0]!.id)?.look.pose).toBe('lie');
    const ima = roomCast(g, 'room_ima');
    expect(ima.find((a) => a.rikishiId === mine[1]!.id)?.look.pose).toBe('sit');
    expect(roomCast(g, 'room_ima')).toEqual(ima);
    // 親方は玄関と事務室だけ
    expect(roomCast(g, 'room_genkan').some((a) => a.key === 'oyakata')).toBe(true);
    expect(ima.some((a) => a.key === 'oyakata')).toBe(false);
    // 立ち位置は舞台の中
    for (const spots of Object.values(ROOM_SPOTS))
      for (const s of Object.values(spots).flatMap((v) => (Array.isArray(v) ? v : [v])))
        expect(s.x > 0 && s.x < 400 && s.y > 0 && s.y < 228).toBe(true);
  });

  it('どの出来事にも、挿絵の部屋がある', () => {
    for (const h of HAPPENINGS) expect(happeningPicture(h.id)).not.toBeNull();
  });

  it('治療室はトレーナーの契約、トレーニング室は稽古場の改修2段目から。治療室があれば、けが人はまず施術台', () => {
    const g = createGame({ seed: 3 });
    expect(hasRoom(g, 'room_clinic')).toBe(false);
    expect(hasRoom(g, 'room_gym')).toBe(false);
    const hurt = g.rikishi.find((r) => r.stableId === g.player.stableId)!;
    hurt.injury = 2;
    expect(roomCast(g, 'room_oobeya').some((a) => a.rikishiId === hurt.id)).toBe(true);
    g.player.facilities.trainer = 1;
    g.player.facilities.dojo = 2;
    expect(hasRoom(g, 'room_clinic')).toBe(true);
    expect(hasRoom(g, 'room_gym')).toBe(true);
    expect(roomCast(g, 'room_clinic').some((a) => a.rikishiId === hurt.id)).toBe(true);
    expect(roomCast(g, 'room_oobeya').some((a) => a.rikishiId === hurt.id)).toBe(false);
  });
});
