import { createRun } from '@chain-factory/sim';
import { describe, expect, it } from 'vitest';
import { SHARE_CONFIG } from '../src/config/share';
import {
  buildShareCard,
  fitScoreSize,
  type DrawCommand,
  type ShareCardInput,
} from '../src/share/card';

const normal = (score = '12,345'): ShareCardInput => ({
  title: '打ち上げ成功！',
  subtitle: null,
  scoreLabel: '出荷量',
  score,
  shifts: 'シフト 9 まで到達',
  rank: null,
  board: {
    ...createRun(1).board,
    cells: createRun(1).board.cells.map((_, i) =>
      i === 0 ? { id: 'switch', dir: 1 } : i === 1 ? { id: 'dock', dir: 1 } : null,
    ),
  },
  results: null,
  url: 'https://example.com/game',
});

const daily = (rank: string | null): ShareCardInput => ({
  ...normal(),
  title: 'デイリー #12',
  subtitle: '2026-10-01',
  shifts: '達成シフト 2 / 3',
  rank,
  board: null,
  results: ['cleared', 'cleared', 'failed'],
});

const texts = (cs: DrawCommand[]) => cs.flatMap((c) => (c.kind === 'text' ? [c.text] : []));
const images = (cs: DrawCommand[]) => cs.flatMap((c) => (c.kind === 'image' ? [c.image] : []));

describe('共有カード', () => {
  for (const size of ['landscape', 'square'] as const) {
    it(`${size}: すべての命令がカードの中に収まる`, () => {
      const { width, height } = SHARE_CONFIG.sizes[size];
      for (const input of [normal(), daily('3位・上位 5%'), normal('9'.repeat(40))]) {
        for (const c of buildShareCard(input, size)) {
          if (c.kind === 'text') continue;
          expect(c.x).toBeGreaterThanOrEqual(0);
          expect(c.y).toBeGreaterThanOrEqual(0);
          expect(c.x + c.w).toBeLessThanOrEqual(width + 0.001);
          expect(c.y + c.h).toBeLessThanOrEqual(height + 0.001);
        }
      }
    });
  }

  it('通常ラン: ロゴ・出荷量・到達シフト・URL と、盤面の縮小図（置いたパーツ）を載せる', () => {
    const cs = buildShareCard(normal(), 'landscape');
    expect(texts(cs)).toEqual(
      expect.arrayContaining([
        '打ち上げ成功！',
        '12,345',
        'シフト 9 まで到達',
        'https://example.com/game',
      ]),
    );
    expect(images(cs)).toEqual(expect.arrayContaining(['logo', 'part:switch', 'part:dock']));
  });

  it('デイリー: 盤面は載せず（ネタバレ防止）、日付・順位・シフトごとの結果を載せる', () => {
    const cs = buildShareCard(daily('3位・上位 5%'), 'square');
    expect(images(cs).some((i) => i.startsWith('part:'))).toBe(false);
    expect(texts(cs)).toEqual(expect.arrayContaining(['2026-10-01', '3位・上位 5%']));
    // 結果の四角（達成・達成・未達）
    expect(cs.filter((c) => c.kind === 'rect' && c.radius !== undefined)).toHaveLength(3);
  });

  it('デイリー: 順位が取れなければ順位の行を出さない', () => {
    const cs = buildShareCard(daily(null), 'landscape');
    expect(texts(cs).some((t) => t.includes('位'))).toBe(false);
  });

  it('出荷量の桁が多いほど文字を小さくし、枠の幅に収める（下限あり）', () => {
    const width = 500;
    const short = fitScoreSize('12,345', width);
    const long = fitScoreSize('1,234,567,890,123', width);
    expect(long).toBeLessThan(short);
    expect(long * 17 * SHARE_CONFIG.digitWidthRatio).toBeLessThanOrEqual(width);
    expect(fitScoreSize('9'.repeat(200), width)).toBe(SHARE_CONFIG.scoreFont.min);
    expect(fitScoreSize('1', width)).toBe(SHARE_CONFIG.scoreFont.max);
  });
});
