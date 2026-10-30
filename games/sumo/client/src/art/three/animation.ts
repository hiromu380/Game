/**
 * 取組の見た目だけを補完する決定論的な関節モーション。
 * 既存台本の位置・勝敗は変更せず、時刻と姿勢だけから同じ角度を返す。
 * shiko は立ち合い前の短い足上げを表現し、場所前の正式な所作を再現するものではない。
 */
export interface MotionClock {
  time: number;
  clash: number;
  duration: number;
}

export interface MotionPose {
  x: number;
  y: number;
  rot: number;
}

export interface WrestlerMotion {
  /** 腕を前に出す角度（ラジアン） */
  armsX: number;
  /** 脚を外へ開く角度（左・右） */
  legsZ: readonly [number, number];
  /** 脚のすり足による前後動 */
  legsX: readonly [number, number];
  /** 腰を落とす分のスケール */
  bodyScaleY: number;
  /** 足と土俵の接触を保った範囲の小さな上下動 */
  rootRise: number;
  /** 土俵上の移動とは別の身体の傾き */
  leanZ: number;
  /** 足元の印を薄く伸縮させる係数 */
  shadowScale: number;
}

const clamp = (x: number) => Math.max(0, Math.min(1, x));
const smooth = (x: number) => {
  const s = clamp(x);
  return s * s * (3 - 2 * s);
};
const windowPulse = (t: number, a: number, b: number) => {
  if (t <= a || t >= b || b <= a) return 0;
  return Math.sin(Math.PI * ((t - a) / (b - a)));
};

/** time===duration は演出の終了姿勢。reduced-motion 時にも余計な揺れを出さない。 */
export function wrestlerMotion(
  clock: MotionClock | undefined,
  pose: MotionPose,
  side: 'E' | 'W',
  arms: 'side' | 'push' | 'up',
): WrestlerMotion {
  const duration = Math.max(0.001, clock?.duration ?? 1);
  const time = Math.max(0, Math.min(duration, clock?.time ?? duration));
  const clash = Math.max(0.2, Math.min(duration, clock?.clash ?? 0.7));
  const finished = time >= duration;
  const sign = side === 'E' ? -1 : 1;
  const fall = smooth((Math.abs(pose.rot) - 20) / 65);
  const onset = smooth((time - (clash - 0.17)) / 0.30);
  const release = 1 - smooth((time - (duration - 0.55)) / 0.4);
  const moving = finished ? 0 : onset * Math.max(0, release) * (1 - fall);
  // 片足ずつ上げる。立ち合い前の短時間に収め、突進中の跳躍は避ける。
  const shiko = finished ? 0 : windowPulse(time, 0.045, Math.min(0.43, clash * 0.73));
  const shikoLeg = side === 'E' ? 0 : 1;
  const leftLift = shikoLeg === 0 ? shiko : 0;
  const rightLift = shikoLeg === 1 ? shiko : 0;
  const step = Math.sin(time * 19) * 0.095 * moving;
  const impact = windowPulse(time, clash - 0.08, clash + 0.2) * (1 - fall);
  const pushing = !finished && arms === 'push' ? smooth((time - clash + 0.15) / 0.27) * (1 - fall) : 0;
  const crouch = (1 - smooth(time / clash)) * 0.10 + impact * 0.055;
  const bob = !finished ? Math.abs(Math.sin(time * 19)) * 0.025 * moving : 0;
  const z0 = -0.40 * leftLift - step;
  const z1 = 0.40 * rightLift + step;
  return {
    armsX: arms === 'up' && !finished ? -1.6 : -0.72 * pushing,
    legsZ: [z0, z1],
    legsX: [step * 1.8, -step * 1.8],
    bodyScaleY: 1 - crouch,
    rootRise: 0.05 * shiko + bob + 0.08 * fall,
    leanZ: sign * (0.095 * pushing + 0.035 * impact),
    shadowScale: 1 + 0.12 * shiko + 0.14 * fall,
  };
}
