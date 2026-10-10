/**
 * 挑戦（ラン）の進行。描画・DOM・音に依存しない（テストで直接動かす）
 *
 * 時間操作のルール:
 * - 抽選開始の直前を巻き戻し地点として記録する（所持チップ・主人公・通常の警備）
 * - 結果を見た後、「受け取る」で確定するまで巻き戻せる。巻き戻すと支出と仮の払い出しが戻る
 * - 巻き戻しても、知った結果（予知）・巻き戻した回数・痕跡・支配人の位置と追跡は残る
 * - 受け取ったら台の抽選位置を1つ進める（同じ利益を二重に受け取れない）
 */
import { BALANCE, collectSeconds } from '../config/balance';
import { entryPoint, generateFloor, isBlocked, roomPath } from './floor';
import { betLimit, itemDef, payoutFor, type ItemId } from './items';
import { createRng, hashSeed } from './rng';
import { outcomeAt } from './slot';
import type { Guard, Machine, RunEvent, RunState, Snapshot, Vec } from './types';

export interface RunOptions {
  /** 持ち帰った金額の累計（道具の解放に使う） */
  bankedTotal?: number;
}

export function createRun(seed: number, options: RunOptions = {}): RunState {
  const floor = generateFloor(seed, options.bankedTotal ?? 0);
  const p = BALANCE.player;
  return {
    seed,
    rooms: floor.rooms,
    room: floor.start,
    player: {
      pos: { ...floor.startPos },
      facing: { x: 0, y: -1 },
      hp: p.hp,
      invuln: 0,
      dodge: 0,
      dodgeDir: { x: 0, y: -1 },
      dodgeCooldown: 0,
      shockCooldown: 0,
      boots: 0,
      moving: false,
    },
    machines: floor.machines,
    guards: floor.guards,
    nox: {
      active: false,
      room: null,
      pos: { x: 0, y: 0 },
      travel: 0,
      entering: 0,
      slow: 0,
      facing: { x: 0, y: 1 },
    },
    chips: BALANCE.startChips,
    safe: 0,
    items: [],
    mirrorCharges: 0,
    shop: { offers: floor.shop },
    spin: null,
    rewindPoint: null,
    rewind: null,
    rewinds: 0,
    trace: 0,
    sinceRewind: 99,
    knowledge: {},
    phase: 'playing',
    time: 0,
    introDone: false,
    caughtBy: null,
    profit: 0,
    events: [],
  };
}

// -----------------------------------------------------------------------------
// 参照
// -----------------------------------------------------------------------------

const dist = (a: Vec, b: Vec) => Math.hypot(a.x - b.x, a.y - b.y);
const center = (m: { x: number; y: number }): Vec => ({ x: m.x + 0.5, y: m.y + 0.5 });

/** 台の前（操作できる位置）にいるか */
const MACHINE_REACH = 1.45;

export function machineById(state: RunState, id: string): Machine {
  return state.machines.find((m) => m.id === id)!;
}

/** 主人公の近くの、操作できる台 */
export function nearbyMachine(state: RunState): Machine | null {
  let best: Machine | null = null;
  let bestD = MACHINE_REACH;
  for (const m of state.machines) {
    if (m.room !== state.room) continue;
    const d = dist(state.player.pos, center(m));
    if (d < bestD) {
      best = m;
      bestD = d;
    }
  }
  return best;
}

/** 台の次の抽選の結果を知っているか */
export function isPredicted(state: RunState, m: Machine): boolean {
  return state.knowledge[m.id]?.index === m.index;
}

/** この台に今賭けられる上限（台の上限・所持チップ・追い賭け手袋） */
export function maxBet(state: RunState, m: Machine): number {
  return Math.min(state.chips, betLimit(m.limit, isPredicted(state, m), state.items));
}

export type BetChoice = 'small' | 'half' | 'all';

export function betAmount(state: RunState, m: Machine, choice: BetChoice): number {
  const max = maxBet(state, m);
  if (max <= 0) return 0;
  const want =
    choice === 'small' ? BALANCE.minBet : choice === 'half' ? Math.floor(state.chips / 2) : state.chips;
  return Math.max(Math.min(BALANCE.minBet, max), Math.min(want, max));
}

/** 近くの置物（店・出口） */
export function nearbyFixture(state: RunState, kind: 'shopCounter' | 'exitCounter'): boolean {
  const room = state.rooms[state.room]!;
  return room.fixtures.some((f) => f.kind === kind && dist(state.player.pos, center(f)) < 1.6);
}

/** 痕跡の段階（0〜3。3で支配人が現れる） */
export function traceStage(state: RunState): number {
  return Math.min(BALANCE.nox.appearAt, state.trace);
}

// -----------------------------------------------------------------------------
// 抽選
// -----------------------------------------------------------------------------

function snapshot(state: RunState): Snapshot {
  return {
    chips: state.chips,
    player: { pos: { ...state.player.pos }, hp: state.player.hp },
    guards: structuredClone(state.guards),
  };
}

function emit(state: RunState, event: RunEvent) {
  state.events.push(event);
}

/** レバーを引く。成功したら true */
export function pullLever(state: RunState, machineId: string, bet: number): boolean {
  if (state.phase !== 'playing' || state.spin) return false;
  const m = machineById(state, machineId);
  if (m.room !== state.room || m.broken === 'dead') return false;
  if (!Number.isInteger(bet) || bet < 1 || bet > maxBet(state, m)) return false;

  state.rewindPoint = snapshot(state);
  state.chips -= bet;
  const forced = m.broken === 'fixed' ? 'jackpot' : undefined;
  const result = outcomeAt(m.seed, m.index, forced);
  const payout = payoutFor(bet, result.outcome, state.items);
  state.spin = {
    machineId,
    bet,
    index: m.index,
    result,
    payout,
    phase: 'spinning',
    t: 0,
    collected: 0,
    collectSeconds: collectSeconds(payout.total - payout.safe),
  };
  emit(state, { type: 'spinStart', machineId, bet });
  return true;
}

function revealResult(state: RunState) {
  const spin = state.spin!;
  spin.phase = 'result';
  spin.t = 0;
  state.knowledge[spin.machineId] = {
    index: spin.index,
    outcome: spin.result.outcome,
    reels: spin.result.reels,
  };
  emit(state, { type: 'result', machineId: spin.machineId, outcome: spin.result.outcome, payout: spin.payout });

  // 割れた鏡: 回数限定で、同じ部屋のいちばん近い別の台の次の結果も覗ける
  if (state.items.includes('mirror') && state.mirrorCharges > 0) {
    const self = machineById(state, spin.machineId);
    const other = state.machines
      .filter((m) => m.room === state.room && m.id !== self.id && m.broken !== 'dead' && !isPredicted(state, m))
      .sort((a, b) => dist(center(a), center(self)) - dist(center(b), center(self)))[0];
    if (other) {
      const r = outcomeAt(other.seed, other.index, other.broken === 'fixed' ? 'jackpot' : undefined);
      state.knowledge[other.id] = { index: other.index, outcome: r.outcome, reels: r.reels };
      state.mirrorCharges--;
      emit(state, { type: 'mirror', machineId: other.id });
    }
  }
}

/** 受け取る（確定）。ここで抽選位置が進み、もう巻き戻せない */
export function confirmSpin(state: RunState): boolean {
  const spin = state.spin;
  if (state.phase !== 'playing' || !spin || spin.phase !== 'result') return false;
  const m = machineById(state, spin.machineId);
  m.index++;
  const intro = m.broken === 'fixed';
  if (intro) {
    m.broken = 'dead';
    state.introDone = true;
  }
  state.rewindPoint = null;
  state.profit += spin.payout.profit;
  state.safe += spin.payout.safe;
  const outcome = spin.result.outcome;
  // 導入の壊れた台の当たりは痕跡にしない（支配人の気配は、能力を試した後から）
  if (!intro && outcome === 'jackpot') addTrace(state, BALANCE.trace.perJackpot);
  else if (!intro && outcome === 'big') addTrace(state, BALANCE.trace.perBigWin);
  emit(state, { type: 'confirm', machineId: m.id, outcome, payout: spin.payout });
  if (spin.payout.total - spin.payout.safe <= 0) {
    state.spin = null;
  } else {
    spin.phase = 'collecting';
    spin.collected = 0;
  }
  return true;
}

/** 巻き戻す（結果を受け取る前まで） */
export function startRewind(state: RunState): boolean {
  if (state.phase !== 'playing' || !state.spin || state.spin.phase === 'collecting' || !state.rewindPoint) {
    return false;
  }
  state.phase = 'rewinding';
  state.rewind = { t: 0, from: snapshot(state) };
  emit(state, { type: 'rewindStart' });
  return true;
}

function finishRewind(state: RunState) {
  const point = state.rewindPoint!;
  state.chips = point.chips;
  state.player.pos = { ...point.player.pos };
  state.player.hp = point.player.hp;
  state.guards = structuredClone(point.guards);
  state.spin = null;
  state.rewindPoint = null;
  state.rewind = null;
  state.rewinds++;
  state.sinceRewind = 0;
  if (state.rewinds > BALANCE.safeRewinds) addTrace(state, BALANCE.trace.perRewind);
  if (state.items.includes('boots')) state.player.boots = BALANCE.items.boots.seconds;
  state.phase = 'playing';
  emit(state, { type: 'rewindEnd' });
}

function addTrace(state: RunState, amount: number) {
  const before = traceStage(state);
  state.trace += amount;
  const after = traceStage(state);
  for (let s = before + 1; s <= after; s++) emit(state, { type: 'traceStage', stage: s });
  if (after >= BALANCE.nox.appearAt && !state.nox.active) spawnNox(state);
}

// -----------------------------------------------------------------------------
// 店・出口
// -----------------------------------------------------------------------------

/** 道具を買う。装備がいっぱいなら replace の位置と入れ替える */
export function buyItem(state: RunState, offerIndex: number, replace?: number): boolean {
  const id = state.shop.offers[offerIndex];
  if (!id || state.phase !== 'playing' || state.spin || !nearbyFixture(state, 'shopCounter')) return false;
  const price = itemDef(id).price;
  if (state.chips < price) return false;
  const full = state.items.length >= BALANCE.items.maxEquipped;
  if (full && (replace === undefined || replace < 0 || replace >= state.items.length)) return false;
  state.chips -= price;
  if (full) state.items[replace!] = id;
  else state.items.push(id);
  if (id === 'mirror') state.mirrorCharges += BALANCE.items.mirror.charges;
  state.shop.offers[offerIndex] = null;
  emit(state, { type: 'buy', item: id });
  return true;
}

/** 修理（体力を1回復） */
export function buyRepair(state: RunState): boolean {
  const price = BALANCE.items.repair.price;
  if (state.phase !== 'playing' || state.spin || !nearbyFixture(state, 'shopCounter')) return false;
  if (state.chips < price || state.player.hp >= BALANCE.player.hp) return false;
  state.chips -= price;
  state.player.hp++;
  emit(state, { type: 'buy', item: 'repair' });
  return true;
}

/** 持ち帰る（搬出ロビーの窓口）。挑戦を成功で終える */
export function bankAndLeave(state: RunState): boolean {
  if (state.phase !== 'playing' || state.spin || !nearbyFixture(state, 'exitCounter')) return false;
  state.phase = 'escaped';
  emit(state, { type: 'escaped', banked: bankedAmount(state) });
  return true;
}

/** 挑戦の終わりに持ち帰れる額（捕まったら安全保管の分だけ） */
export function bankedAmount(state: RunState): number {
  if (state.phase === 'caught') return state.safe;
  return state.chips + state.safe;
}

// -----------------------------------------------------------------------------
// 毎フレームの更新
// -----------------------------------------------------------------------------

export interface FrameInput {
  /** 移動の向き（部屋の座標。長さ 0〜1） */
  move: Vec;
  dodge: boolean;
  shockwave: boolean;
}

export const NO_INPUT: FrameInput = { move: { x: 0, y: 0 }, dodge: false, shockwave: false };

/** 時間を進める（ポーズ中は呼ばない: 支配人も止まる） */
export function update(state: RunState, dt: number, input: FrameInput = NO_INPUT): void {
  if (state.phase === 'caught' || state.phase === 'escaped') return;
  state.time += dt;

  if (state.phase === 'rewinding') {
    // 巻き戻し中: 室内の全員が逆再生する（描画側が補間する）。支配人だけは普通に歩いてくる
    state.rewind!.t += dt / BALANCE.rewindSeconds;
    updateNox(state, dt);
    if (state.rewind!.t >= 1) finishRewind(state);
    return;
  }

  state.sinceRewind += dt;
  updatePlayer(state, dt, input);
  updateSpin(state, dt);
  updateGuards(state, dt);
  updateNox(state, dt);
}

function updateSpin(state: RunState, dt: number) {
  const spin = state.spin;
  if (!spin) return;
  if (spin.phase === 'spinning') {
    spin.t += dt;
    if (spin.t >= BALANCE.spinSeconds) revealResult(state);
    return;
  }
  if (spin.phase === 'collecting') {
    // 払い出し口の近くにいるあいだだけ回収が進む（離れると止まる）
    const m = machineById(state, spin.machineId);
    if (m.room !== state.room || dist(state.player.pos, center(m)) > BALANCE.collect.radius) return;
    const target = spin.payout.total - spin.payout.safe;
    const before = Math.floor(spin.collected);
    spin.collected = Math.min(target, spin.collected + (target / spin.collectSeconds) * dt);
    state.chips += Math.floor(spin.collected) - before;
    if (spin.collected >= target) {
      state.spin = null;
      emit(state, { type: 'collectDone', machineId: m.id });
    }
  }
}

function updatePlayer(state: RunState, dt: number, input: FrameInput) {
  const p = state.player;
  const cfg = BALANCE.player;
  p.invuln = Math.max(0, p.invuln - dt);
  p.dodgeCooldown = Math.max(0, p.dodgeCooldown - dt);
  p.shockCooldown = Math.max(0, p.shockCooldown - dt);
  p.boots = Math.max(0, p.boots - dt);

  const len = Math.hypot(input.move.x, input.move.y);
  const dir = len > 0 ? { x: input.move.x / len, y: input.move.y / len } : null;
  if (dir) p.facing = dir;

  if (input.dodge && p.dodgeCooldown <= 0 && p.dodge <= 0) {
    p.dodge = cfg.dodge.seconds;
    p.dodgeDir = dir ?? p.facing;
    p.dodgeCooldown = cfg.dodge.cooldown;
    emit(state, { type: 'dodge' });
  }
  if (input.shockwave && p.shockCooldown <= 0) shockwave(state);

  let velocity: Vec = { x: 0, y: 0 };
  if (p.dodge > 0) {
    p.dodge = Math.max(0, p.dodge - dt);
    velocity = { x: p.dodgeDir.x * cfg.dodge.speed, y: p.dodgeDir.y * cfg.dodge.speed };
  } else if (dir) {
    const speed = cfg.speed * (p.boots > 0 ? BALANCE.items.boots.speedMul : 1) * Math.min(1, len);
    velocity = { x: dir.x * speed, y: dir.y * speed };
  }
  p.moving = velocity.x !== 0 || velocity.y !== 0;
  if (!p.moving) return;

  const next = { x: p.pos.x + velocity.x * dt, y: p.pos.y + velocity.y * dt };
  if (tryDoor(state, next)) return;
  moveWithCollision(state, p.pos, velocity, dt, cfg.radius);
}

/** 扉のマスから部屋の外へ出ようとしたら、隣の部屋へ移る */
function tryDoor(state: RunState, next: Vec): boolean {
  const room = state.rooms[state.room]!;
  const tx = Math.floor(state.player.pos.x);
  const ty = Math.floor(state.player.pos.y);
  const door = room.doors.find((d) => {
    if (d.x !== tx || d.y !== ty) return false;
    return (
      (d.side === 'n' && next.y < 0.15) ||
      (d.side === 's' && next.y > room.height - 0.15) ||
      (d.side === 'w' && next.x < 0.15) ||
      (d.side === 'e' && next.x > room.width - 0.15)
    );
  });
  if (!door) return false;
  if (state.spin) {
    emit(state, { type: 'blocked', reason: state.spin.phase === 'collecting' ? 'collecting' : 'unconfirmed' });
    return false;
  }
  const target = state.rooms[door.to]!;
  const back = target.doors.find((d) => d.to === room.id)!;
  const from = state.room;
  state.room = target.id;
  state.player.pos = entryPoint(back);
  emit(state, { type: 'roomChange', room: target.id });
  // 支配人は、主人公が出た部屋から追ってくる
  const nox = state.nox;
  if (nox.active && nox.room === from) {
    nox.travel = noxTravelSeconds(state);
  }
  return true;
}

function moveWithCollision(state: RunState, pos: Vec, v: Vec, dt: number, r: number, roomId = state.room) {
  const room = state.rooms[roomId]!;
  const free = (x: number, y: number) =>
    !isBlocked(room, state.machines, x - r, y - r) &&
    !isBlocked(room, state.machines, x + r, y - r) &&
    !isBlocked(room, state.machines, x - r, y + r) &&
    !isBlocked(room, state.machines, x + r, y + r);
  const nx = pos.x + v.x * dt;
  if (free(nx, pos.y)) pos.x = nx;
  const ny = pos.y + v.y * dt;
  if (free(pos.x, ny)) pos.y = ny;
}

function shockwave(state: RunState) {
  const cfg = BALANCE.player.shockwave;
  const p = state.player;
  p.shockCooldown = cfg.cooldown;
  emit(state, { type: 'shockwave' });
  for (const g of state.guards) {
    if (g.room !== state.room) continue;
    const d = dist(g.pos, p.pos);
    if (d > cfg.radius) continue;
    const away = d > 0.01 ? { x: (g.pos.x - p.pos.x) / d, y: (g.pos.y - p.pos.y) / d } : { x: 1, y: 0 };
    moveWithCollision(state, g.pos, { x: away.x * cfg.push, y: away.y * cfg.push }, 1, 0.3, g.room);
    g.stun = cfg.stunSeconds;
    g.state = 'return';
    g.memory = 0;
  }
  const nox = state.nox;
  if (nox.active && nox.room === state.room && dist(nox.pos, p.pos) <= cfg.radius * 1.2) {
    nox.slow = cfg.noxSlowSeconds;
  }
}

// -----------------------------------------------------------------------------
// 警備
// -----------------------------------------------------------------------------

/** 警備に怪しまれる状況（巻き戻しの直後・大口の回収中） */
export function isSuspicious(state: RunState): boolean {
  const s = state.spin;
  return (
    state.sinceRewind < BALANCE.guards.suspicionAfterRewind ||
    (!!s && s.phase === 'collecting' && s.payout.total >= BALANCE.guards.suspiciousPayout)
  );
}

function canSee(g: Guard, target: Vec): boolean {
  const cfg = BALANCE.guards.patrol;
  const d = dist(g.pos, target);
  if (d > cfg.vision) return false;
  if (d < 1.2) return true;
  const dot = ((target.x - g.pos.x) * g.facing.x + (target.y - g.pos.y) * g.facing.y) / d;
  return dot >= Math.cos(((cfg.fovDeg / 2) * Math.PI) / 180);
}

function stepToward(state: RunState, g: Guard, target: Vec, speed: number, dt: number) {
  const d = dist(g.pos, target);
  if (d < 0.05) return;
  const v = { x: ((target.x - g.pos.x) / d) * speed, y: ((target.y - g.pos.y) / d) * speed };
  g.facing = { x: v.x / speed, y: v.y / speed };
  moveWithCollision(state, g.pos, v, Math.min(dt, d / speed), 0.3, g.room);
}

function updateGuards(state: RunState, dt: number) {
  const cfg = BALANCE.guards;
  const p = state.player;
  const suspicious = isSuspicious(state);
  for (const g of state.guards) {
    if (g.stun > 0) {
      g.stun = Math.max(0, g.stun - dt);
      continue;
    }
    const sameRoom = g.room === state.room;
    if (g.kind === 'patrol') {
      const sees = sameRoom && canSee(g, p.pos);
      if (sees && suspicious) {
        g.state = 'chase';
        g.memory = cfg.patrol.chaseMemory;
      } else if (g.state === 'chase') {
        g.memory -= dt;
        if (g.memory <= 0 || !sameRoom) g.state = 'return';
      }
      if (g.state === 'chase') {
        stepToward(state, g, p.pos, cfg.patrol.chaseSpeed, dt);
      } else {
        const target = g.route[g.routeIndex]!;
        stepToward(state, g, target, cfg.patrol.speed, dt);
        if (dist(g.pos, target) < 0.1) {
          g.routeIndex = (g.routeIndex + 1) % g.route.length;
          g.state = 'patrol';
        }
      }
    } else {
      // 用心棒: 持ち場の近くに怪しい客が来たら詰め寄る。離れたら戻る
      const post = g.route[0]!;
      const near = sameRoom && dist(p.pos, post) < cfg.bouncer.guardRadius;
      if (near && suspicious) {
        g.state = 'chase';
        stepToward(state, g, p.pos, cfg.bouncer.chaseSpeed, dt);
      } else {
        g.state = 'return';
        stepToward(state, g, post, cfg.bouncer.chaseSpeed * 0.7, dt);
      }
    }
    if (sameRoom && p.invuln <= 0 && p.dodge <= 0 && dist(g.pos, p.pos) < cfg.contactRadius + BALANCE.player.radius) {
      hurt(state, g);
    }
  }
}

function hurt(state: RunState, g: Guard) {
  const p = state.player;
  const damage = g.kind === 'bouncer' ? BALANCE.guards.bouncer.damage : BALANCE.guards.patrol.damage;
  p.hp = Math.max(0, p.hp - damage);
  p.invuln = BALANCE.player.invulnSeconds;
  const d = Math.max(0.01, dist(g.pos, p.pos));
  const away = { x: (p.pos.x - g.pos.x) / d, y: (p.pos.y - g.pos.y) / d };
  moveWithCollision(state, p.pos, { x: away.x * BALANCE.guards.knockback, y: away.y * BALANCE.guards.knockback }, 1, BALANCE.player.radius);
  g.state = 'return';
  g.memory = 0;
  g.stun = 0.6;
  emit(state, { type: 'hurt', by: g.kind });
  if (p.hp <= 0) caught(state, 'guards');
}

function caught(state: RunState, by: 'nox' | 'guards') {
  state.phase = 'caught';
  state.caughtBy = by;
  state.spin = null;
  state.rewindPoint = null;
  emit(state, { type: 'caught', by });
}

// -----------------------------------------------------------------------------
// 支配人ミスター・ノクス
// -----------------------------------------------------------------------------

function noxTravelSeconds(state: RunState): number {
  const cfg = BALANCE.nox;
  return Math.max(cfg.roomTravelMin, cfg.roomTravelSeconds - (state.trace - cfg.appearAt) * 0.6);
}

function noxSpeed(state: RunState): number {
  const cfg = BALANCE.nox;
  let speed = Math.min(cfg.maxSpeed, cfg.speed + cfg.speedPerTrace * (state.trace - cfg.appearAt));
  if (state.items.includes('contract')) speed *= BALANCE.items.contract.noxSpeedMul;
  return speed;
}

/** 支配人が現れる: 主人公からいちばん遠い部屋から歩いてくる */
function spawnNox(state: RunState) {
  const rng = createRng(hashSeed(state.seed, 0x40c5, state.rewinds));
  const ids = Object.keys(state.rooms).filter((id) => id !== state.room && state.rooms[id]!.kind !== 'workshop');
  let far = ids[0]!;
  let farLen = -1;
  for (const id of ids) {
    const len = roomPath(state.rooms, id, state.room).length + rng() * 0.5;
    if (len > farLen) {
      far = id;
      farLen = len;
    }
  }
  state.nox = {
    active: true,
    room: far,
    pos: { x: 6, y: 4 },
    travel: noxTravelSeconds(state),
    entering: 0,
    slow: 0,
    facing: { x: 0, y: 1 },
  };
}

function updateNox(state: RunState, dt: number) {
  const nox = state.nox;
  if (!nox.active || !nox.room) return;
  nox.slow = Math.max(0, nox.slow - dt);
  nox.entering = Math.max(0, nox.entering - dt);

  if (nox.room !== state.room) {
    const path = roomPath(state.rooms, nox.room, state.room);
    const next = path[0];
    if (!next) return;
    // 時計工房には入らない（扉の前で待つ）
    if (state.rooms[next]!.kind === 'workshop') return;
    nox.travel -= dt;
    if (nox.travel > 0) return;
    if (next === state.room) {
      const door = state.rooms[state.room]!.doors.find((d) => d.to === nox.room)!;
      nox.room = state.room;
      nox.pos = entryPoint(door);
      nox.entering = BALANCE.nox.entranceSlowSeconds;
      emit(state, { type: 'noxEnter', room: state.room });
    } else {
      nox.room = next;
      nox.travel = noxTravelSeconds(state);
    }
    return;
  }

  let speed = noxSpeed(state);
  if (nox.entering > 0) speed *= 0.5;
  if (nox.slow > 0) speed *= BALANCE.player.shockwave.noxSlowFactor;
  const target = state.player.pos;
  const d = dist(nox.pos, target);
  if (d > 0.01) {
    const v = { x: ((target.x - nox.pos.x) / d) * speed, y: ((target.y - nox.pos.y) / d) * speed };
    nox.facing = { x: v.x / speed, y: v.y / speed };
    moveWithCollision(state, nox.pos, v, dt, 0.3, nox.room);
  }
  // 入ってきた直後は捕まえない（足音・扉の光で予告してから近づく）
  if (
    state.phase === 'playing' &&
    nox.entering <= 0 &&
    dist(nox.pos, target) < BALANCE.nox.catchRadius + BALANCE.player.radius
  ) {
    caught(state, 'nox');
  }
}

/** 次に支配人が入ってくる扉（同じ部屋にいないとき。予告の表示用） */
export function noxIncomingDoor(state: RunState): { side: string; x: number; y: number; eta: number } | null {
  const nox = state.nox;
  if (!nox.active || !nox.room || nox.room === state.room) return null;
  const path = roomPath(state.rooms, nox.room, state.room);
  if (path.length !== 1) return null;
  const door = state.rooms[state.room]!.doors.find((d) => d.to === nox.room);
  return door ? { side: door.side, x: door.x, y: door.y, eta: nox.travel } : null;
}

export type { ItemId };
