/**
 * 数字のカウントアップ（画面上部の出荷量）: 新しい値を受け取ったら、前の値から勢いよく増えて最後にピタッと止まる
 *
 * スコアは桁が大きいので bigint のまま補間する（浮動小数点に変換しない）。
 */
import { useEffect, useRef, useState } from 'react';
import { EFFECTS_CONFIG } from '../config/effects';

/** 最初は速く、最後はゆっくり止まる（指数の減速） */
export const easeOutExpo = (t: number): number => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t));

/** from から to へ、進み具合 t（0〜1）のときの値 */
export function countUpValue(from: bigint, to: bigint, t: number): bigint {
  if (t >= 1) return to;
  const step = BigInt(Math.round(easeOutExpo(Math.max(0, t)) * 10000));
  return from + ((to - from) * step) / 10000n;
}

/** target（数字の文字列。null なら表示しない）へカウントアップした値を返す */
export function useCountUp(target: string | null): string | null {
  const [shown, setShown] = useState<string | null>(target);
  const from = useRef<bigint>(0n);
  useEffect(() => {
    if (target === null) {
      from.current = 0n;
      return;
    }
    const start = from.current;
    const end = BigInt(target);
    const duration = EFFECTS_CONFIG.countUpMs;
    const began = performance.now();
    let frame = 0;
    const step = (now: number) => {
      const t = duration <= 0 ? 1 : (now - began) / duration;
      const value = countUpValue(start, end, t);
      from.current = value;
      setShown(value.toString());
      if (t < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [target]);
  return target === null ? null : shown;
}
