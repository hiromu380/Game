import { PALETTE } from './palette';

/** 三つの輪がつながる、一門の架空の紋。実在の協会・部屋の紋は用いない。 */
export function Mon({
  x = 0,
  y = 0,
  size = 40,
  color = PALETTE.washi,
}: {
  x?: number;
  y?: number;
  size?: number;
  color?: string;
}) {
  return (
    <g
      transform={`translate(${x} ${y}) scale(${size / 40})`}
      fill="none"
      stroke={color}
      strokeWidth={1.7}
    >
      <circle cx={20} cy={20} r={18} />
      {[0, 120, 240].map((angle) => (
        <path
          key={angle}
          d="M20 20 C4 18 12 1 20 8 C28 1 36 18 20 20Z"
          transform={`rotate(${angle} 20 20)`}
        />
      ))}
      <circle cx={20} cy={20} r={3} fill={color} stroke="none" />
    </g>
  );
}
