/**
 * 再生中の「見せ場」を、盤面（PixiJS）から画面の部品（ボルト・出荷の箱）へ伝える小さな連絡係
 *
 * ゲームの状態には入れない（見た目だけの一時的な情報で、変わるたびに画面全体を描き直したくないため）。
 * - ボルトの気分: 連鎖の節目で喜ぶ・桁上がりやピークで驚く（ui/WorkshopBackdrop.tsx が読む）
 * - 出荷の箱: 出荷口から画面上部の出荷量へ飛ぶ箱（ui/ShipFlights.tsx が受け取る）
 */
import { useSyncExternalStore } from 'react';

/** 再生中の見せ場の種類 */
export type PlaybackMoment = 'chainMilestone' | 'digitUp' | 'quotaCross' | 'peak';

/** ボルトの気分（null は場面ごとの既定の表情） */
export type BoltMood = 'happy' | 'surprised' | null;

const MOOD_OF: Record<PlaybackMoment, BoltMood> = {
  chainMilestone: 'happy',
  quotaCross: 'happy',
  digitUp: 'surprised',
  peak: 'surprised',
};

/** 気分と、同じ気分が続いても弾み直すための通し番号 */
let mood: { mood: BoltMood; beat: number } = { mood: null, beat: 0 };
const moodListeners = new Set<() => void>();

function setMood(next: BoltMood): void {
  if (next === null && mood.mood === null) return;
  mood = { mood: next, beat: mood.beat + 1 };
  for (const listener of moodListeners) listener();
}

/** 見せ場が来た（盤面の再生から呼ぶ） */
export function notifyMoment(moment: PlaybackMoment): void {
  setMood(MOOD_OF[moment]);
}

/** 再生の始まり・終わりに、気分を既定に戻す */
export function resetMoments(): void {
  setMood(null);
}

export function getBoltMood(): { mood: BoltMood; beat: number } {
  return mood;
}

export function useBoltMood(): { mood: BoltMood; beat: number } {
  return useSyncExternalStore((listener) => {
    moodListeners.add(listener);
    return () => {
      moodListeners.delete(listener);
    };
  }, getBoltMood);
}

/** 出荷の箱1つ分（画面上の位置。px） */
export interface ShipFlight {
  clientX: number;
  clientY: number;
}

const flightListeners = new Set<(flight: ShipFlight) => void>();

/** 出荷口から箱を飛ばす（盤面の再生から呼ぶ） */
export function emitShipFlight(flight: ShipFlight): void {
  for (const listener of flightListeners) listener(flight);
}

export function subscribeShipFlights(listener: (flight: ShipFlight) => void): () => void {
  flightListeners.add(listener);
  return () => {
    flightListeners.delete(listener);
  };
}
