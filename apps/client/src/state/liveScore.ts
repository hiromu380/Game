/**
 * 再生中の出荷量の途中経過（画面上部の表示用）
 *
 * 出荷のたびに変わるので、ゲーム画面全体の状態には入れず、ここに置いて表示する部品（Hud）だけが読む。
 * こうすると、連鎖の再生中にショップ・手持ちなど関係のない部品まで描き直さずに済む。
 */
import { useSyncExternalStore } from 'react';

let current: string | null = null;
const listeners = new Set<() => void>();

/** 値が変わったときに呼ぶ関数を登録する（戻り値で解除） */
export function subscribeLiveScore(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** 途中経過を更新する（数字の文字列。null で表示を消す） */
export function setLiveScore(value: string | null): void {
  if (value === current) return;
  current = value;
  for (const listener of listeners) listener();
}

export function getLiveScore(): string | null {
  return current;
}

/** 途中経過を読む（変わったら、読んでいる部品だけが描き直される） */
export function useLiveScore(): string | null {
  return useSyncExternalStore(subscribeLiveScore, getLiveScore);
}
