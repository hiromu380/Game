/**
 * 出荷の箱: 出荷のたびに、出荷口から画面上部の出荷量へ小さな箱が飛んでいく
 *
 * 盤面（canvas）の外まで飛ぶので、画面側（DOM）で描く。数が多いので React の状態にはせず、
 * 要素を直接作って動かし、着いたら消す。同時に出す数には上限がある（config/effects.ts の shipFlight）。
 * 演出の強さ「弱」と、OS の「動きを減らす」設定では出さない。
 */
import { useEffect, useRef } from 'react';
import { EFFECTS_CONFIG } from '../config/effects';
import { useSettings } from '../settings/SettingsContext';
import { subscribeShipFlights } from '../state/playbackMoments';

export function ShipFlights() {
  const layerRef = useRef<HTMLDivElement>(null);
  const { settings } = useSettings();
  const strength = settings.effects;

  useEffect(() => {
    const c = EFFECTS_CONFIG.shipFlight;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (strength === 'minimal' || reduceMotion) return;
    const maxAlive = Math.max(1, Math.round(c.maxAlive * EFFECTS_CONFIG.strength[strength]));
    let alive = 0;

    return subscribeShipFlights(({ clientX, clientY }) => {
      const layer = layerRef.current;
      const target = document.querySelector('.hud__value--score');
      if (!layer || !target || alive >= maxAlive) return;
      const rect = target.getBoundingClientRect();
      if (rect.width === 0) return;
      const dx = rect.left + rect.width / 2 - clientX;
      const dy = rect.top + rect.height / 2 - clientY;

      const box = document.createElement('span');
      box.className = 'ship-flight';
      box.style.left = `${clientX}px`;
      box.style.top = `${clientY}px`;
      layer.appendChild(box);
      alive++;
      // 少し持ち上がってから、出荷量へ吸い込まれる
      const animation = box.animate(
        [
          { transform: 'translate(-50%, -50%) scale(0.4) rotate(0deg)', opacity: 0 },
          {
            transform: `translate(-50%, calc(-50% - ${c.liftPx}px)) scale(1) rotate(-12deg)`,
            opacity: 1,
            offset: 0.25,
          },
          {
            transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(0.5) rotate(18deg)`,
            opacity: 1,
          },
        ],
        { duration: c.durationMs, easing: 'cubic-bezier(0.5, 0, 0.3, 1)' },
      );
      animation.onfinish = animation.oncancel = () => {
        box.remove();
        alive--;
        // 着いた瞬間に、出荷量の数字を小さく弾ませる
        target.animate([{ transform: 'scale(1.18)' }, { transform: 'scale(1)' }], {
          duration: c.bumpMs,
          easing: 'ease-out',
        });
      };
    });
  }, [strength]);

  return <div ref={layerRef} className="ship-flights" aria-hidden="true" />;
}
