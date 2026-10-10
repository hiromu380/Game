/**
 * フロアの生成（挑戦ごとに部屋のつながり・台の上限・警備・店の品を変える）
 *
 * 1フロアの構成: 入口の客席 → 客席A・B（分岐）→ 時計工房 → 大口客の間 → 搬出ロビー
 */
import { BALANCE } from '../config/balance';
import { ITEMS, type ItemId } from './items';
import { createRng, hashSeed, randInt, shuffle } from './rng';
import type { Door, Fixture, Guard, Machine, Room, RoomKind, Side, Vec } from './types';

export const ROOM_W = 12;
export const ROOM_H = 9;

interface RoomPlan {
  id: string;
  kind: RoomKind;
  machines: number;
  patrols: number;
  bouncers: number;
}

/** 扉の位置（側ごとに、壁の中央付近） */
function doorAt(side: Side, offset: number, to: string): Door {
  switch (side) {
    case 'n':
      return { x: offset, y: 0, side, to };
    case 'w':
      return { x: 0, y: offset, side, to };
    case 's':
      return { x: offset, y: ROOM_H - 1, side, to };
    case 'e':
      return { x: ROOM_W - 1, y: offset, side, to };
  }
}

const OPPOSITE: Record<Side, Side> = { n: 's', s: 'n', e: 'w', w: 'e' };

/** 台を置ける場所: 奥の2つの壁際（扉の前は空ける）と、中央の島 */
function machineSlots(doors: Door[]): Vec[] {
  const slots: Vec[] = [];
  for (let x = 2; x < ROOM_W - 1; x += 2) slots.push({ x, y: 1 });
  for (let y = 3; y < ROOM_H - 1; y += 2) slots.push({ x: 1, y });
  slots.push({ x: 5, y: 4 }, { x: 7, y: 4 });
  return slots.filter(
    (s) => !doors.some((d) => Math.abs(d.x - s.x) + Math.abs(d.y - s.y) <= 2),
  );
}

export interface Floor {
  rooms: Record<string, Room>;
  machines: Machine[];
  guards: Guard[];
  start: string;
  startPos: Vec;
  shop: (ItemId | null)[];
}

/** 部屋のつながりを作る（客席A・Bのどちらから大口客の間へ行けるかが挑戦ごとに変わる） */
function connect(rooms: Record<string, Room>, a: string, sideA: Side, offA: number, b: string, offB: number) {
  rooms[a]!.doors.push(doorAt(sideA, offA, b));
  rooms[b]!.doors.push(doorAt(OPPOSITE[sideA], offB, a));
}

export function generateFloor(seed: number, bankedTotal: number): Floor {
  const rng = createRng(hashSeed(seed, 0xf1007));
  const plans: RoomPlan[] = [
    { id: 'entrance', kind: 'entrance', machines: 2, patrols: 0, bouncers: 0 },
    { id: 'hallA', kind: 'hall', machines: 4, patrols: 1, bouncers: 0 },
    { id: 'hallB', kind: 'hall', machines: 4, patrols: 2, bouncers: 0 },
    { id: 'workshop', kind: 'workshop', machines: 0, patrols: 0, bouncers: 0 },
    { id: 'highRoller', kind: 'highRoller', machines: 3, patrols: 1, bouncers: 2 },
    { id: 'lobby', kind: 'lobby', machines: 0, patrols: 0, bouncers: 0 },
  ];
  const rooms: Record<string, Room> = {};
  for (const p of plans) {
    rooms[p.id] = { id: p.id, kind: p.kind, width: ROOM_W, height: ROOM_H, doors: [], fixtures: [] };
  }

  // つながり: 入口 → A（奥右）・B（奥左）、A・B → 工房、どちらか一方だけが大口客の間へ直通
  connect(rooms, 'entrance', 'n', 6, 'hallA', 6);
  connect(rooms, 'entrance', 'w', 4, 'hallB', 4);
  connect(rooms, 'hallA', 'w', 4, 'workshop', 4);
  connect(rooms, 'hallB', 'n', 6, 'workshop', 6);
  const vipFrom = rng() < 0.5 ? 'hallA' : 'hallB';
  connect(rooms, vipFrom, vipFrom === 'hallA' ? 'n' : 'w', vipFrom === 'hallA' ? 6 : 4, 'highRoller', vipFrom === 'hallA' ? 6 : 4);
  connect(rooms, 'workshop', 'n', 3, 'lobby', 3);
  connect(rooms, 'highRoller', vipFrom === 'hallA' ? 'w' : 'n', vipFrom === 'hallA' ? 4 : 6, 'lobby', vipFrom === 'hallA' ? 4 : 6);

  // 置物
  rooms.workshop!.fixtures.push({ kind: 'shopCounter', x: 6, y: 3 }, { kind: 'shopCounter', x: 7, y: 3 });
  rooms.lobby!.fixtures.push({ kind: 'exitCounter', x: 7, y: 2 }, { kind: 'exitCounter', x: 8, y: 2 });
  for (const id of ['entrance', 'hallA', 'hallB', 'highRoller', 'lobby']) {
    const pillars: Fixture[] = [
      { kind: 'pillar', x: ROOM_W - 1, y: ROOM_H - 1 },
      { kind: 'pillar', x: 3, y: ROOM_H - 1 },
      { kind: 'pillar', x: ROOM_W - 1, y: 2 },
    ];
    rooms[id]!.fixtures.push(
      ...pillars.filter((f) => !rooms[id]!.doors.some((d) => Math.abs(d.x - f.x) + Math.abs(d.y - f.y) <= 1)),
    );
  }

  // 台
  // 導入の壊れた台（入口の、入ってすぐ見える位置）。最初の抽選は必ず 777
  const machines: Machine[] = [
    {
      id: 'entrance-broken',
      room: 'entrance',
      x: 4,
      y: 1,
      seed: hashSeed(seed, 0xb0c),
      index: 0,
      limit: BALANCE.brokenMachine.limit,
      broken: 'fixed',
    },
  ];
  for (const p of plans) {
    if (p.machines === 0) continue;
    const slots = shuffle(
      rng,
      machineSlots(rooms[p.id]!.doors).filter((s) => !(p.id === 'entrance' && s.x === 4 && s.y === 1)),
    ).slice(0, p.machines);
    const [lo, hi] =
      p.kind === 'entrance' ? BALANCE.limits.entrance : p.kind === 'highRoller' ? BALANCE.limits.highRoller : BALANCE.limits.hall;
    slots.forEach((s, i) => {
      const step = p.kind === 'highRoller' ? 100 : 10;
      const limit = Math.round((lo + rng() * (hi - lo)) / step) * step;
      machines.push({
        id: `${p.id}-${i}`,
        room: p.id,
        x: s.x,
        y: s.y,
        seed: hashSeed(seed, 0x51a7, machines.length),
        index: 0,
        limit,
      });
    });
  }
  // 警備
  const guards: Guard[] = [];
  for (const p of plans) {
    for (let i = 0; i < p.patrols; i++) {
      const route = patrolRoute(rng, i);
      guards.push(newGuard(`${p.id}-p${i}`, 'patrol', p.id, route));
    }
    const posts = [
      { x: 6, y: 3 },
      { x: 4, y: 5 },
    ];
    for (let i = 0; i < p.bouncers; i++) guards.push(newGuard(`${p.id}-b${i}`, 'bouncer', p.id, [posts[i]!]));
  }

  // 時計工房の品（持ち帰った累計で解放された道具から）
  const pool = ITEMS.filter((it) => bankedTotal >= it.unlockAt).map((it) => it.id);
  const shop = shuffle(rng, pool).slice(0, BALANCE.items.shopOffers);

  return { rooms, machines, guards, start: 'entrance', startPos: { x: 6, y: 6.5 }, shop };
}

function patrolRoute(rng: () => number, i: number): Vec[] {
  const routes: Vec[][] = [
    [
      { x: 3, y: 3 },
      { x: 9, y: 3 },
      { x: 9, y: 6 },
      { x: 3, y: 6 },
    ],
    [
      { x: 4, y: 7 },
      { x: 4, y: 3 },
      { x: 9, y: 3 },
      { x: 9, y: 7 },
    ],
    [
      { x: 2.5, y: 5 },
      { x: 10, y: 5 },
    ],
  ];
  const base = routes[(i + randInt(rng, routes.length)) % routes.length]!;
  return rng() < 0.5 ? base : [...base].reverse();
}

function newGuard(id: string, kind: Guard['kind'], room: string, route: Vec[]): Guard {
  return {
    id,
    kind,
    room,
    pos: { ...route[0]! },
    route,
    routeIndex: 0,
    state: 'patrol',
    memory: 0,
    stun: 0,
    facing: { x: 1, y: 0 },
  };
}

/** 部屋の中で通れないマス（壁・台・置物） */
export function isBlocked(room: Room, machines: Machine[], x: number, y: number): boolean {
  if (x < 0 || y < 0 || x >= room.width || y >= room.height) return true;
  const tx = Math.floor(x);
  const ty = Math.floor(y);
  if (machines.some((m) => m.room === room.id && m.x === tx && m.y === ty)) return true;
  if (room.fixtures.some((f) => f.x === tx && f.y === ty)) return true;
  return false;
}

/** 扉から部屋に入ったときの立ち位置（扉のマスの1つ内側） */
export function entryPoint(door: Door): Vec {
  const c = { x: door.x + 0.5, y: door.y + 0.5 };
  switch (door.side) {
    case 'n':
      return { x: c.x, y: c.y + 1 };
    case 's':
      return { x: c.x, y: c.y - 1 };
    case 'w':
      return { x: c.x + 1, y: c.y };
    case 'e':
      return { x: c.x - 1, y: c.y };
  }
}

/** 部屋のつながりで、from から to への最短の経路（部屋の ID の並び。from を含まない） */
export function roomPath(rooms: Record<string, Room>, from: string, to: string): string[] {
  const prev = new Map<string, string>([[from, from]]);
  const queue = [from];
  while (queue.length) {
    const cur = queue.shift()!;
    if (cur === to) break;
    for (const d of rooms[cur]!.doors) {
      if (!prev.has(d.to)) {
        prev.set(d.to, cur);
        queue.push(d.to);
      }
    }
  }
  if (!prev.has(to)) return [];
  const path: string[] = [];
  for (let cur = to; cur !== from; cur = prev.get(cur)!) path.unshift(cur);
  return path;
}
