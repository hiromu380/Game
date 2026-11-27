import type { TrackEntry } from '@ichimon/sim';
import { useI18n } from '../i18n';
import { bashoName } from '../format';
import { signedPoints } from '../points';
import { prepTrend, type TrendBar } from '../prepTrend';

const BAR = 14;
const GAP = 6;
const H = 40;
/** 棒の上の数字と、棒の下の成績の印の高さ */
const TOP = 12;
const FOOT = 14;

/** 弟子のカード: 場所ごとの稽古の伸び（棒）と、その場所の成績（棒の下の ○●休） */
export function PrepTrend({ track, now }: { track: readonly TrackEntry[]; now: number | null }) {
  const { t } = useI18n();
  const bars = prepTrend(track, now);
  if (bars.length === 0) return null;
  const top = Math.max(0.1, ...bars.map((b) => b.gain));
  const width = bars.length * (BAR + GAP) - GAP;
  const label = (b: TrendBar) =>
    `${b.bashoIndex === null ? t('trend.now') : bashoName(t, b.bashoIndex)} ${t('trend.gain')} ${signedPoints(b.gain)}${b.outcome ? ` ${t(`payoff.outcome.${b.outcome}`)}` : ''}`;
  return (
    <figure className="trend">
      <figcaption className="trend__title">{t('trend.title')}</figcaption>
      <svg
        viewBox={`0 0 ${width} ${TOP + H + FOOT}`}
        width={width}
        height={TOP + H + FOOT}
        role="img"
        aria-label={bars.map(label).join('、')}
      >
        <line x1={0} x2={width} y1={TOP + H} y2={TOP + H} stroke="var(--ink-2)" strokeWidth={1} />
        {bars.map((b, i) => {
          const x = i * (BAR + GAP);
          const h = b.gain > 0 ? Math.max(2, (b.gain / top) * H) : 0;
          const isNow = b.bashoIndex === null;
          return (
            <g key={b.bashoIndex ?? 'now'}>
              <title>{label(b)}</title>
              {h > 0 ? (
                <rect
                  x={x}
                  y={TOP + H - h}
                  width={BAR}
                  height={h}
                  fill={isNow ? 'var(--paper)' : 'var(--ai)'}
                  stroke={isNow ? 'var(--ai)' : 'none'}
                  strokeWidth={isNow ? 1.5 : 0}
                  strokeDasharray={isNow ? '3 2' : undefined}
                />
              ) : (
                <text
                  x={x + BAR / 2}
                  y={TOP + H - 3}
                  fontSize={10}
                  textAnchor="middle"
                  fill="var(--ink-2)"
                >
                  –
                </text>
              )}
              {i === bars.length - 1 && b.gain > 0 && (
                <text
                  x={x + BAR / 2}
                  y={TOP + H - h - 3}
                  fontSize={9}
                  textAnchor="middle"
                  fill="var(--ink)"
                >
                  {signedPoints(b.gain)}
                </text>
              )}
              <text
                x={x + BAR / 2}
                y={TOP + H + FOOT - 2}
                fontSize={10}
                textAnchor="middle"
                fill={b.outcome === 'kachi' ? 'var(--shu)' : 'var(--ink-2)'}
              >
                {isNow
                  ? t('trend.nowShort')
                  : b.outcome === 'kachi'
                    ? '○'
                    : b.outcome === 'make'
                      ? '●'
                      : t('trend.markKyujo')}
              </text>
            </g>
          );
        })}
      </svg>
      <p className="trend__legend">
        <span>{t('trend.legendBar')}</span>
        <span>{t('trend.legendMark')}</span>
      </p>
    </figure>
  );
}
