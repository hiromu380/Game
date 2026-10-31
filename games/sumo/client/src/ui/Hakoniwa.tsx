import { useEffect, useMemo, useRef, useState } from 'react';
import { useI18n, type MessageKey } from '../i18n';
import { sprite } from '../art/sprites';
import { PALETTE } from '../art/palette';
import type { SceneAction } from '../art/hakoniwa/grid';
import { NOBORI_TAG } from '../art/sprites/keikoba';

/** 描く物: (x, y) は絵の足元（tip: 絵のいちばん下の点 / box: 絵の枠の下の中央）。舞台のドット */
export interface Drawn {
  sprite: string;
  x: number;
  y: number;
  anchor: 'tip' | 'box';
  action?: SceneAction;
  label?: string;
}

/** 舞台の見える範囲（ドット） */
export interface View {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

interface Loaded {
  img: HTMLImageElement;
  w: number;
  h: number;
  /** 絵のいちばん下の不透明な点 */
  tip: [number, number];
  alpha: Uint8ClampedArray;
}

const cache = new Map<string, Promise<Loaded | null>>();

/** 絵を読み、足元の点と当たり判定用の不透明さを調べる（1枚ごとに1回） */
function load(name: string): Promise<Loaded | null> {
  const hit = cache.get(name);
  if (hit) return hit;
  const s = sprite(name);
  const p = !s
    ? Promise.resolve(null)
    : new Promise<Loaded | null>((resolve) => {
        const img = new Image();
        img.onload = () => {
          const c = document.createElement('canvas');
          c.width = img.naturalWidth;
          c.height = img.naturalHeight;
          const ctx = c.getContext('2d');
          if (!ctx) return resolve(null);
          ctx.drawImage(img, 0, 0);
          const data = ctx.getImageData(0, 0, c.width, c.height).data;
          const alpha = new Uint8ClampedArray(c.width * c.height);
          let tipY = 0;
          const xs: number[] = [];
          for (let y = 0; y < c.height; y++)
            for (let x = 0; x < c.width; x++) {
              const a = data[(y * c.width + x) * 4 + 3]!;
              alpha[y * c.width + x] = a;
              if (a > 0 && y > tipY) {
                tipY = y;
                xs.length = 0;
              }
              if (a > 0 && y === tipY) xs.push(x);
            }
          const tipX = xs.length
            ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length)
            : c.width / 2;
          resolve({ img, w: c.width, h: c.height, tip: [tipX, tipY], alpha });
        };
        img.onerror = () => resolve(null);
        img.src = s.url;
      });
  cache.set(name, p);
  return p;
}

interface Placed {
  d: Drawn;
  s: Loaded;
  left: number;
  top: number;
}

function place(d: Drawn, s: Loaded): Placed {
  const [ax, ay] = d.anchor === 'tip' ? s.tip : [Math.floor(s.w / 2), s.h - 1];
  return { d, s, left: Math.round(d.x - ax), top: Math.round(d.y - ay) };
}

/**
 * 箱庭を1枚のキャンバスに描く（地面 → 奥の物から順に）。1枚の画として拡大するので、ドットの大きさがそろう。
 * 押せる物（action のある物）は、押すとその画面へ。その下に、押せる所の一覧も出す
 */
export function Hakoniwa({
  items,
  base,
  drawBase,
  view,
  label,
  onAction,
  maxWidth = 960,
}: {
  items: Drawn[];
  /** これがまだ取り込まれていなければ、何も出さない */
  base: string;
  drawBase?: (ctx: CanvasRenderingContext2D) => void;
  /** 見える範囲。y0 を省くと、いちばん高い絵の上まで */
  view: Omit<View, 'y0'> & { y0?: number };
  label: string;
  onAction?: (a: SceneAction) => void;
  maxWidth?: number;
}) {
  const { t } = useI18n();
  const canvas = useRef<HTMLCanvasElement>(null);
  const [placed, setPlaced] = useState<Placed[] | null>(null);
  const [hover, setHover] = useState<Placed | null>(null);
  const key = JSON.stringify(items);
  useEffect(() => {
    let live = true;
    Promise.all(items.map((d) => load(d.sprite))).then((ss) => {
      if (!live) return;
      setPlaced(items.flatMap((d, i) => (ss[i] ? [place(d, ss[i]!)] : [])));
    });
    return () => {
      live = false;
    };
    // items は key（中身）で比べる
  }, [key]);
  const box = useMemo<View | null>(() => {
    if (!placed) return null;
    const y0 = view.y0 ?? Math.min(...placed.map((p) => p.top)) - 4;
    return {
      x0: Math.floor(view.x0),
      y0: Math.floor(y0),
      x1: Math.ceil(view.x1),
      y1: Math.ceil(view.y1),
    };
  }, [placed, view.x0, view.x1, view.y0, view.y1]);

  useEffect(() => {
    const c = canvas.current;
    if (!c || !placed || !box) return;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.translate(-box.x0, -box.y0);
    drawBase?.(ctx);
    for (const p of placed) ctx.drawImage(p.s.img, p.left, p.top);
  }, [placed, box, drawBase]);

  if (!sprite(base) || !box) return null;
  const W = box.x1 - box.x0;
  const H = box.y1 - box.y0;

  /** 画面の座標 → 押した物（手前から探し、絵の不透明な所だけ当たる） */
  const at = (e: { clientX: number; clientY: number }): Placed | null => {
    const c = canvas.current;
    if (!c || !placed) return null;
    const r = c.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * W + box.x0;
    const y = ((e.clientY - r.top) / r.height) * H + box.y0;
    for (let i = placed.length - 1; i >= 0; i--) {
      const p = placed[i]!;
      const lx = Math.floor(x - p.left);
      const ly = Math.floor(y - p.top);
      if (lx < 0 || ly < 0 || lx >= p.s.w || ly >= p.s.h) continue;
      if (p.s.alpha[ly * p.s.w + lx]! > 0) return p.d.action ? p : null;
    }
    return null;
  };
  const actions = [
    ...new Map(placed!.filter((p) => p.d.action).map((p) => [p.d.action!, p])).values(),
  ];
  const name = (p: Placed) =>
    t(`scene.piece.${p.d.sprite.replace(/_\d$|__\w+$/, '')}` as MessageKey);

  return (
    <div className="hakoniwa">
      <div
        className="hakoniwa__stage"
        style={{ aspectRatio: `${W} / ${H}`, maxWidth }}
        role="img"
        aria-label={label}
      >
        <canvas
          ref={canvas}
          width={W}
          height={H}
          className={`hakoniwa__canvas ${hover ? 'is-pointing' : ''}`}
          onMouseMove={(e) => setHover(at(e))}
          onMouseLeave={() => setHover(null)}
          onClick={(e) => {
            const p = at(e);
            if (p && onAction) onAction(p.d.action!);
          }}
        />
        {placed!
          .filter((p) => p.d.label)
          .map((p, i) => (
            <svg
              key={i}
              className="hakoniwa__overlay"
              style={{
                left: `${((p.left - box.x0) / W) * 100}%`,
                top: `${((p.top - box.y0) / H) * 100}%`,
                width: `${(p.s.w / W) * 100}%`,
              }}
              viewBox={`0 0 ${p.s.w} ${p.s.h}`}
              aria-hidden="true"
            >
              <rect
                x={NOBORI_TAG.x}
                y={NOBORI_TAG.y}
                width={NOBORI_TAG.width}
                height={NOBORI_TAG.height}
                fill={PALETTE.washi}
                stroke={PALETTE.sumi}
                strokeWidth={0.6}
              />
              {[...p.d.label!].map((ch, k, all) => {
                const font = Math.min(NOBORI_TAG.width - 1, (NOBORI_TAG.height - 2) / all.length);
                return (
                  <text
                    key={k}
                    x={NOBORI_TAG.x + NOBORI_TAG.width / 2}
                    y={NOBORI_TAG.y + 1 + font * (k + 0.88)}
                    fontSize={font}
                    textAnchor="middle"
                    fill={PALETTE.sumi}
                    className="scene__nobori"
                  >
                    {ch}
                  </text>
                );
              })}
            </svg>
          ))}
        {hover && (
          <span
            className="hakoniwa__tip"
            style={{
              left: `${((hover.left + hover.s.w / 2 - box.x0) / W) * 100}%`,
              top: `${((hover.top - box.y0) / H) * 100}%`,
            }}
          >
            {name(hover)}
            {hover.d.label && `「${hover.d.label}」`}
            <span className="hakoniwa__tip-go">
              {t(`scene.go.${hover.d.action}` as MessageKey)}
            </span>
          </span>
        )}
      </div>
      {onAction && actions.length > 0 && (
        <div className="hakoniwa__actions" role="group" aria-label={t('scene.actions')}>
          {actions.map((p) => (
            <button key={p.d.action} className="chip" onClick={() => onAction(p.d.action!)}>
              {name(p)}
              <span className="muted">{t(`scene.go.${p.d.action}` as MessageKey)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
