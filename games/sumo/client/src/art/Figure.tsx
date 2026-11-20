/**
 * 力士・親方の絵（二頭身・墨の均一な線と平たい色面。docs/art-style.md）
 *
 * viewBox は 0 0 120 150 で固定（頭の中心 60,46・体の中心 60,108）。
 * FigureGroup は <g> を返すので、土俵の絵などに組み込める。Figure は単体の <svg>。
 */
import { useId } from 'react';
import type { Look } from './look';
import { PALETTE } from './palette';

const INK = PALETTE.sumi;
const SW = 2.5;

export type Arms = 'side' | 'push' | 'up';

export function FigureGroup({ look, arms = 'side' }: { look: Look; arms?: Arms }) {
  const clip = useId();
  const w = look.width;
  return (
    <g strokeLinejoin="round" strokeLinecap="round">
      {look.kimono ? <Kimono look={look} /> : <Body look={look} w={w} clip={clip} arms={arms} />}
      <Head look={look} />
    </g>
  );
}

export function Figure({
  look,
  variant = 'full',
  size = 96,
  title,
  arms,
}: {
  look: Look;
  variant?: 'full' | 'bust';
  size?: number;
  title?: string;
  arms?: Arms;
}) {
  const viewBox = variant === 'bust' ? '12 -4 96 96' : '0 -6 120 156';
  return (
    <svg
      className="figure"
      viewBox={viewBox}
      width={size}
      height={variant === 'bust' ? size : size * 1.3}
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      <FigureGroup look={look} arms={arms ?? 'side'} />
    </svg>
  );
}

function Body({ look, w, clip, arms }: { look: Look; w: number; clip: string; arms: Arms }) {
  const cx = 60;
  const cy = 108;
  const armX = w - 3;
  const armRot = arms === 'push' ? 70 : arms === 'up' ? 150 : 22;
  const armY = arms === 'push' ? 96 : 100;
  return (
    <g>
      {/* 足 */}
      <rect
        x={cx - w * 0.55 - 7}
        y={128}
        width={16}
        height={16}
        rx={7}
        fill={look.skin}
        stroke={INK}
        strokeWidth={SW}
      />
      <rect
        x={cx + w * 0.55 - 9}
        y={128}
        width={16}
        height={16}
        rx={7}
        fill={look.skin}
        stroke={INK}
        strokeWidth={SW}
      />
      {/* 腕（体の後ろ側） */}
      <ellipse
        cx={cx - armX}
        cy={armY}
        rx={9}
        ry={15}
        transform={`rotate(${armRot} ${cx - armX} ${armY})`}
        fill={look.skin}
        stroke={INK}
        strokeWidth={SW}
      />
      <ellipse
        cx={cx + armX}
        cy={armY}
        rx={9}
        ry={15}
        transform={`rotate(${-armRot} ${cx + armX} ${armY})`}
        fill={look.skin}
        stroke={INK}
        strokeWidth={SW}
      />
      {/* 胴 */}
      <clipPath id={clip}>
        <ellipse cx={cx} cy={cy} rx={w} ry={34} />
      </clipPath>
      <ellipse cx={cx} cy={cy} rx={w} ry={34} fill={look.skin} />
      {/* 胸とおへそ */}
      <path
        d={`M${cx - w * 0.6} 92 q ${w * 0.3} 7 ${w * 0.5} 0`}
        fill="none"
        stroke={INK}
        strokeWidth={1.6}
      />
      <path
        d={`M${cx + w * 0.1} 92 q ${w * 0.2} 7 ${w * 0.5} 0`}
        fill="none"
        stroke={INK}
        strokeWidth={1.6}
      />
      <circle cx={cx} cy={108} r={1.6} fill={INK} />
      {/* まわし（胴の形で切り抜く） */}
      <g clipPath={`url(#${clip})`}>
        <rect x={0} y={115} width={120} height={14} fill={look.cloth} />
        <line x1={0} y1={115} x2={120} y2={115} stroke={INK} strokeWidth={1.6} />
        {look.tsuna && (
          <g>
            <rect x={0} y={106} width={120} height={9} fill={PALETTE.white} />
            {Array.from({ length: 12 }, (_, i) => (
              <line
                key={i}
                x1={i * 10}
                y1={106}
                x2={i * 10 + 7}
                y2={115}
                stroke={INK}
                strokeWidth={1}
              />
            ))}
            <line x1={0} y1={106} x2={120} y2={106} stroke={INK} strokeWidth={1.6} />
          </g>
        )}
      </g>
      <ellipse cx={cx} cy={cy} rx={w} ry={34} fill="none" stroke={INK} strokeWidth={SW} />
      {/* 前袋と下がり */}
      <path
        d={`M${cx - 7} 128 L${cx + 7} 128 L${cx + 4} 137 L${cx - 4} 137 Z`}
        fill={look.cloth}
        stroke={INK}
        strokeWidth={1.8}
      />
      {look.sagari &&
        [-9, -5, -1, 3, 7].map((dx) => (
          <line
            key={dx}
            x1={cx + dx + 1}
            y1={129}
            x2={cx + dx * 1.3 + 1}
            y2={142}
            stroke={look.cloth}
            strokeWidth={2.4}
          />
        ))}
      {/* 横綱の綱の紙垂 */}
      {look.tsuna &&
        [-14, 0, 14].map((dx) => (
          <path
            key={dx}
            d={`M${cx + dx - 3} 115 l6 0 l-3 5 l3 0 l-3 5 l3 0 l-6 6 l2 -6 l-3 0 l3 -5 l-3 0 Z`}
            fill={PALETTE.white}
            stroke={INK}
            strokeWidth={1}
          />
        ))}
      {/* けが: 腕に包帯 */}
      {look.bandage && (
        <rect
          x={cx - armX - 9}
          y={armY - 3}
          width={18}
          height={7}
          transform={`rotate(${armRot} ${cx - armX} ${armY})`}
          fill={PALETTE.white}
          stroke={INK}
          strokeWidth={1.2}
        />
      )}
    </g>
  );
}

function Kimono({ look }: { look: Look }) {
  const cx = 60;
  return (
    <g>
      {/* 袖 */}
      <path
        d="M24 86 Q16 112 26 128 L40 124 L40 88 Z"
        fill={look.cloth}
        stroke={INK}
        strokeWidth={SW}
      />
      <path
        d="M96 86 Q104 112 94 128 L80 124 L80 88 Z"
        fill={look.cloth}
        stroke={INK}
        strokeWidth={SW}
      />
      {/* 羽織 */}
      <path
        d={`M${cx - 26} 78 Q${cx} 70 ${cx + 26} 78 L${cx + 34} 146 L${cx - 34} 146 Z`}
        fill={look.cloth}
        stroke={INK}
        strokeWidth={SW}
      />
      {/* 襟（白）と内の着物 */}
      <path
        d={`M${cx - 9} 74 L${cx} 96 L${cx + 9} 74`}
        fill="none"
        stroke={PALETTE.white}
        strokeWidth={5}
      />
      <path
        d={`M${cx - 9} 74 L${cx} 96 L${cx + 9} 74`}
        fill="none"
        stroke={INK}
        strokeWidth={1.2}
      />
      <rect
        x={cx - 26}
        y={112}
        width={52}
        height={7}
        fill={PALETTE.odo}
        stroke={INK}
        strokeWidth={1.4}
      />
      {/* 家紋（白い丸に三つの点） */}
      {[
        [cx - 18, 90],
        [cx + 18, 90],
      ].map(([x, y]) => (
        <g key={x}>
          <circle cx={x} cy={y} r={4.5} fill={PALETTE.white} stroke={INK} strokeWidth={1} />
          <circle cx={x! - 1.5} cy={y! - 1} r={1} fill={INK} />
          <circle cx={x! + 1.5} cy={y! - 1} r={1} fill={INK} />
          <circle cx={x} cy={y! + 1.6} r={1} fill={INK} />
        </g>
      ))}
    </g>
  );
}

function Head({ look }: { look: Look }) {
  const cx = 60;
  const cy = 46;
  return (
    <g>
      {/* 髷（頭の後ろに出る分を先に描く） */}
      {look.hair === 'chonmage' && (
        <g transform={`rotate(-12 ${cx} 16)`}>
          <rect x={cx - 5} y={6} width={10} height={17} rx={4.5} fill={INK} />
          <line x1={cx - 5} y1={18} x2={cx + 5} y2={18} stroke={PALETTE.white} strokeWidth={2} />
        </g>
      )}
      {look.hair === 'oicho' && (
        <g>
          <path
            d={`M${cx} 21 C${cx - 12} 18 ${cx - 20} 8 ${cx - 18} 0 C${cx - 9} 5 ${cx + 9} 5 ${cx + 18} 0 C${cx + 20} 8 ${cx + 12} 18 ${cx} 21 Z`}
            fill={INK}
          />
          <line x1={cx - 5} y1={19} x2={cx + 5} y2={19} stroke={PALETTE.white} strokeWidth={2} />
        </g>
      )}
      {/* 顔 */}
      <circle cx={cx} cy={cy} r={26} fill={look.skin} stroke={INK} strokeWidth={SW} />
      {/* 髪 */}
      {look.hair === 'zanbara' ? (
        <path
          d={`M${cx - 26} ${cy - 2} L${cx - 27} ${cy - 16} L${cx - 20} ${cy - 22} L${cx - 18} ${cy - 30} L${cx - 9} ${cy - 27} L${cx - 4} ${cy - 34} L${cx + 3} ${cy - 27} L${cx + 11} ${cy - 32} L${cx + 15} ${cy - 24} L${cx + 23} ${cy - 25} L${cx + 23} ${cy - 15} L${cx + 27} ${cy - 2} L${cx + 19} ${cy - 13} L${cx + 12} ${cy - 10} L${cx + 4} ${cy - 15} L${cx - 4} ${cy - 10} L${cx - 12} ${cy - 15} L${cx - 19} ${cy - 10} Z`}
          fill={INK}
          stroke={INK}
          strokeWidth={1.5}
        />
      ) : (
        <path
          d={`M${cx - 26} ${cy - 1} Q${cx - 28} ${cy - 29} ${cx} ${cy - 27} Q${cx + 28} ${cy - 29} ${cx + 26} ${cy - 1} Q${cx + 20} ${cy - 15} ${cx} ${cy - 16} Q${cx - 20} ${cy - 15} ${cx - 26} ${cy - 1} Z`}
          fill={look.hair === 'gray' ? '#8f887e' : INK}
          stroke={INK}
          strokeWidth={1.5}
        />
      )}
      {/* 眉 */}
      <Brows kind={look.brows} cx={cx} />
      {/* 目 */}
      <Eyes kind={look.eyes} cx={cx} />
      {/* 鼻・口・ほっぺ */}
      <path d={`M${cx - 1} 51 q 4 3 0 6`} fill="none" stroke={INK} strokeWidth={1.4} />
      <Mouth kind={look.mouth} cx={cx} />
      <ellipse cx={cx - 16} cy={56} rx={5} ry={3} fill={PALETTE.cheek} opacity={0.6} />
      <ellipse cx={cx + 16} cy={56} rx={5} ry={3} fill={PALETTE.cheek} opacity={0.6} />
      {look.bandage && (
        <g transform={`rotate(-20 ${cx + 15} 60)`}>
          <rect
            x={cx + 9}
            y={57}
            width={12}
            height={6}
            rx={1.5}
            fill={PALETTE.white}
            stroke={INK}
            strokeWidth={1}
          />
          <line x1={cx + 15} y1={57} x2={cx + 15} y2={63} stroke={INK} strokeWidth={0.8} />
        </g>
      )}
      {look.sweat &&
        [
          [cx + 30, 30],
          [cx + 34, 42],
        ].map(([x, y]) => (
          <path
            key={y}
            d={`M${x} ${y! - 5} q 4 6 0 8 q -4 -2 0 -8 Z`}
            fill="#a9cbe6"
            stroke={INK}
            strokeWidth={1}
          />
        ))}
    </g>
  );
}

function Brows({ kind, cx }: { kind: Look['brows']; cx: number }) {
  const y = 39;
  const d =
    kind === 'thick'
      ? [`M${cx - 18} ${y} l10 -1`, `M${cx + 8} ${y - 1} l10 1`]
      : kind === 'arched'
        ? [`M${cx - 18} ${y + 1} q5 -5 10 0`, `M${cx + 8} ${y + 1} q5 -5 10 0`]
        : [`M${cx - 18} ${y - 2} l10 4`, `M${cx + 8} ${y + 2} l10 -4`];
  return (
    <g fill="none" stroke={INK} strokeWidth={kind === 'thick' ? 4 : 3}>
      {d.map((p) => (
        <path key={p} d={p} />
      ))}
    </g>
  );
}

function Eyes({ kind, cx }: { kind: Look['eyes']; cx: number }) {
  const y = 47;
  const xs = [cx - 12, cx + 12];
  return (
    <g fill={INK} stroke={INK} strokeWidth={2.2}>
      {xs.map((x) =>
        kind === 'dot' ? (
          <circle key={x} cx={x} cy={y} r={2.4} stroke="none" />
        ) : kind === 'line' ? (
          <line key={x} x1={x - 4} y1={y} x2={x + 4} y2={y} />
        ) : kind === 'smile' ? (
          <path key={x} d={`M${x - 4} ${y + 1} q4 -5 8 0`} fill="none" />
        ) : (
          <path
            key={x}
            d={x < cx ? `M${x - 4} ${y - 2} l8 3` : `M${x - 4} ${y + 1} l8 -3`}
            fill="none"
          />
        ),
      )}
    </g>
  );
}

function Mouth({ kind, cx }: { kind: Look['mouth']; cx: number }) {
  const y = 62;
  return (
    <g fill="none" stroke={INK} strokeWidth={2}>
      {kind === 'he' && <path d={`M${cx - 5} ${y + 1} l4 -3 l6 4`} />}
      {kind === 'o' && (
        <ellipse cx={cx} cy={y} rx={2.5} ry={2} fill={PALETTE.beni} strokeWidth={1.4} />
      )}
      {kind === 'smile' && <path d={`M${cx - 5} ${y - 1} q5 5 10 0`} />}
      {kind === 'flat' && <line x1={cx - 4} y1={y} x2={cx + 4} y2={y} />}
    </g>
  );
}
