/**
 * イベントを1行の文字列にする（デバッグ表示用。開発者向けなので i18n は通さない）
 */
import type { SimEvent } from '@chain-factory/sim';

export function eventToText(e: SimEvent): string {
  switch (e.type) {
    case 'emit':
      return `emit#${e.signalId}(${e.x},${e.y})d${e.dir}=${e.value}`;
    case 'move':
      return `move#${e.signalId}(${e.x},${e.y})`;
    case 'activate':
      return `${e.partId}(${e.x},${e.y})`;
    case 'ship':
      return `ship+${e.value}=${e.total}`;
    case 'reset':
      return `reset(${e.x},${e.y})`;
    case 'vanish':
      return `vanish#${e.signalId}:${e.reason}`;
    case 'absorb':
      return `absorb#${e.signalId}(${e.x},${e.y})`;
    case 'income':
      return `income+${e.amount}=${e.total}`;
    case 'floor':
      return `floor:${e.tile}(${e.x},${e.y})${e.before}→${e.after}`;
    case 'halt':
      return `halt:${e.reason}(${e.remainingSignals})`;
  }
}
