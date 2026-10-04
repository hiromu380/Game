/**
 * シーンを書くための小さな道具（キーフレームの表を短く書く）
 */
import type {
  ActorTrack,
  ActorValue,
  CharacterId,
  Ease,
  Key,
  PropTrack,
  PropValue,
} from '../timeline';

export const W = 1280;
export const H = 720;
/** 地面の y（工場の床・屋根の上・月面などの標準） */
export const GROUND = 600;
/** ボルト・工場長の標準の高さ（工場長はボルトの約2倍） */
export const BOLT_H = 250;
export const CHIEF_H = 500;

export const key = <T>(t: number, value: T, ease?: Ease): Key<T> => ({ t, value, ease });

export function actor(id: string, character: CharacterId, keys: Key<ActorValue>[]): ActorTrack {
  return { kind: 'actor', id, character, keys };
}

export function prop(
  id: string,
  asset: string,
  keys: Key<PropValue & { asset?: string }>[],
): PropTrack {
  return { kind: 'prop', id, asset, keys };
}

/** 絵の位置と大きさ */
export const at = (
  x: number,
  y: number,
  width: number,
  height: number,
  alpha = 1,
  extra: Partial<PropValue> = {},
) => ({
  x,
  y,
  width,
  height,
  alpha,
  ...extra,
});

/** 画面いっぱいの背景を t0〜t1 秒だけ見せる（前後 fade 秒でフェード） */
export function backdrop(id: string, asset: string, t0: number, t1: number, fade = 0.4): PropTrack {
  const full = (alpha: number) => at(0, 0, W, H, alpha);
  const keys = [key(0, full(t0 <= 0 ? 1 : 0))];
  if (t0 > 0) keys.push(key(t0 - fade, full(0)), key(t0, full(1)));
  if (t1 < Infinity) keys.push(key(t1, full(1)), key(t1 + fade, full(0)));
  return prop(id, asset, keys);
}

/** ロケットの絵の大きさ（素材は 96×104） */
export const rocketBox = (cx: number, bottom: number, height: number, alpha = 1) =>
  at(cx - (height * 96) / 104 / 2, bottom - height, (height * 96) / 104, height, alpha);

/** 黒へのフェード（場面の切り替え）: t 秒を中心に、前後 half 秒 */
export function blackout(t: number, half = 0.35) {
  return [
    key(t - half, { color: '#000000', alpha: 0 }),
    key(t, { color: '#000000', alpha: 1 }),
    key(t + half, { color: '#000000', alpha: 0 }),
  ];
}

/**
 * t 秒に現れる（それまでは見えない）。キーの間は補間されるので、直前に「見えない」キーを置いて、
 * 長い区間をかけて少しずつ見えてくるのを防ぐ
 */
export function appear<T extends { alpha?: number }>(t: number, value: T, fade = 0.3): Key<T>[] {
  return [
    key(Math.max(0, t - fade), { ...value, alpha: 0 }),
    key(t, { ...value, alpha: value.alpha ?? 1 }),
  ];
}

/** t 秒に消える（fade 秒かけて） */
export function vanish<T extends { alpha?: number }>(t: number, value: T, fade = 0.3): Key<T>[] {
  return [key(t, { ...value, alpha: value.alpha ?? 1 }), key(t + fade, { ...value, alpha: 0 })];
}

/**
 * 歩く: x0 → x1 を t0〜t1 秒で。2つのコマ（walk・walkB）を交互に出し、上下に少し弾ませる。
 * make は位置とポーズからキャラクターの状態を作る（大きさ・向きなどを決める）
 */
export function walk(
  t0: number,
  t1: number,
  x0: number,
  x1: number,
  make: (pose: string, x: number, bob: number) => ActorValue,
  step = 0.32,
): Key<ActorValue>[] {
  const keys: Key<ActorValue>[] = [];
  const n = Math.max(1, Math.round((t1 - t0) / step));
  for (let i = 0; i <= n; i++) {
    const k = i / n;
    const pose = i === n ? 'walk' : i % 2 === 0 ? 'walk' : 'walkB';
    // コマの切り替えの直前まで同じコマを保つ（ポーズは前のキーのものが使われる）
    keys.push(key(t0 + (t1 - t0) * k, make(pose, x0 + (x1 - x0) * k, i % 2 === 0 ? 0 : -6)));
  }
  return keys;
}
