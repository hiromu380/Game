/**
 * セーブデータ v1（フェーズ1）の形式
 *
 * 過去の形式は変換のためだけに残す。現在の型（RunState など）を参照せず、
 * 当時の形をそのまま書き写しておくこと（現在の型が変わっても v1 の読み込みが壊れないように）。
 */

export interface RunStateV1 {
  seed: number;
  shiftIndex: number;
  phase: 'building' | 'cleared' | 'failed';
  budget: number;
  board: { width: number; height: number; cells: ({ id: string; dir: number } | null)[] };
  inventory: Record<string, number>;
  shop: { partId: string; price: number; sold: boolean }[];
  history: {
    shiftIndex: number;
    score: string;
    quota: number;
    cleared: boolean;
    chainCount: number;
  }[];
}

export interface SaveDataV1 {
  version: 1;
  run: RunStateV1 | null;
}
