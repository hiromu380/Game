/**
 * 取組の短い演出の台本（純粋関数）
 *
 * 決まり手と勝った側から、2人の位置・傾きの時間ごとの変化（キーフレーム）を作る。
 * 演出の揺らぎは取組ごとのシード（日・東西の力士 ID）から決め、同じ取組なら同じ動きになる。
 * 座標は土俵の中心が (0, 0)、土俵の半径が 1。東が右、西が左から始まる。
 */
export interface Pose {
  x: number;
  y: number;
  /** 傾き（度）。倒れるときに大きくなる */
  rot: number;
}

export interface Keyframe {
  /** 秒 */
  t: number;
  east: Pose;
  west: Pose;
  /** この時刻に鳴らす音 */
  sound?: 'clap' | 'hit' | 'fall';
}

export interface BoutScript {
  duration: number;
  frames: Keyframe[];
}

type Finish = 'push' | 'throw' | 'slapDown' | 'lift' | 'behind';

const FINISH: Record<string, Finish> = {
  oshidashi: 'push',
  tsukidashi: 'push',
  oshitaoshi: 'push',
  yorikiri: 'push',
  yoritaoshi: 'push',
  tsuridashi: 'lift',
  uwatenage: 'throw',
  shitatenage: 'throw',
  kotenage: 'throw',
  uwatedashinage: 'throw',
  tsukiotoshi: 'slapDown',
  hatakikomi: 'slapDown',
  hikiotoshi: 'slapDown',
  katasukashi: 'slapDown',
  okuridashi: 'behind',
};

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

export function boutScript(kimarite: string, winner: 'E' | 'W', seed: number): BoutScript {
  const r = rand(seed);
  const finish = FINISH[kimarite] ?? 'push';
  // 勝った側を w、負けた側を l と呼び、最後に東西へ戻す
  const dir = winner === 'E' ? -1 : 1; // 勝った側が押す向き（東が勝てば西 = 左へ）
  const start = (side: 'E' | 'W'): Pose => ({ x: side === 'E' ? 0.35 : -0.35, y: 0, rot: 0 });
  const wSide = winner;
  const lSide: 'E' | 'W' = winner === 'E' ? 'W' : 'E';
  const frames: { t: number; w: Pose; l: Pose; sound?: Keyframe['sound'] }[] = [];
  const w0 = start(wSide);
  const l0 = start(lSide);
  frames.push({ t: 0, w: w0, l: l0, sound: 'clap' });
  // 立ち合い: 中央でぶつかる
  const clash = 0.6 + r() * 0.2;
  frames.push({
    t: clash,
    w: { x: 0.12 * -dir, y: 0, rot: 0 },
    l: { x: 0.12 * dir, y: 0, rot: 0 },
    sound: 'hit',
  });
  // もみ合い（押し返す時間。決まり手によって長さが変わる）
  const struggle = clash + 0.5 + r() * 0.6;
  const sway = (r() - 0.5) * 0.3;
  frames.push({
    t: struggle,
    w: { x: sway - 0.12 * dir, y: (r() - 0.5) * 0.2, rot: 0 },
    l: { x: sway + 0.12 * dir, y: (r() - 0.5) * 0.2, rot: 0 },
  });
  const end = struggle + 0.9;
  const out = 1.25; // 土俵の外
  switch (finish) {
    case 'push':
    case 'lift':
      frames.push({
        t: end,
        w: { x: dir * 0.85, y: 0, rot: 0 },
        l: { x: dir * out, y: 0, rot: kimarite.endsWith('taoshi') ? dir * 80 : 0 },
        sound: 'fall',
      });
      break;
    case 'behind':
      frames.push({
        t: end,
        w: { x: dir * 0.9, y: 0.1, rot: 0 },
        l: { x: dir * out, y: 0.1, rot: 0 },
        sound: 'fall',
      });
      break;
    case 'throw':
      // 投げ: 負けた側が回されて倒れる（土俵の中）
      frames.push({
        t: end,
        w: { x: -dir * 0.05, y: 0, rot: 0 },
        l: { x: dir * 0.45, y: 0.35, rot: dir * 100 },
        sound: 'fall',
      });
      break;
    case 'slapDown':
      // はたき・突き落とし: 前に出た側が勢いあまって手をつく
      frames.push({
        t: end,
        w: { x: -dir * 0.3, y: -0.05, rot: 0 },
        l: { x: -dir * 0.15, y: 0.25, rot: -dir * 70 },
        sound: 'fall',
      });
      break;
  }
  return {
    duration: end + 0.6,
    frames: frames.map((f) => ({
      t: f.t,
      east: wSide === 'E' ? f.w : f.l,
      west: wSide === 'E' ? f.l : f.w,
      ...(f.sound ? { sound: f.sound } : {}),
    })),
  };
}

/** 時刻 t の姿勢（キーフレームの間を補間。最後のフレームの後はそのまま） */
export function poseAt(script: BoutScript, t: number): { east: Pose; west: Pose } {
  const f = script.frames;
  if (t <= f[0]!.t) return { east: f[0]!.east, west: f[0]!.west };
  for (let i = 1; i < f.length; i++) {
    const a = f[i - 1]!;
    const b = f[i]!;
    if (t <= b.t) {
      const k = ease((t - a.t) / (b.t - a.t));
      return { east: lerp(a.east, b.east, k), west: lerp(a.west, b.west, k) };
    }
  }
  const last = f[f.length - 1]!;
  return { east: last.east, west: last.west };
}

const ease = (k: number) => (k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2);
const lerp = (a: Pose, b: Pose, k: number): Pose => ({
  x: a.x + (b.x - a.x) * k,
  y: a.y + (b.y - a.y) * k,
  rot: a.rot + (b.rot - a.rot) * k,
});
