import { useEffect, useState } from 'react';

/** 数を 0 から素早く数え上げて見せる（動きを減らす設定では、はじめから最後の数） */
export function useCountUp(value: number, ms = 600): number {
  const reduced =
    typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const [now, setNow] = useState(reduced ? value : 0);
  useEffect(() => {
    if (reduced) {
      setNow(value);
      return;
    }
    // 昔のゲームの数字のように、決まった回数で刻む（滑らかにしない）
    const steps = 12;
    let i = 0;
    const timer = setInterval(() => {
      i += 1;
      setNow(i >= steps ? value : Math.round((value * i) / steps));
      if (i >= steps) clearInterval(timer);
    }, ms / steps);
    return () => clearInterval(timer);
  }, [value, ms, reduced]);
  return now;
}
