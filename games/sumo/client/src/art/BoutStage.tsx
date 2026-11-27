/**
 * 取組の舞台（向正面から見た土俵）: 吊り屋根と房・俵・行司・2人の力士
 *
 * 台本（playback/boutScript.ts）の座標: x は土俵の中心が 0・俵が ±1（東が右）、y は奥行き。
 */
import type { Arms } from './Figure';
import { FigureGroup } from './Figure';
import type { Look } from './look';
import { PALETTE } from './palette';
import type { Pose } from '../playback/boutScript';

const INK = PALETTE.sumi;
const W = 360;
const H = 250;
const CX = 180;
const RING = 92; // 俵までの距離（px）
const BASE = 182; // 土俵の上面

const toX = (x: number) => CX + x * RING;

function Wrestler({ look, pose, arms }: { look: Look; pose: Pose; arms: Arms }) {
  const s = 0.62;
  const x = toX(pose.x);
  const y = BASE + pose.y * 10;
  return (
    <g transform={`rotate(${pose.rot} ${x} ${y})`}>
      <g transform={`translate(${x - 60 * s} ${y - 144 * s}) scale(${s})`}>
        <FigureGroup look={look} arms={arms} />
      </g>
    </g>
  );
}

/** 行司（烏帽子・装束・軍配）。winner があれば軍配をそちらへ向ける */
function Gyoji({ winner }: { winner: 'E' | 'W' | null }) {
  // 土俵の奥・東寄りに立つ（2人の取組の邪魔にならないように小さく）
  const x = CX + RING * 0.72;
  const y = BASE - 4;
  const fan = winner === 'E' ? 1 : winner === 'W' ? -1 : 0;
  return (
    <g transform={`translate(${x} ${y}) scale(0.36)`} strokeLinejoin="round">
      <path
        d="M-30 -40 Q0 -50 30 -40 L40 30 L-40 30 Z"
        fill={PALETTE.murasaki}
        stroke={INK}
        strokeWidth={4}
      />
      <path d="M-10 -44 L0 -20 L10 -44" fill="none" stroke={PALETTE.white} strokeWidth={6} />
      <circle cx={0} cy={-68} r={24} fill={PALETTE.skin[0]} stroke={INK} strokeWidth={4} />
      <path d="M-14 -88 L-10 -116 L12 -116 L16 -88 Z" fill={INK} />
      <circle cx={-8} cy={-68} r={2.5} fill={INK} />
      <circle cx={8} cy={-68} r={2.5} fill={INK} />
      <g transform={`rotate(${fan * 55})`}>
        <line x1={0} y1={-20} x2={0} y2={-60} stroke={INK} strokeWidth={5} />
        <ellipse cx={0} cy={-76} rx={16} ry={20} fill={PALETTE.odo} stroke={INK} strokeWidth={4} />
      </g>
    </g>
  );
}

export function BoutStage({
  east,
  west,
  pose,
  arms,
  winner,
  title,
}: {
  east: Look;
  west: Look;
  pose: { east: Pose; west: Pose };
  arms: Arms;
  winner: 'E' | 'W' | null;
  title: string;
}) {
  return (
    <svg className="dohyo" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={title}>
      <defs>
        <pattern id="bout-seigaiha" width={40} height={20} patternUnits="userSpaceOnUse">
          {[
            [0, 20],
            [40, 20],
            [20, 10],
            [0, 0],
            [40, 0],
          ].map(([x, y]) =>
            [18, 13, 8].map((r) => (
              <path
                key={`${x}-${y}-${r}`}
                d={`M${x! - r} ${y} A${r} ${r} 0 0 1 ${x! + r} ${y}`}
                fill="none"
                stroke={PALETTE.washi}
                strokeOpacity={0.18}
                strokeWidth={1.6}
              />
            )),
          )}
        </pattern>
      </defs>
      <rect width={W} height={H} fill={PALETTE.ai} />
      <rect width={W} height={H} fill="url(#bout-seigaiha)" />
      {/* 吊り屋根と水引幕 */}
      <path d={`M40 34 Q${CX} 4 ${W - 40} 34 L${W - 56} 46 L56 46 Z`} fill={INK} />
      <rect
        x={56}
        y={46}
        width={W - 112}
        height={12}
        fill={PALETTE.murasaki}
        stroke={INK}
        strokeWidth={1.5}
      />
      {[0, 1, 2, 3].map((i) => (
        <path
          key={i}
          d={`M${86 + i * 62} 58 q 15 10 30 0`}
          fill="none"
          stroke={PALETTE.odoLight}
          strokeWidth={1.5}
        />
      ))}
      {/* 房（向正面から見て左が白房・右が赤房） */}
      {[
        [62, PALETTE.white],
        [W - 62, PALETTE.beni],
      ].map(([x, color]) => (
        <g key={x}>
          <line x1={x as number} y1={58} x2={x as number} y2={86} stroke={INK} strokeWidth={2} />
          <path
            d={`M${(x as number) - 7} 86 L${(x as number) + 7} 86 L${(x as number) + 5} 112 L${(x as number) - 5} 112 Z`}
            fill={color as string}
            stroke={INK}
            strokeWidth={1.5}
          />
        </g>
      ))}
      {/* 土俵（台） */}
      <path
        d={`M24 ${H} L${W - 24} ${H} L${W - 52} ${BASE} L52 ${BASE} Z`}
        fill={PALETTE.odo}
        stroke={INK}
        strokeWidth={2.5}
      />
      <path d={`M52 ${BASE} L${W - 52} ${BASE}`} stroke={INK} strokeWidth={2.5} />
      {/* 俵（土俵の縁） */}
      {Array.from({ length: 9 }, (_, i) => {
        const x = toX(-1) + (i * (2 * RING)) / 8;
        return (
          <rect
            key={i}
            x={x - 9}
            y={BASE - 5}
            width={18}
            height={7}
            rx={3.5}
            fill={PALETTE.odoLight}
            stroke={INK}
            strokeWidth={1.2}
          />
        );
      })}
      {/* 仕切り線 */}
      <line
        x1={CX - 14}
        y1={BASE + 2}
        x2={CX - 14}
        y2={BASE + 6}
        stroke={PALETTE.white}
        strokeWidth={3}
      />
      <line
        x1={CX + 14}
        y1={BASE + 2}
        x2={CX + 14}
        y2={BASE + 6}
        stroke={PALETTE.white}
        strokeWidth={3}
      />
      <Gyoji winner={winner} />
      <Wrestler look={west} pose={pose.west} arms={arms} />
      <Wrestler look={east} pose={pose.east} arms={arms} />
    </svg>
  );
}
