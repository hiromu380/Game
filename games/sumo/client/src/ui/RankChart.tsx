import { divisionCounts, type Division, type TrackEntry } from '@ichimon/sim';
import { useI18n } from '../i18n';
import { bashoName, rankLabel, recordLabel } from '../format';

const DIVS: Division[] = ['makuuchi', 'juryo', 'makushita', 'sandanme', 'jonidan', 'jonokuchi'];
const BAND = 34;
const LEFT = 56;

/** 番付の上からの順位 → 縦の位置（段ごとに同じ高さ。段の中は順位の割合） */
export function bandPosition(order: number, total: number): number {
  const counts = divisionCounts(total);
  let start = 0;
  for (let i = 0; i < DIVS.length; i++) {
    const n = counts[DIVS[i]!];
    if (order < start + n || i === DIVS.length - 1)
      return i + Math.min(1, (order - start) / Math.max(1, n));
    start += n;
  }
  return DIVS.length;
}

/** 番付の推移（場所ごと。上ほど高い地位）。点ごとに地位と成績を読み上げる */
export function RankChart({ track }: { track: readonly TrackEntry[] }) {
  const { t } = useI18n();
  if (track.length === 0) return <p className="note">{t('detail.noTrack')}</p>;
  const step = Math.max(6, Math.min(24, 520 / track.length));
  const width = LEFT + step * Math.max(1, track.length - 1) + 16;
  const height = BAND * DIVS.length + 8;
  const points = track.map((e, i) => ({
    x: LEFT + i * step,
    y: 4 + bandPosition(e.order, e.total) * BAND,
    e,
  }));
  return (
    <div className="rank-chart">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        width={width}
        height={height}
        role="img"
        aria-label={t('detail.chartAria')}
      >
        {DIVS.map((d, i) => (
          <g key={d}>
            <rect
              x={LEFT - 4}
              y={4 + i * BAND}
              width={width - LEFT}
              height={BAND}
              fill={i % 2 ? 'var(--paper)' : 'var(--card)'}
            />
            <text x={4} y={4 + i * BAND + BAND / 2 + 4} fontSize={11} fill="var(--ink-2)">
              {t(`rank.division.${d}`)}
            </text>
          </g>
        ))}
        <polyline
          points={points.map((p) => `${p.x},${p.y}`).join(' ')}
          fill="none"
          stroke="var(--ai)"
          strokeWidth={2.5}
          strokeLinejoin="round"
        />
        {points.map((p) => {
          const kk = p.e.wins > p.e.losses + p.e.absences;
          return (
            <circle
              key={p.e.bashoIndex}
              cx={p.x}
              cy={p.y}
              r={p.e.yusho ? 6 : 3.5}
              fill={p.e.yusho ? 'var(--gold-bg)' : kk ? 'var(--ai)' : 'var(--card)'}
              stroke="var(--ink)"
              strokeWidth={1.5}
            >
              <title>
                {`${bashoName(t, p.e.bashoIndex)} ${rankLabel(t, p.e.rank)} ${recordLabel(t, p.e)}${p.e.yusho ? ` ${t('report.yusho')}` : ''}`}
              </title>
            </circle>
          );
        })}
      </svg>
      <p className="note">{t('detail.chartNote')}</p>
    </div>
  );
}
