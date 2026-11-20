/**
 * 部屋の日誌: 自分の部屋と分家の出来事を時系列で残す（名前はそのときのものを書き写す）
 */
import type { GameState, JournalEvent } from '../model/types';

export function note(state: GameState, event: JournalEvent): void {
  state.journal.push({ bashoIndex: state.bashoIndex, ...event });
}
