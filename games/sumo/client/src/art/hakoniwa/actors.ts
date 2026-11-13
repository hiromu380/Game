/**
 * 箱庭に立つ人: 弟子が稽古の方針どおりに動く（純粋関数。乱数を使わない）
 * 稽古場: 申し合い（四つ・押し）・鉄砲（押し）・すり足（技）・四股（体づくり）・見取り（休養）・親方は上がり座敷
 * 外観: けが人は寮の縁側で布団・番付の下の2人は掃除（門の前の道と敷石）・ちゃんこ番・稽古場に入りきらない弟子は庭で四股
 */
import { isSekitori, ranksOf, type GameState, type Rikishi } from '@ichimon/sim';
import type { PersonLook, Pose } from './people';
import { depthAmong, toScreen, type Piece } from './grid';
import { WEIGHTS_FROM_DOJO } from '../sprites/keikoba';

export interface Actor {
  /** 描き分けの鍵（弟子の ID か、親方） */
  key: string;
  /** 押すと話しかけられる弟子（親方は null） */
  rikishiId: number | null;
  look: Omit<PersonLook, 'frame'>;
  /** 足元（舞台のドット） */
  x: number;
  y: number;
  /** 奥行き（大きいほど手前に描く） */
  z: number;
  /** マス目の足元（外観。物との前後を決めるのに使う） */
  g?: { gx: number; gy: number };
  /** 行き来する先（すり足・掃除）。コマごとに少しずつ進んで戻る */
  to?: { x: number; y: number };
  /** 動きのずれ（全員が同じ拍で動かないように） */
  phase: number;
}

function lookOf(r: Rikishi, sekitori: boolean, pose: Pose, flip = false): Actor['look'] {
  return {
    pose,
    skin: (r.id % 3) as 0 | 1 | 2,
    mawashi: sekitori ? 'white' : 'black',
    hair: r.career.basho < 6 ? 'zanbara' : 'mage',
    build: r.weight < 115 ? 0 : r.weight < 150 ? 1 : 2,
    flip,
  };
}

const OYAKATA_LOOK = (pose: 'oyakata' | 'oyakataSit'): Actor['look'] => ({
  pose,
  skin: 1,
  mawashi: 'black',
  hair: 'zanbara',
  build: 1,
});

/** 自分の弟子を番付の上から（番付にまだ載っていない新弟子は最後） */
function mine(game: Pick<GameState, 'player' | 'rikishi' | 'banzuke' | 'titles'>) {
  const ranks = ranksOf(game.banzuke, game.titles);
  const order = new Map(game.banzuke.map((id, i) => [id, i]));
  return game.rikishi
    .filter((r) => r.stableId === game.player.stableId)
    .sort((a, b) => (order.get(a.id) ?? 1e9) - (order.get(b.id) ?? 1e9) || a.id - b.id)
    .map((r) => {
      const rank = ranks.get(r.id);
      return { r, sekitori: rank !== undefined && isSekitori(rank) };
    });
}

/** 稽古場の立ち位置（舞台 320×200 のドット。土俵・鉄砲柱・座敷の絵に合わせる） */
export const KEIKOBA_SPOTS = {
  ring: [
    { x: 180, y: 117, flip: true },
    { x: 201, y: 113, flip: false },
  ],
  teppo: [{ x: 241, y: 128, flip: true }],
  suriashi: [
    { x: 100, y: 150, to: { x: 128, y: 164 } },
    { x: 156, y: 176, to: { x: 130, y: 163 } },
  ],
  shiko: [
    { x: 122, y: 148 },
    { x: 146, y: 160 },
    { x: 170, y: 176 },
    { x: 98, y: 140 },
  ],
  sit: [
    { x: 74, y: 140 },
    { x: 88, y: 147 },
  ],
  oyakata: { x: 98, y: 94 },
} as const;

/**
 * 1枚絵の稽古場（keikoba_classic。舞台 400×228）の立ち位置: 左の上がり座敷に親方と休む弟子、右の土俵で申し合い、奥の鉄砲柱、手前の空いた床で四股・すり足
 */
export const CLASSIC_SPOTS: typeof KEIKOBA_SPOTS = {
  ring: [
    { x: 258, y: 139, flip: true },
    { x: 279, y: 135, flip: false },
  ],
  teppo: [{ x: 326, y: 141, flip: true }],
  suriashi: [
    { x: 132, y: 172, to: { x: 162, y: 186 } },
    { x: 232, y: 198, to: { x: 204, y: 184 } },
  ],
  shiko: [
    { x: 162, y: 166 },
    { x: 192, y: 182 },
    { x: 222, y: 180 },
    { x: 200, y: 154 },
  ],
  sit: [
    { x: 92, y: 128 },
    { x: 150, y: 116 },
  ],
  oyakata: { x: 116, y: 116 },
} as unknown as typeof KEIKOBA_SPOTS;

export type Training = 'ring' | 'teppo' | 'suriashi' | 'shiko' | 'sit';

/** 稽古の方針 → 稽古場ですること（順に空きを探す） */
const WANTS: Record<Rikishi['policy'], Training[]> = {
  yotsu: ['ring', 'shiko'],
  oshi: ['teppo', 'ring', 'shiko'],
  waza: ['suriashi', 'ring', 'shiko'],
  body: ['shiko'],
  rest: ['sit'],
};

const POSE: Record<Training, Pose> = {
  ring: 'push',
  teppo: 'teppo',
  suriashi: 'suriashi',
  shiko: 'shiko',
  sit: 'sit',
};

export interface Cast {
  keikoba: Actor[];
  /** 稽古場に入りきらなかった弟子（外観の庭で四股） */
  overflow: Rikishi[];
}

/** 稽古場の人（けが人は出ない）。番付の上の弟子から場所を取る */
export function keikobaCast(
  game: Pick<GameState, 'player' | 'rikishi' | 'banzuke' | 'titles'>,
  spots: typeof KEIKOBA_SPOTS = KEIKOBA_SPOTS,
): Cast {
  const used: Record<Training, number> = { ring: 0, teppo: 0, suriashi: 0, shiko: 0, sit: 0 };
  const keikoba: Actor[] = [];
  const overflow: Rikishi[] = [];
  for (const { r, sekitori } of mine(game)) {
    if (r.injury > 0) continue;
    const what = WANTS[r.policy].find((w) => used[w] < spots[w].length);
    if (!what) {
      overflow.push(r);
      continue;
    }
    const spot = spots[what][used[what]++]! as {
      x: number;
      y: number;
      flip?: boolean;
      to?: { x: number; y: number };
    };
    keikoba.push({
      key: `r${r.id}`,
      rikishiId: r.id,
      look: lookOf(r, sekitori, POSE[what], spot.flip ?? false),
      x: spot.x,
      y: spot.y,
      z: 100 + spot.y,
      to: spot.to,
      phase: r.id % 4,
    });
  }
  // 申し合いは相手がいないとできない: 1人だけなら四股に回す
  const ring = keikoba.filter((a) => a.look.pose === 'push');
  if (ring.length === 1) ring[0]!.look = { ...ring[0]!.look, pose: 'shiko', flip: false };
  keikoba.push({
    key: 'oyakata',
    rikishiId: null,
    look: OYAKATA_LOOK('oyakataSit'),
    x: spots.oyakata.x,
    y: spots.oyakata.y,
    z: 100 + spots.oyakata.y,
    phase: 0,
  });
  return { keikoba, overflow };
}

/** 外観の人の奥行きを、奥から手前へ並べた物に合わせる（門や幟の奥にいる人は、その後ろに描く） */
export function amongPieces<T extends Actor>(
  actors: readonly T[],
  ordered: readonly Pick<Piece, 'gx' | 'gy' | 'w' | 'd'>[],
): T[] {
  return actors.map((a) => (a.g ? { ...a, z: depthAmong(a.g, ordered) } : a));
}

/** 外観の立ち位置（マス目） */
export const COMPOUND_SPOTS = {
  /** 寮の縁側の布団（けが人） */
  futon: [
    [16.4, 7.5],
    [18.2, 7.5],
    [20, 7.5],
  ],
  /** 掃除（門の前の道と、敷石） */
  sweep: [
    { at: [9.4, 19], to: [11.6, 19.2] },
    { at: [11.6, 14.6], to: [11, 15.4] },
  ],
  /** ちゃんこ番（ちゃんこ場の前） */
  chanko: [[17.3, 13.6]],
  /** 庭の四股 */
  yard: [
    [13.2, 14.4],
    [14.6, 15.4],
    [16.3, 14.5],
    [4.6, 16.8],
  ],
  /** 母屋の縁側で休む */
  engawa: [
    [5.2, 12.5],
    [6.6, 12.5],
  ],
  oyakata: [10.8, 12.7],
} as const;

/** 外観の人。番付の下の弟子から雑用に回る */
export function compoundCast(
  game: Pick<GameState, 'player' | 'rikishi' | 'banzuke' | 'titles'>,
): Actor[] {
  const all = mine(game);
  const out: Actor[] = [];
  const place = (
    r: Rikishi,
    sekitori: boolean,
    pose: Pose,
    at: readonly number[],
    to?: readonly number[],
  ) => {
    const p = toScreen(at[0]!, at[1]!);
    out.push({
      key: `r${r.id}`,
      rikishiId: r.id,
      look: lookOf(r, sekitori, pose),
      x: p.x,
      y: p.y,
      z: at[0]! + at[1]! + 0.01,
      g: { gx: at[0]!, gy: at[1]! },
      to: to ? toScreen(to[0]!, to[1]!) : undefined,
      phase: r.id % 4,
    });
  };
  const taken = new Set<number>();
  // けが人は寮の縁側で布団
  all
    .filter((x) => x.r.injury > 0)
    .slice(0, COMPOUND_SPOTS.futon.length)
    .forEach(({ r, sekitori }, i) => {
      place(r, sekitori, 'lie', COMPOUND_SPOTS.futon[i]!);
      taken.add(r.id);
    });
  // 休養の弟子は母屋の縁側
  all
    .filter((x) => x.r.injury === 0 && x.r.policy === 'rest')
    .slice(0, COMPOUND_SPOTS.engawa.length)
    .forEach(({ r, sekitori }, i) => {
      place(r, sekitori, 'sit', COMPOUND_SPOTS.engawa[i]!);
      taken.add(r.id);
    });
  // 番付の下から: 掃除2人・ちゃんこ番1人（関取はしない）
  const juniors = [...all]
    .reverse()
    .filter((x) => !x.sekitori && x.r.injury === 0 && !taken.has(x.r.id));
  juniors.slice(0, COMPOUND_SPOTS.sweep.length).forEach(({ r }, i) => {
    const s = COMPOUND_SPOTS.sweep[i]!;
    place(r, false, 'sweep', s.at, s.to);
    taken.add(r.id);
  });
  juniors
    .slice(COMPOUND_SPOTS.sweep.length, COMPOUND_SPOTS.sweep.length + COMPOUND_SPOTS.chanko.length)
    .forEach(({ r }, i) => {
      place(r, false, 'idle', COMPOUND_SPOTS.chanko[i]!);
      taken.add(r.id);
    });
  // 稽古場に入りきらない弟子は庭で四股
  const { overflow } = keikobaCast(game);
  overflow
    .filter((r) => !taken.has(r.id))
    .slice(0, COMPOUND_SPOTS.yard.length)
    .forEach((r, i) => {
      place(r, all.find((x) => x.r.id === r.id)!.sekitori, 'shiko', COMPOUND_SPOTS.yard[i]!);
    });
  const o = toScreen(COMPOUND_SPOTS.oyakata[0], COMPOUND_SPOTS.oyakata[1]);
  out.push({
    key: 'oyakata',
    rikishiId: null,
    look: OYAKATA_LOOK('oyakata'),
    x: o.x,
    y: o.y,
    z: COMPOUND_SPOTS.oyakata[0] + COMPOUND_SPOTS.oyakata[1] + 0.01,
    g: { gx: COMPOUND_SPOTS.oyakata[0], gy: COMPOUND_SPOTS.oyakata[1] },
    phase: 0,
  });
  return out;
}

/** 部屋の中の絵（384×216。舞台 400×228 の下の中央 (200, 224) に置く） */
export const ROOMS = [
  'room_ima',
  'room_oobeya',
  'room_kitchen',
  'room_furo',
  'room_hoshiba',
  'room_genkan',
  'room_ousetsu',
  'room_clinic',
  'room_gym',
  'room_niwa',
  'room_parking',
] as const;
export type RoomId = (typeof ROOMS)[number];

type Spot = { x: number; y: number; flip?: boolean; to?: { x: number; y: number } };

/**
 * 部屋の中の立ち位置（舞台 400×228 のドット。絵に合わせる）。
 * 居間: 休養の弟子が座卓で座る／大部屋: けが人が布団で横になる／厨房: ちゃんこ番／中庭: 掃除番／玄関と事務室: 親方が囲炉裏の前に座る／風呂: 人は置かない
 */
export const ROOM_SPOTS: Record<
  RoomId,
  { rest?: Spot[]; lie?: Spot[]; chanko?: Spot[]; sweep?: Spot[]; oyakata?: Spot }
> = {
  room_ima: {
    rest: [
      { x: 220, y: 134 },
      { x: 238, y: 144 },
      { x: 260, y: 153 },
      { x: 279, y: 163 },
    ],
  },
  room_oobeya: {
    lie: [
      { x: 77, y: 140 },
      { x: 113, y: 129 },
      { x: 152, y: 117 },
    ],
  },
  room_kitchen: {
    chanko: [
      { x: 140, y: 148 },
      { x: 236, y: 176 },
    ],
  },
  room_furo: {},
  room_hoshiba: {},
  room_genkan: { oyakata: { x: 266, y: 134 } },
  room_ousetsu: {},
  // 治療室の施術台（けが人はまずここで横になる）
  room_clinic: {
    lie: [
      { x: 256, y: 104 },
      { x: 298, y: 137 },
    ],
  },
  room_gym: {},
  room_parking: {},
  room_niwa: {
    sweep: [
      { x: 141, y: 169, to: { x: 163, y: 180 } },
      { x: 229, y: 162, to: { x: 207, y: 173 } },
    ],
  },
};

/** その部屋が部屋にあるか: トレーニング室は稽古場の改修2段目から、治療室はトレーナーの契約があるとき */
export function hasRoom(game: Pick<GameState, 'player'>, room: RoomId): boolean {
  const f = game.player.facilities;
  if (room === 'room_gym') return f.dojo >= WEIGHTS_FROM_DOJO;
  if (room === 'room_clinic') return f.trainer >= 1;
  return true;
}

/**
 * 部屋の中にいる人（外観と同じ割り振り: けが人・休養・番付の下から掃除2人とちゃんこ番1人。親方）。乱数を使わない
 */
export function roomCast(
  game: Pick<GameState, 'player' | 'rikishi' | 'banzuke' | 'titles'>,
  room: RoomId,
): Actor[] {
  const all = mine(game);
  const spots = ROOM_SPOTS[room];
  const out: Actor[] = [];
  const put = (r: Rikishi, sekitori: boolean, pose: Pose, s: Spot) =>
    out.push({
      key: `r${r.id}`,
      rikishiId: r.id,
      look: lookOf(r, sekitori, pose, s.flip ?? false),
      x: s.x,
      y: s.y,
      z: 100 + s.y,
      to: s.to,
      phase: r.id % 4,
    });
  // けが人: 治療室があればまず施術台、残りは大部屋の布団
  const hurt = all.filter((x) => x.r.injury > 0);
  const beds = hasRoom(game, 'room_clinic') ? (ROOM_SPOTS.room_clinic.lie?.length ?? 0) : 0;
  const injured = room === 'room_clinic' ? hurt.slice(0, beds) : hurt.slice(beds);
  const rest = all.filter((x) => x.r.injury === 0 && x.r.policy === 'rest');
  const juniors = [...all]
    .reverse()
    .filter((x) => !x.sekitori && x.r.injury === 0 && x.r.policy !== 'rest');
  const sweep = juniors.slice(0, 2);
  const chanko = juniors.slice(2, 3);
  injured
    .slice(0, spots.lie?.length ?? 0)
    .forEach(({ r, sekitori }, i) => put(r, sekitori, 'lie', spots.lie![i]!));
  rest
    .slice(0, spots.rest?.length ?? 0)
    .forEach(({ r, sekitori }, i) => put(r, sekitori, 'sit', spots.rest![i]!));
  sweep
    .slice(0, spots.sweep?.length ?? 0)
    .forEach(({ r }, i) => put(r, false, 'sweep', spots.sweep![i]!));
  chanko
    .slice(0, spots.chanko?.length ?? 0)
    .forEach(({ r }, i) => put(r, false, 'idle', spots.chanko![i]!));
  if (spots.oyakata)
    out.push({
      key: 'oyakata',
      rikishiId: null,
      look: OYAKATA_LOOK('oyakataSit'),
      x: spots.oyakata.x,
      y: spots.oyakata.y,
      z: 100 + spots.oyakata.y,
      phase: 0,
    });
  return out;
}
