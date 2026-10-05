/**
 * 結果発表の既読（最後に見た週の ID）。セーブデータとは別に端末へ保存する
 * （タイトルの未読バッジと、チャレンジ画面を開いたときの結果発表の自動表示に使う）
 */
export const RESULTS_SEEN_KEY = 'chain-factory.weekly.resultsSeen';

type Storage = Pick<globalThis.Storage, 'getItem' | 'setItem'>;

function defaultStorage(): Storage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

/** 最後に見た結果発表の週の ID（まだなければ null） */
export function loadResultsSeen(storage: Storage | null = defaultStorage()): string | null {
  try {
    const value = storage?.getItem(RESULTS_SEEN_KEY) ?? null;
    return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
  } catch {
    return null;
  }
}

/** 見た週を記録する（古い週を見ても戻さない） */
export function markResultsSeen(weekId: string, storage: Storage | null = defaultStorage()) {
  const seen = loadResultsSeen(storage);
  if (seen !== null && seen >= weekId) return;
  try {
    storage?.setItem(RESULTS_SEEN_KEY, weekId);
  } catch {
    // 保存できない環境（プライベートモードなど）では毎回未読になるだけ
  }
}

/** 新しい結果発表があるか（latest は確定済みの週で一番新しいもの） */
export function hasUnreadResults(latest: string | undefined, seen: string | null): boolean {
  return latest !== undefined && (seen === null || latest > seen);
}
