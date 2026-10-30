/**
 * 取組の演出の台本（純粋関数）
 *
 * 1. boutFlow: 決まり手・勝った側・両者の型から、立ち合い → 攻防 → 決着の流れを決める
 * 2. boutScript: 流れから、2人の位置・傾きの時間ごとの変化（キーフレーム）と実況の行を作る
 *
 * 勝敗と決まり手は sim が決めたもの。ここでは見せ方だけを決め、同じ取組なら同じ流れになる（取組ごとのシード）。
 * 座標は土俵の中心が (0, 0)、俵が半径 1。東が右、西が左から始まる。
 */
import { KIMARITE_BY_ID, type KimariteMotion, type Style } from '@ichimon/sim';

export type Side = 'E' | 'W';

export interface Pose {
  x: number;
  y: number;
  /** 傾き（度）。倒れるときに大きくなる */
  rot: number;
}

export type Tachiai =
  'atari' | 'tsuppari' | 'harizashi' | 'morozashi' | 'migiyotsu' | 'hidariyotsu' | 'henka';
export type Beat = 'pressIn' | 'pressInEdge' | 'holdOut' | 'grip' | 'stall' | 'pushBack';

export interface BoutFlow {
  kimarite: string;
  motion: KimariteMotion;
  winner: Side;
  tachiai: { kind: Tachiai; by: Side };
  beats: { kind: Beat; by: Side }[];
}

export interface Keyframe {
  /** 秒 */
  t: number;
  east: Pose;
  west: Pose;
  /** 組んでいる・押し合っている間は両手を前に */
  contact: boolean;
  /** この時刻に鳴らす音 */
  sound?: 'clap' | 'hit' | 'fall';
}

/** 実況の1行（文言は i18n の鍵。a・b・w・l は東西の記号で、画面で名前に置き換える） */
export interface CallLine {
  t: number;
  key: string;
  /** 行司の掛け声 */
  gyoji?: boolean;
  a?: Side;
  b?: Side;
}

export interface BoutScript {
  duration: number;
  /** 勝負が決まる時刻 */
  finishAt: number;
  frames: Keyframe[];
  lines: CallLine[];
}

/** 小さな決定論の乱数（0〜1） */
function rand(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5;
    s >>>= 0;
    return s / 4294967296;
  };
}

const other = (s: Side): Side => (s === 'E' ? 'W' : 'E');

/** 取組の流れを決める */
export function boutFlow(input: {
  kimarite: string;
  winner: Side;
  eastStyle: Style;
  westStyle: Style;
  seed: number;
}): BoutFlow {
  const r = rand(input.seed);
  const def = KIMARITE_BY_ID.get(input.kimarite);
  const motion = def?.motion ?? 'push';
  const winner = input.winner;
  const loser = other(winner);
  const styleOf = (s: Side) => (s === 'E' ? input.eastStyle : input.westStyle);
  // 攻める側: 逆転の技・非技なら負けた側が攻め込み、土俵際で決まる
  const reversal = def?.reversal ?? false;
  const attacker = reversal ? loser : winner;

  let tachiai: BoutFlow['tachiai'];
  if (motion === 'slapDown' && styleOf(winner) === 'waza' && r() < 0.35) {
    tachiai = { kind: 'henka', by: winner };
  } else {
    const st = styleOf(attacker);
    const pick = r();
    const kind: Tachiai =
      st === 'oshi'
        ? pick < 0.55
          ? 'tsuppari'
          : 'atari'
        : st === 'yotsu'
          ? pick < 0.4
            ? 'migiyotsu'
            : pick < 0.7
              ? 'hidariyotsu'
              : 'morozashi'
          : pick < 0.5
            ? 'harizashi'
            : 'atari';
    tachiai = { kind, by: attacker };
  }

  const beats: BoutFlow['beats'] = [];
  if (tachiai.kind !== 'henka') {
    const belt = motion === 'force' || motion === 'throw' || motion === 'lift' || motion === 'trip';
    if (belt && r() < 0.6) beats.push({ kind: 'grip', by: winner });
    // 押し返されてから攻める（長い相撲）
    if (r() < 0.35) beats.push({ kind: 'pushBack', by: other(attacker) });
    if (belt && r() < 0.15) beats.push({ kind: 'stall', by: winner });
    beats.push({ kind: 'pressIn', by: attacker });
    if (r() < 0.6 || reversal) beats.push({ kind: 'holdOut', by: other(attacker) });
  }
  return { kimarite: input.kimarite, motion, winner, tachiai, beats };
}

/** 押し込む向き（東が攻めれば西 = 左へ） */
const push = (s: Side) => (s === 'E' ? -1 : 1);

export function boutScript(flow: BoutFlow, seed: number): BoutScript {
  const r = rand(seed ^ 0x9e3779b9);
  const frames: Keyframe[] = [];
  const lines: CallLine[] = [];
  const GAP = 0.12; // 組んだときの2人の間（中心から）
  let c = 0; // 2人の真ん中
  let t = 0;
  const pair = (center: number, wobble = 0): { east: Pose; west: Pose } => ({
    east: { x: center + GAP, y: wobble, rot: 0 },
    west: { x: center - GAP, y: -wobble, rot: 0 },
  });
  frames.push({
    t: 0,
    east: { x: 0.35, y: 0, rot: 0 },
    west: { x: -0.35, y: 0, rot: 0 },
    contact: false,
    sound: 'clap',
  });
  lines.push({ t: 0, key: 'bout.call.hakkeyoi', gyoji: true });

  // 立ち合い
  t = 0.6 + r() * 0.2;
  const { tachiai } = flow;
  if (tachiai.kind === 'henka') {
    // 変化: 攻めた側（負ける側）が前にのめり、勝つ側は横へ
    const d = push(other(tachiai.by));
    const p = pair(0);
    const me = tachiai.by === 'E' ? 'east' : 'west';
    p[me] = { x: -d * 0.35, y: -0.15, rot: 0 };
    p[me === 'east' ? 'west' : 'east'] = { x: d * 0.05, y: 0, rot: 0 };
    frames.push({ t, ...p, contact: false, sound: 'hit' });
    c = d * 0.05;
  } else {
    frames.push({ t, ...pair(0), contact: true, sound: 'hit' });
  }
  lines.push({ t, key: `bout.tachiai.${tachiai.kind}`, a: tachiai.by });

  // 攻防
  flow.beats.forEach((beat, i) => {
    t += 0.7 + r() * 0.35;
    if (i === 0) lines.push({ t: t - 0.35, key: 'bout.call.nokotta', gyoji: true });
    let key: string = beat.kind;
    if (beat.kind === 'pressIn') {
      c = clamp(c + push(beat.by) * (0.35 + r() * 0.15), -0.62, 0.62);
      if (Math.abs(c) >= 0.5) key = 'pressInEdge';
    } else if (beat.kind === 'pushBack') {
      c = clamp(c + push(beat.by) * 0.25, -0.5, 0.5);
    } else if (beat.kind === 'stall') {
      t += 0.6;
    }
    const wobble = beat.kind === 'holdOut' || beat.kind === 'stall' ? (r() - 0.5) * 0.15 : 0;
    frames.push({ t, ...pair(c, wobble), contact: true });
    lines.push({ t, key: `bout.beat.${key}`, a: beat.by, b: other(beat.by) });
  });

  // 決着
  const w = flow.winner;
  const l = other(w);
  const dir = push(w);
  t += 0.8 + r() * 0.2;
  const fallen = /taoshi$|otoshi$/.test(flow.kimarite);
  let wp: Pose;
  let lp: Pose;
  switch (flow.motion) {
    case 'thrust':
    case 'push':
    case 'force':
    case 'lift':
    case 'behind':
      wp = { x: dir * 0.85, y: flow.motion === 'behind' ? 0.1 : 0, rot: 0 };
      lp = { x: dir * 1.25, y: flow.motion === 'behind' ? 0.1 : 0, rot: fallen ? dir * 80 : 0 };
      break;
    case 'edge':
      // うっちゃり: 土俵際で体をひねり、攻めてきた相手を自分の後ろ（外）へ
      wp = { x: -dir * 0.8, y: 0, rot: dir * 15 };
      lp = { x: -dir * 1.3, y: 0.2, rot: -dir * 90 };
      break;
    case 'selfOut':
      // 勇み足: 攻めていた側の足が先に出る
      wp = { x: -dir * 0.88, y: 0, rot: dir * 10 };
      lp = { x: -dir * 1.08, y: 0, rot: 0 };
      break;
    case 'selfFall':
      wp = { x: c - dir * GAP, y: 0, rot: 0 };
      lp = { x: c + dir * 0.2, y: 0.2, rot: -dir * 70 };
      break;
    case 'slapDown':
      // 前に出た側が勢いあまって手をつく
      wp = { x: c - dir * 0.3, y: -0.05, rot: 0 };
      lp = { x: c - dir * 0.1, y: 0.25, rot: -dir * 75 };
      break;
    case 'backward':
      wp = { x: c, y: 0.1, rot: -dir * 25 };
      lp = { x: c - dir * 0.35, y: 0.3, rot: -dir * 110 };
      break;
    default:
      // 投げ・掛け・捻り: 負けた側が回されて土俵の中に倒れる
      wp = { x: c - dir * 0.05, y: 0, rot: 0 };
      lp = { x: c + dir * 0.35, y: 0.35, rot: dir * 100 };
  }
  const finishAt = t;
  lines.push({ t: t - 0.3, key: `bout.finish.${flow.motion}`, a: w, b: l });
  frames.push({
    t,
    east: w === 'E' ? wp : lp,
    west: w === 'E' ? lp : wp,
    contact: false,
    sound: 'fall',
  });
  return { duration: t + 0.7, finishAt, frames, lines };
}

/** 時刻 t の姿勢（キーフレームの間を補間。最後のフレームの後はそのまま） */
export function poseAt(
  script: BoutScript,
  t: number,
): { east: Pose; west: Pose; contact: boolean } {
  const f = script.frames;
  if (t <= f[0]!.t) return { east: f[0]!.east, west: f[0]!.west, contact: f[0]!.contact };
  for (let i = 1; i < f.length; i++) {
    const a = f[i - 1]!;
    const b = f[i]!;
    if (t <= b.t) {
      const k = ease((t - a.t) / (b.t - a.t));
      return {
        east: lerp(a.east, b.east, k),
        west: lerp(a.west, b.west, k),
        contact: b.contact || (a.contact && k < 0.6),
      };
    }
  }
  const last = f[f.length - 1]!;
  return { east: last.east, west: last.west, contact: false };
}

/** 時刻 t までに出た実況の行 */
export function linesAt(script: BoutScript, t: number): CallLine[] {
  return script.lines.filter((l) => l.t <= t);
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const ease = (k: number) => (k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2);
const lerp = (a: Pose, b: Pose, k: number): Pose => ({
  x: a.x + (b.x - a.x) * k,
  y: a.y + (b.y - a.y) * k,
  rot: a.rot + (b.rot - a.rot) * k,
});
