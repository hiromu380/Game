/**
 * 取組の舞台（ドット絵）の並べ方: 台本の姿勢から、土俵の上の力士と行司の絵・位置・傾きを決める（純粋関数）
 * 台本の座標（土俵の中心が 0・俵が ±1・東が右）を、舞台のドットへ写す
 */
import type { Pose as ScriptPose, Side } from './boutScript';
import type { Pose } from '../art/hakoniwa/people';

/** 舞台の大きさ（ドット）と、土俵・吊り屋根の絵を置く所 */
export const BOUT_STAGE = {
  width: 184,
  height: 170,
  /** 土俵の絵（160×96）の左上 */
  dohyo: { x: 12, y: 72 },
  /** 俵の輪の中心と、台本の ±1 にあたる半径（ドット） */
  ring: { cx: 92, cy: 111, rx: 34, ry: 22 },
  /** 吊り屋根の絵（176×144）の左上（上は枠で切り、軒と房だけ見せる） */
  roof: { x: 5, y: -81 },
} as const;

export interface StageSprite {
  who: Side | 'gyoji';
  pose: Pose;
  frame: 0 | 1;
  flip: boolean;
  /** 足元（舞台のドット） */
  x: number;
  y: number;
  /** 足元を軸にした傾き（度） */
  rot: number;
}

export interface StageInput {
  pose: { east: ScriptPose; west: ScriptPose; contact: boolean };
  time: number;
  /** 立ち合いで当たる時刻 */
  clash: number;
  /** 勝負が決まった後は、勝った側 */
  winner: Side | null;
}

/** 組んでいるとき、絵が重なりすぎないように左右へ離す分（ドット） */
const SPREAD = 5;
/** 押し合いの手を替える間隔（秒） */
const PUSH_BEAT = 0.16;

/** 土俵の上の絵を、奥から手前の順に */
export function boutSprites(input: StageInput): StageSprite[] {
  const { ring } = BOUT_STAGE;
  const { east, west, contact } = input.pose;
  const beat = Math.floor(input.time / PUSH_BEAT) % 2 === 0 ? 0 : 1;
  const wrestler = (who: Side, me: ScriptPose, other: ScriptPose): StageSprite => {
    // 相手のいる方を向く（絵は左向き。右を向くときに返す）
    const facingRight = me.x < other.x || (me.x === other.x && who === 'W');
    const out = Math.max(0, Math.abs(me.x) - 1.1);
    const fallen = Math.abs(me.rot) > 8;
    let pose: Pose;
    let frame: 0 | 1 = 0;
    if (input.time < input.clash && !contact) {
      pose = 'shikiri';
      frame = input.time > input.clash - 0.22 ? 1 : 0;
    } else if (contact) {
      pose = 'push';
      frame = beat;
    } else if (fallen) {
      pose = 'idle';
    } else if (input.winner === who) {
      pose = 'idle';
      frame = Math.floor(input.time / 0.42) % 2 === 0 ? 0 : 1;
    } else {
      pose = 'suriashi';
      frame = beat;
    }
    return {
      who,
      pose,
      frame,
      flip: facingRight,
      x: Math.round(ring.cx + me.x * ring.rx + (contact ? (facingRight ? -SPREAD : SPREAD) : 0)),
      // 土俵の外へ出たら、土俵の肩を下りる
      y: Math.round(ring.cy + me.y * 28 + out * 26),
      rot: me.rot,
    };
  };
  const gyoji: StageSprite = {
    who: 'gyoji',
    pose: 'gyoji',
    frame: input.winner ? 1 : 0,
    // 軍配は勝った方（東は右）へ上げる
    flip: input.winner === 'E',
    x: ring.cx + 17,
    y: ring.cy - 19,
    rot: 0,
  };
  const pair = [wrestler('W', west, east), wrestler('E', east, west)].sort((a, b) => a.y - b.y);
  return [gyoji, ...pair];
}

/** 当たった瞬間・倒れた瞬間の、舞台の揺れ（ドット。左右）。どちらでもなければ 0 */
export function stageShake(time: number, clash: number, finishAt: number): number {
  for (const at of [clash, finishAt]) {
    const d = time - at;
    if (d >= 0 && d < 0.24) return Math.floor(d / 0.06) % 2 === 0 ? 2 : -2;
  }
  return 0;
}
