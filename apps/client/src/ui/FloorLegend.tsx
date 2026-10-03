/**
 * 床の凡例（盤面の下）: いま盤面にある床の種類・期間限定の枠・夜の予告だけを短く並べる
 */
import type { FloorCell, FloorParams } from '@chain-factory/sim';
import { BOARD_ASSETS } from '../assets/manifest';
import { useI18n } from '../i18n';
import { floorLegendEntries, type FloorLegendEntry } from '../state/floorLegend';

interface Props {
  floor: readonly (FloorCell | null)[];
  upcomingBlocked: readonly number[];
  params: FloorParams;
}

export function FloorLegend({ floor, upcomingBlocked, params }: Props) {
  const { t } = useI18n();
  const entries = floorLegendEntries(floor, upcomingBlocked);
  if (entries.length === 0) return null;
  const amounts = {
    double: params.doubleMultiplier,
    add: params.addAmount,
    triple: params.tripleMultiplier,
  };
  const label = (e: FloorLegendEntry) => {
    switch (e.kind) {
      case 'tile':
        return t(`legend.tile.${e.tile}`, amounts);
      case 'limited':
        return t('legend.limited');
      case 'item':
        return t('legend.item');
      case 'upcoming':
        return t('legend.upcoming');
    }
  };
  return (
    <ul className="floor-legend" aria-label={t('legend.title')}>
      {entries.map((e) => (
        <li key={e.kind === 'tile' ? e.tile : e.kind} className="floor-legend__item">
          {e.kind === 'tile' ? (
            <img
              className="floor-legend__swatch"
              src={e.tile === 'blocked' ? BOARD_ASSETS.blocked : BOARD_ASSETS.floorTiles[e.tile]}
              alt=""
            />
          ) : (
            <span className={`floor-legend__swatch floor-legend__swatch--${e.kind}`} />
          )}
          {label(e)}
        </li>
      ))}
    </ul>
  );
}
