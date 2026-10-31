/**
 * カードや系譜図に描画する静止3D肖像。画面に入ったときだけ画像化する。
 * WebGL不対応・データ取得前・読み込み失敗時は従来のSVGを残す。
 */
import { useEffect, useRef, useState } from 'react';
import { Figure } from './Figure';
import type { Look } from './look';
import { portraitKey, type PortraitVariant } from './portraitKey';

export function ThreePortrait({
  look,
  variant = 'bust',
  size = 72,
}: {
  look: Look;
  variant?: PortraitVariant;
  size?: number | string;
}) {
  const spanRef = useRef<HTMLSpanElement>(null);
  const lookRef = useRef(look);
  lookRef.current = look;
  const [image, setImage] = useState<{ key: string; url: string } | null>(null);
  // portrait.tsを同期importせず、一覧表示の初期バンドルを小さく保つ。
  const key = portraitKey(look, variant);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    let observer: IntersectionObserver | undefined;
    const start = () => {
      void import('./three/portrait')
        .then(async ({ requestPortrait }) => {
          if (cancelled) return;
          const url = await requestPortrait(lookRef.current, variant, controller.signal);
          if (!cancelled) setImage({ key, url });
        })
        .catch(() => {
          // SVGを表示したままにする。
        });
    };
    const element = spanRef.current;
    if (element && typeof IntersectionObserver !== 'undefined') {
      observer = new IntersectionObserver(
        (entries) => {
          if (!entries.some((entry) => entry.isIntersecting)) return;
          observer?.disconnect();
          start();
        },
        { rootMargin: '160px' },
      );
      observer.observe(element);
    } else {
      start();
    }
    return () => {
      cancelled = true;
      controller.abort();
      observer?.disconnect();
    };
  }, [key, variant]);

  return (
    <span
      ref={spanRef}
      className="portrait-3d"
      style={{
        width: size,
        height: typeof size === 'number' ? size : 'auto',
        aspectRatio: '1 / 1',
      }}
      aria-hidden="true"
    >
      {image?.key === key ? (
        <img src={image.url} alt="" decoding="async" />
      ) : (
        <Figure look={look} variant={variant} size={typeof size === 'number' ? size : 128} />
      )}
    </span>
  );
}
