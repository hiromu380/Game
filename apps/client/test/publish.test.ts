/**
 * 公開準備まわりの純粋な処理: シェア文・相場の前日比・通常ランの組み立て（体験版の制限・相場の適用）
 */
import type { MarketResponse } from '@chain-factory/shared';
import { BALANCE, createInitialMeta, type ShiftRecord } from '@chain-factory/sim';
import { describe, expect, it } from 'vitest';
import { translate } from '../src/i18n';
import { priceTrends } from '../src/online/market';
import {
  buildRunShareText,
  buildShareText,
  resultSquares,
  xIntentUrl,
} from '../src/online/shareText';
import { startNormalRun } from '../src/state/newRun';

const record = (cleared: boolean): ShiftRecord => ({
  shiftIndex: 0,
  score: '10',
  quota: 5,
  cleared,
  chainCount: 3,
  income: 0,
  boss: null,
});
const t = ((key: string, params?: Record<string, string | number>) =>
  translate('ja', key, params)) as Parameters<typeof buildShareText>[0];

describe('シェア文', () => {
  it('シフトごとの結果を絵文字にする（未到達は白）', () => {
    expect(resultSquares([record(true), record(false)], 3)).toBe('🟩🟥⬜');
    expect(resultSquares([], 3)).toBe('⬜⬜⬜');
  });

  it('番号・結果・出荷量・最大連鎖・順位を入れ、盤面の情報は入れない', () => {
    const text = buildShareText(t, {
      number: 12,
      history: [record(true), record(true), record(false)],
      shiftCount: 3,
      maxChain: 34,
      score: '12.3K',
      rank: { rank: 5, topPercent: 7 },
    });
    expect(text).toContain('#ChainFactory');
    expect(text).toContain('#12');
    expect(text).toContain('🟩🟩🟥');
    expect(text).toContain('12.3K');
    expect(text).toContain('34');
    expect(text).toContain('5位');
    expect(text).toContain('7%');
  });

  it('順位が取れなければ順位・上位○% を省く', () => {
    const text = buildShareText(t, {
      number: 1,
      history: [],
      shiftCount: 3,
      maxChain: 0,
      score: '0',
      rank: null,
    });
    expect(text).not.toContain('%');
    expect(text).not.toContain('位');
  });

  it('英語の本文も組み立てられる（通常ラン）', () => {
    const en = ((key: string, params?: Record<string, string | number>) =>
      translate('en', key, params)) as Parameters<typeof buildRunShareText>[0];
    const text = buildRunShareText(en, { result: 'Launch successful!', score: '1.23M', shift: 9 });
    expect(text).toContain('#ChainFactory');
    expect(text).toContain('1.23M');
    expect(text).toContain('Reached shift 9');
    expect(buildRunShareText(t, { result: '打ち上げ成功！', score: '1.23M', shift: 9 })).toContain(
      'シフト 9 まで到達',
    );
  });

  it('X の投稿画面の URL は本文と URL をエンコードする', () => {
    expect(xIntentUrl('a b#c')).toBe('https://x.com/intent/post?text=a%20b%23c');
    expect(xIntentUrl('a', 'https://e.com/?x=1')).toBe(
      'https://x.com/intent/post?text=a&url=https%3A%2F%2Fe.com%2F%3Fx%3D1',
    );
  });
});

describe('相場の前日比', () => {
  const market: MarketResponse = {
    date: '2026-10-02',
    prices: { gear: 3, coil: 1, dock: 3 } as never,
    previous: { gear: 2, coil: 2, dock: 3 } as never,
  };

  it('値上がり・値下がりしたパーツだけ（ランの価格が今日の相場のとき）', () => {
    const runPrices = { gear: 3, coil: 1, dock: 3 } as never;
    expect(priceTrends(market, runPrices)).toEqual({ gear: 'up', coil: 'down' });
  });

  it('前日の相場がない・ランが別の価格で始まっていれば出さない', () => {
    expect(priceTrends({ ...market, previous: null }, { gear: 3 } as never)).toEqual({});
    expect(priceTrends(market, { gear: 2, coil: 2 } as never)).toEqual({});
  });
});

describe('通常ランの組み立て', () => {
  it('相場の価格で始める（取得できなければ基準価格）', () => {
    const withMarket = startNormalRun(1, createInitialMeta(), { gear: 9 });
    expect(withMarket.config.economy.prices.gear).toBe(9);
    const base = startNormalRun(1, createInitialMeta(), undefined);
    expect(base.config.economy.prices.gear).toBe(BALANCE.parts.gear.price);
  });

  it('製品版（テストの既定）は延長戦あり', () => {
    expect(startNormalRun(1, createInitialMeta(), undefined).config.overtimeAllowed).toBe(true);
  });
});
