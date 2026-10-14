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
    case 'overheat':
      return `overheat#${e.signalId}(${e.x},${e.y})`;
    case 'absorb':
      return `absorb#${e.signalId}(${e.x},${e.y})`;
    case 'store':
      return `store(${e.x},${e.y})=${e.value ?? '-'}`;
    case 'teleport':
      return `teleport(${e.x},${e.y})→(${e.toX},${e.toY})`;
    case 'income':
      return `income+${e.amount}=${e.total}`;
    case 'floor':
      return `floor:${e.tile}(${e.x},${e.y})${e.before}→${e.after}`;
    case 'halt':
      return `halt:${e.reason}(${e.remainingSignals})`;
  }
}
