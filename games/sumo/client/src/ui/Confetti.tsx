import { PALETTE } from '../art/palette';

/** 紙吹雪の数（上限。使い回さず、1回だけ落ちる） */
const PIECES = 18;
const COLORS = [PALETTE.beni, PALETTE.odo, PALETTE.odoLight, PALETTE.wakatake, PALETTE.sakura];

/** 0〜1 の決まった値（乱数を使わない。毎回同じ散り方） */
const hash = (i: number, k: number) =>
  (((Math.sin(i * 12.9898 + k * 78.233) * 43758.5453) % 1) + 1) % 1;

/**
 * 大きな見せ場の紙吹雪（桜井氏の「褒める演出」）。見せ場の絵の枠の中だけに落とす（画面全体を光らせない）。
 * 飾りなので読み上げない。動きを減らす設定では出さない（CSS）
 */
export function Confetti() {
  return (
    <div className="confetti" aria-hidden="true">
      {Array.from({ length: PIECES }, (_, i) => (
        <span
          key={i}
          className="confetti__piece"
          style={{
            left: `${Math.round(hash(i, 1) * 96)}%`,
            background: COLORS[i % COLORS.length],
            animationDelay: `${(hash(i, 2) * 0.6).toFixed(2)}s`,
            animationDuration: `${(1.4 + hash(i, 3) * 0.8).toFixed(2)}s`,
          }}
        />
      ))}
    </div>
  );
}
