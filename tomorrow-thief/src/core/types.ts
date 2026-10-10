/**
 * 挑戦（ラン）の状態の型
 */
import type { OutcomeId } from '../config/balance';
import type { ItemId, PayoutBreakdown } from './items';
import type { SpinOutcome } from './slot';

export interface Vec {
  x: number;
  y: number;
}

export type RoomKind = 'entrance' | 'hall' | 'workshop' | 'highRoller' | 'lobby';

/** 壁の向き: n = 奥右（y=0）, w = 奥左（x=0）, s = 手前左（y=H）, e = 手前右（x=W） */
export type Side = 'n' | 'e' | 's' | 'w';

export interface Door {
  /** 扉のマス（部屋の内側の端のマス） */
  x: number;
  y: number;
  side: Side;
  to: string;
}

export type FixtureKind = 'shopCounter' | 'exitCounter' | 'table' | 'pillar';

/** 台以外の置物（ぶつかる） */
export interface Fixture {
  kind: FixtureKind;
  x: number;
  y: number;
}

export interface Room {
  id: string;
  kind: RoomKind;
  width: number;
  height: number;
  doors: Door[];
  fixtures: Fixture[];
}

export interface Machine {
  id: string;
  room: string;
  x: number;
  y: number;
  /** 台のシード（挑戦開始時に決まる） */
  seed: number;
  /** 次の抽選位置（利益を確定したら1つ進む） */
  index: number;
  limit: number;
  /** 導入の壊れた台: 最初の抽選は必ず 777。確定したら故障して止まる */
  broken?: 'fixed' | 'dead';
}

export type GuardKind = 'patrol' | 'bouncer';

export interface Guard {
  id: string;
  kind: GuardKind;
  room: string;
  pos: Vec;
  /** 巡回路（patrol）・持ち場（bouncer は1点） */
  route: Vec[];
  routeIndex: number;
  state: 'patrol' | 'chase' | 'return';
  /** 見失ってから追い続ける残り時間 */
  memory: number;
  stun: number;
  facing: Vec;
}

/** 進行中の抽選（受け取って確定するまで巻き戻せる） */
export interface ActiveSpin {
  machineId: string;
  bet: number;
  index: number;
  result: SpinOutcome;
  payout: PayoutBreakdown;
  phase: 'spinning' | 'result' | 'collecting';
  /** spinning: 経過時間 / collecting: 回収済みの額 */
  t: number;
  collected: number;
  collectSeconds: number;
}

/** 巻き戻し地点（抽選開始前の記録）。支配人・巻き戻し回数・記憶は含めない */
export interface Snapshot {
  chips: number;
  player: { pos: Vec; hp: number };
  guards: Guard[];
}

export interface Player {
  pos: Vec;
  facing: Vec;
  hp: number;
  invuln: number;
  dodge: number;
  dodgeDir: Vec;
  dodgeCooldown: number;
  shockCooldown: number;
  /** 秒針ブーツの残り時間 */
  boots: number;
  moving: boolean;
}

export interface Nox {
  /** 出現しているか */
  active: boolean;
  room: string | null;
  pos: Vec;
  /** 別の部屋にいるとき: 次の部屋へ移るまでの残り時間 */
  travel: number;
  /** 部屋に入った直後の、ゆっくり歩く残り時間 */
  entering: number;
  slow: number;
  facing: Vec;
}

/** 予知: 台ごとに、知っている抽選位置と結果 */
export type Knowledge = Record<string, { index: number; outcome: OutcomeId; reels: SpinOutcome['reels'] }>;

export type RunPhase = 'playing' | 'rewinding' | 'caught' | 'escaped';

export type RunEvent =
  | { type: 'spinStart'; machineId: string; bet: number }
  | { type: 'result'; machineId: string; outcome: OutcomeId; payout: PayoutBreakdown }
  | { type: 'confirm'; machineId: string; outcome: OutcomeId; payout: PayoutBreakdown }
  | { type: 'collectDone'; machineId: string }
  | { type: 'rewindStart' }
  | { type: 'rewindEnd' }
  | { type: 'traceStage'; stage: number }
  | { type: 'noxEnter'; room: string }
  | { type: 'hurt'; by: GuardKind }
  | { type: 'shockwave' }
  | { type: 'dodge' }
  | { type: 'roomChange'; room: string }
  | { type: 'buy'; item: ItemId | 'repair' }
  | { type: 'mirror'; machineId: string }
  | { type: 'caught'; by: 'nox' | 'guards' }
  | { type: 'escaped'; banked: number }
  | { type: 'blocked'; reason: 'unconfirmed' | 'collecting' | 'noxDoor' };

export interface RunState {
  seed: number;
  rooms: Record<string, Room>;
  room: string;
  player: Player;
  machines: Machine[];
  guards: Guard[];
  nox: Nox;
  chips: number;
  /** 退避用の領収書で安全保管した額（捕まっても失わない） */
  safe: number;
  items: ItemId[];
  mirrorCharges: number;
  shop: { offers: (ItemId | null)[] };
  spin: ActiveSpin | null;
  rewindPoint: Snapshot | null;
  /** 巻き戻しの演出の進み（0〜1）と、戻る前の状態（演出用） */
  rewind: { t: number; from: Snapshot } | null;
  rewinds: number;
  /** 痕跡（巻き戻し・大当たりで増える。支配人の接近） */
  trace: number;
  /** 直前の巻き戻しからの経過時間（警備が怪しむ） */
  sinceRewind: number;
  knowledge: Knowledge;
  phase: RunPhase;
  time: number;
  /** 導入（壊れた台の777）を終えたか */
  introDone: boolean;
  /** 捕まえた相手（捕まったときだけ） */
  caughtBy: 'nox' | 'guards' | null;
  /** この挑戦で確定した利益の合計（表示用） */
  profit: number;
  events: RunEvent[];
}
