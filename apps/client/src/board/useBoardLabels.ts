/**
 * 盤面に出す文言（i18n を通す。言語が変わったら作り直す）。ゲーム画面とタイトルの見本で共通
 */
import type { FloorParams } from '@chain-factory/sim';
import { useMemo } from 'react';
import { useI18n } from '../i18n';
import type { BoardLabels } from './BoardRenderer';

/** 床の効果量（文言に埋め込む） */
const floorAmounts = (params: FloorParams) => ({
  double: params.doubleMultiplier,
  add: params.addAmount,
  triple: params.tripleMultiplier,
});

export function useBoardLabels(): BoardLabels {
  const { t, formatCompact, formatMeasured } = useI18n();
  return useMemo<BoardLabels>(
    () => ({
      getPartName: (partId) => t(`part.${partId}.name`),
      formatIncome: (amount) => t('playback.incomePop', { amount }),
      getBreakLabel: (reason) => t(`break.short.${reason}`),
      formatChain: (count) => t('playback.chainCounter', { count }),
      getCutInTitle: () => t('playback.cutIn'),
      getQuotaCrossLabel: () => t('playback.quotaCross'),
      getUnmeasurableLabel: () => ({
        title: t('unmeasurable.label'),
        sub: t('unmeasurable.overload'),
      }),
      getFloorShort: (tile, params) => t(`floor.${tile}.short`, floorAmounts(params)),
      getFloorDescription: (cell, params) =>
        t('floor.tooltip', {
          name: t(`floor.${cell.tile}.name`, floorAmounts(params)),
          desc: t(`floor.${cell.tile}.desc`, floorAmounts(params)),
          period:
            cell.source === 'bonus' || cell.source === 'event' || cell.source === 'item'
              ? t(`floor.period.${cell.source}`)
              : '',
        }),
      // 盤面の合計（ドン・カットイン）は、計測不能の桁数以上なら「計測不能」
      formatScore: formatMeasured,
      formatCompact,
    }),
    [t, formatMeasured, formatCompact],
  );
}
