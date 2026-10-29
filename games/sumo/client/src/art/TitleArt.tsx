/**
 * はじめの画面の絵: 部屋ののれん・親方・弟子2人（四股を踏む）
 */
import { FigureGroup } from './Figure';
import { oyakataLook, rikishiLook } from './look';
import { PALETTE } from './palette';

const INK = PALETTE.sumi;

export function TitleArt({ title }: { title: string }) {
  const left = rikishiLook({
    id: 11,
    weight: 150,
    stableId: 3,
    careerBasho: 40,
    sekitori: true,
    yokozuna: false,
    injured: false,
    fatigue: 0,
  });
  const right = rikishiLook({
    id: 23,
    weight: 110,
    stableId: 3,
    careerBasho: 2,
    sekitori: false,
    yokozuna: false,
    injured: false,
    fatigue: 0,
  });
  const master = oyakataLook({ id: 5, age: 48, stableId: 1 });
  return (
    <svg className="title-art" viewBox="0 0 360 230" role="img" aria-label={title}>
      {/* 板の間と壁 */}
      <rect width={360} height={230} fill={PALETTE.washi2} />
      <rect y={170} width={360} height={60} fill={PALETTE.odoLight} />
      {Array.from({ length: 9 }, (_, i) => (
        <line
          key={i}
          x1={i * 45}
          y1={170}
          x2={i * 45 - 20}
          y2={230}
          stroke={PALETTE.odo}
          strokeWidth={1.2}
        />
      ))}
      {/* のれん（3枚。真ん中に丸に一の紋） */}
      <line x1={40} y1={10} x2={320} y2={10} stroke={INK} strokeWidth={4} />
      {[0, 1, 2].map((i) => (
        <rect
          key={i}
          x={44 + i * 92}
          y={12}
          width={88}
          height={64}
          fill={PALETTE.ai}
          stroke={INK}
          strokeWidth={2}
        />
      ))}
      <circle cx={180} cy={44} r={20} fill="none" stroke={PALETTE.white} strokeWidth={4} />
      <line x1={166} y1={44} x2={194} y2={44} stroke={PALETTE.white} strokeWidth={5} />
      {/* 弟子（左: 四股、右: すり足）と親方 */}
      <g transform="translate(26 70) scale(0.8)">
        <g transform="rotate(-8 60 140)">
          <FigureGroup look={left} arms="up" />
        </g>
      </g>
      <g transform="translate(138 74) scale(0.72)">
        <FigureGroup look={master} />
      </g>
      <g transform="translate(240 88) scale(0.68)">
        <FigureGroup look={right} arms="push" />
      </g>
    </svg>
  );
}
