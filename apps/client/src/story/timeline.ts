/**
 * カットシーンのタイムライン（データの形と、経過時間 → 描画の状態を求める純粋関数）
 *
 * シーンは「何秒目に・何を・どこへ動かすか」のキーフレームの表で定義する（scenes/*.ts）。
 * 描画（CutsceneView）は、ここで求めた状態を描くだけで、動きを計算しない。
 * 乱数は使わない（同じシーン・同じ時刻なら、いつも同じ絵になる）。
 */
import { CUTSCENE_CONFIG } from '../config/cutscene';
import type { EffectStrength } from '../config/effects';

export type Ease = 'linear' | 'in' | 'out' | 'inOut';

/** キーフレーム: t 秒の値。次のキーまでは ease で補間する */
export interface Key<T> {
  t: number;
  value: T;
  ease?: Ease;
}

export type CharacterId = 'bolt' | 'chief' | 'nut';

/** キャラクターの状態（ポーズは rig.json のポーズ名。face で表情だけ差し替える） */
export interface ActorValue {
  pose: string;
  x: number;
  /** 足もと（地面）の y */
  y: number;
  /** 高さ（シーンの座標で何 px か） */
  height: number;
  alpha?: number;
  /** 左右反転（左を向く） */
  flip?: boolean;
  /** 表情（ボルトは頭、工場長は運転席の差し替え） */
  face?: string;
}

/** 絵（背景・小物）の状態。asset は story/assets.ts のキー */
export interface PropValue {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
  alpha?: number;
}

export interface ActorTrack {
  kind: 'actor';
  id: string;
  character: CharacterId;
  keys: Key<ActorValue>[];
}

export interface PropTrack {
  kind: 'prop';
  id: string;
  /** 絵（キーフレームごとに差し替えたいときは keys の asset を使う） */
  asset: string;
  keys: Key<PropValue & { asset?: string }>[];
}

export type Track = ActorTrack | PropTrack;

export interface CameraValue {
  /** 画面の中心が見るシーンの座標 */
  x: number;
  y: number;
  zoom: number;
}

export interface Scene {
  id: string;
  /** 長さ（秒）。CUTSCENE_CONFIG.maxDurationSec 以下 */
  duration: number;
  /** 背景の色（シーンの外側・読み込み前） */
  background: string;
  /** 描く順に並べる（後ろが手前） */
  tracks: Track[];
  camera?: Key<CameraValue>[];
  /** 画面の揺れ（t 秒から duration 秒、振れ幅 px）。設定で弱める */
  shakes?: { t: number; duration: number; amplitude: number }[];
  /** 光（t 秒から duration 秒、不透明度。上限 flashMaxAlpha）。設定で弱める・消す */
  flashes?: { t: number; duration: number; alpha: number; color: string }[];
  /** 画面全体の色味（失敗の冷たい色など）。キーフレームで補間 */
  tint?: Key<{ color: string; alpha: number }>[];
  /** 数字だけの文字（カウントダウン）。t0〜t1 秒に出す */
  numbers?: { t0: number; t1: number; text: string; x: number; y: number; size: number }[];
  /** 文字の札（体験版の予告など。i18n のキー） */
  captions?: { t0: number; t1: number; key: string; x: number; y: number; size: number }[];
  /** 効果音（t 秒に鳴らす。サウンドマニフェストのキー） */
  sounds: { t: number; key: string }[];
}

export interface EffectOptions {
  strength: EffectStrength;
  shake: boolean;
  reduceFlashes: boolean;
}

export interface FrameState {
  actors: (ActorValue & {
    id: string;
    character: CharacterId;
    alpha: number;
    /** 次のキーのポーズへ移る途中（k は 0〜1）。同じポーズなら null */
    blend: { to: string; k: number } | null;
  })[];
  props: (PropValue & { id: string; asset: string; alpha: number; rotation: number })[];
  camera: CameraValue;
  /** 揺れのずれ（px） */
  shake: { x: number; y: number };
  flash: { alpha: number; color: string } | null;
  tint: { color: string; alpha: number } | null;
  numbers: { text: string; x: number; y: number; size: number }[];
  captions: { key: string; x: number; y: number; size: number }[];
  /** シーンが終わった（長さ・上限時間を過ぎた） */
  done: boolean;
}

const lerp = (a: number, b: number, k: number) => a + (b - a) * k;

export function ease(kind: Ease | undefined, k: number): number {
  const x = Math.min(1, Math.max(0, k));
  switch (kind) {
    case 'in':
      return x * x;
    case 'out':
      return 1 - (1 - x) * (1 - x);
    case 'inOut':
      return x < 0.5 ? 2 * x * x : 1 - 2 * (1 - x) * (1 - x);
    default:
      return x;
  }
}

/** t のときの前後のキーと、その間の進み具合（0〜1） */
function around<T>(keys: Key<T>[], t: number): { a: Key<T>; b: Key<T>; k: number } | null {
  if (keys.length === 0) return null;
  if (t <= keys[0]!.t) return { a: keys[0]!, b: keys[0]!, k: 0 };
  for (let i = 0; i < keys.length - 1; i++) {
    const a = keys[i]!;
    const b = keys[i + 1]!;
    if (t < b.t) return { a, b, k: ease(a.ease, (t - a.t) / (b.t - a.t)) };
  }
  const last = keys[keys.length - 1]!;
  return { a: last, b: last, k: 0 };
}

/** 数値の項目だけを補間し、それ以外（ポーズ名・表情・絵）は前のキーの値を使う */
function mix<T extends object>(a: T, b: T, k: number): T {
  const out: Record<string, unknown> = { ...(a as Record<string, unknown>) };
  for (const [key, va] of Object.entries(a as Record<string, unknown>)) {
    const vb = (b as Record<string, unknown>)[key];
    if (typeof va === 'number' && typeof vb === 'number') out[key] = lerp(va, vb, k);
  }
  return out as T;
}

/** 決まった揺れ（乱数を使わない: 同じ時刻なら同じずれ） */
function shakeAt(scene: Scene, t: number, scale: number): { x: number; y: number } {
  let x = 0;
  let y = 0;
  for (const s of scene.shakes ?? []) {
    if (t < s.t || t > s.t + s.duration) continue;
    const fade = 1 - (t - s.t) / s.duration;
    const amp = s.amplitude * fade * scale;
    x += Math.sin(t * 71) * amp;
    y += Math.cos(t * 53) * amp;
  }
  return { x, y };
}

/** 経過時間 t 秒のときの描画の状態 */
export function sampleScene(scene: Scene, t: number, options: EffectOptions): FrameState {
  const limit = Math.min(scene.duration, CUTSCENE_CONFIG.maxDurationSec);
  const time = Math.min(Math.max(0, t), limit);
  const actors: FrameState['actors'] = [];
  const props: FrameState['props'] = [];
  for (const track of scene.tracks) {
    const at = around(track.keys as Key<object>[], time);
    if (!at) continue;
    if (track.kind === 'actor') {
      const a = at.a.value as ActorValue;
      const b = at.b.value as ActorValue;
      const v = mix(a, b, at.k);
      actors.push({
        ...v,
        id: track.id,
        character: track.character,
        alpha: v.alpha ?? 1,
        blend: a.pose !== b.pose && at.k > 0 ? { to: b.pose, k: at.k } : null,
      });
    } else {
      type Value = PropValue & { asset?: string };
      const v = mix(at.a.value as Value, at.b.value as Value, at.k);
      props.push({
        ...v,
        id: track.id,
        asset: v.asset ?? track.asset,
        alpha: v.alpha ?? 1,
        rotation: v.rotation ?? 0,
      });
    }
  }
  const strength = CUTSCENE_CONFIG.strength[options.strength];
  const cam = scene.camera ? around(scene.camera, time) : null;
  const flash = (scene.flashes ?? []).find((f) => time >= f.t && time <= f.t + f.duration);
  const flashScale = options.reduceFlashes ? 0 : strength;
  const tintAt = scene.tint ? around(scene.tint, time) : null;
  return {
    actors,
    props,
    camera: cam
      ? mix(cam.a.value, cam.b.value, cam.k)
      : {
          x: CUTSCENE_CONFIG.stage.width / 2,
          y: CUTSCENE_CONFIG.stage.height / 2,
          zoom: 1,
        },
    shake: shakeAt(scene, time, options.shake ? strength : 0),
    flash:
      flash && flashScale > 0
        ? {
            // 山なりに明るくなって消える。上限を超えない
            alpha:
              Math.min(flash.alpha, CUTSCENE_CONFIG.flashMaxAlpha) *
              flashScale *
              Math.sin(((time - flash.t) / flash.duration) * Math.PI),
            color: flash.color,
          }
        : null,
    tint: tintAt
      ? {
          color: tintAt.a.value.color,
          alpha: lerp(tintAt.a.value.alpha, tintAt.b.value.alpha, tintAt.k),
        }
      : null,
    numbers: (scene.numbers ?? [])
      .filter((n) => time >= n.t0 && time < n.t1)
      .map(({ text, x, y, size }) => ({ text, x, y, size })),
    captions: (scene.captions ?? [])
      .filter((c) => time >= c.t0 && time < c.t1)
      .map(({ key, x, y, size }) => ({ key, x, y, size })),
    done: t >= limit,
  };
}

/** t0 より後・t1 以下に鳴らす効果音（再生のフレームごとに呼ぶ） */
export function soundsBetween(scene: Scene, t0: number, t1: number): string[] {
  return scene.sounds.filter((s) => s.t > t0 && s.t <= t1).map((s) => s.key);
}

/** シーンの安全の確認（テスト用）: 長さの上限・光の回数（1秒あたり）・光の明るさ */
export function checkScene(scene: Scene): string[] {
  const problems: string[] = [];
  if (scene.duration > CUTSCENE_CONFIG.maxDurationSec) problems.push(`${scene.id}: 長すぎる`);
  const flashes = [...(scene.flashes ?? [])].sort((a, b) => a.t - b.t);
  for (let i = 0; i < flashes.length; i++) {
    const within = flashes.filter((f) => f.t >= flashes[i]!.t && f.t < flashes[i]!.t + 1);
    if (within.length > CUTSCENE_CONFIG.flashesPerSecond) {
      problems.push(`${scene.id}: 光が1秒に${within.length}回`);
      break;
    }
  }
  for (const f of flashes) {
    if (f.alpha > CUTSCENE_CONFIG.flashMaxAlpha) problems.push(`${scene.id}: 光が明るすぎる`);
  }
  for (const track of scene.tracks) {
    for (let i = 1; i < track.keys.length; i++) {
      if (track.keys[i]!.t < track.keys[i - 1]!.t)
        problems.push(`${scene.id}/${track.id}: キーの順番`);
    }
  }
  return problems;
}
