/**
 * 代表的な連鎖パターンのスナップショットテスト
 *
 * バランス定数や挙動を変えるとスナップショットが変わる。
 * 意図した変更なら `pnpm test -- -u` で更新すること。
 */
import { describe, expect, it } from 'vitest';
import { scoreToString, type SimEvent } from '../src';
import { run } from './helpers';

/** スナップショット用に結果を読みやすい形へ整形する */
function summarize(rows: string[], seed = 1) {
  const { scoreText, stats, events } = run(rows, seed);
  return {
    score: scoreText,
    stats: { ...stats, maxValue: scoreToString(stats.maxValue) },
    // tick ごとのイベントを1行の文字列にまとめる
    timeline: groupByTick(events),
  };
}

function groupByTick(events: SimEvent[]): string[] {
  const lines: string[] = [];
  for (const e of events) {
    const text = (() => {
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
      }
    })();
    lines[e.tick] = lines[e.tick] ? `${lines[e.tick]} ${text}` : `t${e.tick}: ${text}`;
  }
  return lines;
}

describe('連鎖パターン', () => {
  it('ギア直列: 倍々で増える', () => {
    expect(summarize(['S> G> G> G> G> D>'])).toMatchSnapshot();
  });

  it('プレス機の密集: 隣接パーツが多いほど跳ねる', () => {
    expect(summarize(['.. G^ ..', 'S> P> D>', '.. Gv ..'])).toMatchSnapshot();
  });

  it('分岐器 × 出荷口2つ', () => {
    expect(summarize(['.. G> Dv', 'S> Y> ..', '.. G> D^'])).toMatchSnapshot();
  });

  it('ドラム缶の爆発で周囲の出荷口へ一斉出荷', () => {
    expect(summarize(['D> D> D>', 'D> B^ D>', 'G> G^ D>', 'S^ .. ..'])).toMatchSnapshot();
  });

  it('再起動装置でギアと分岐器を2周させる', () => {
    // 1周目: 2 を出荷 → 再起動装置がギア・分岐器をリセット → 2周目: 4 を出荷（合計 6）
    expect(summarize(['.. .. D> ..', '.. C> Y> ..', 'S> G^ R< ..'])).toMatchSnapshot();
  });

  it('大型コンボ: ギア → プレス → 分岐 → ドラム缶 → 出荷口群', () => {
    expect(
      summarize([
        '.. .. .. D> D> D> ..',
        '.. .. .. D> B^ D> ..',
        '.. .. .. .. C^ .. ..',
        'S> G> G> P> Y> .. ..',
        '.. .. .. G^ Cv .. ..',
        '.. .. .. D> B^ D> ..',
        '.. .. .. D> D> D> ..',
      ]),
    ).toMatchSnapshot();
  });
});
