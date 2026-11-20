/**
 * 本場所の星取り（1日ずつ見せる）: 自分の弟子の取組を、日ごとの印にする（純粋関数）
 */
import type { BoutResult } from '@ichimon/sim';

/** その日の印: 白星・黒星・不戦勝・不戦敗・取組なし */
export type Mark = 'win' | 'loss' | 'fusenWin' | 'fusenLoss' | null;

export const BASHO_DAYS = 15;

export interface TickerRow {
  id: number;
  /** 1日目から15日目まで */
  marks: Mark[];
}

export function tickerRow(id: number, bouts: readonly BoutResult[]): TickerRow {
  const marks: Mark[] = Array.from({ length: BASHO_DAYS }, () => null);
  for (const b of bouts) {
    if (b.day < 1 || b.day > BASHO_DAYS) continue;
    const won = b.winnerId === id;
    marks[b.day - 1] = b.fusen ? (won ? 'fusenWin' : 'fusenLoss') : won ? 'win' : 'loss';
  }
  return { id, marks };
}

/** その日までの勝ち負け */
export function tallyUntil(row: TickerRow, day: number): { wins: number; losses: number } {
  let wins = 0;
  let losses = 0;
  for (const m of row.marks.slice(0, day)) {
    if (m === 'win' || m === 'fusenWin') wins++;
    else if (m === 'loss' || m === 'fusenLoss') losses++;
  }
  return { wins, losses };
}

/**
 * その日までに、勝ち越し・負け越しが決まったか（関取は8、幕下以下は4。決まっていなければ null）
 */
export function decidedUntil(
  row: TickerRow,
  day: number,
  sekitori: boolean,
): 'kachikoshi' | 'makekoshi' | null {
  const need = sekitori ? 8 : 4;
  const { wins, losses } = tallyUntil(row, day);
  return wins >= need ? 'kachikoshi' : losses >= need ? 'makekoshi' : null;
}
