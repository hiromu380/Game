import { useEffect, useMemo, useRef, useState } from 'react';
import { useI18n, type MessageKey } from '../i18n';
import { sprite } from '../art/sprites';
import { PALETTE } from '../art/palette';
import type { SceneAction } from '../art/hakoniwa/grid';
import type { Actor } from '../art/hakoniwa/actors';
import type { Season } from '../art/hakoniwa/compound';
import { FOOT, PERSON, personPixels } from '../art/hakoniwa/people';
import { NOBORI_TAG } from '../art/sprites/keikoba';

/** 描く物: (x, y) は絵の足元（tip: 絵のいちばん下の点 / box: 絵の枠の下の中央）。舞台のドット */
export interface Drawn {
  sprite: string;
  x: number;
  y: number;
  anchor: 'tip' | 'box';
  action?: SceneAction;
  label?: string;
  /** 奥行き（大きいほど手前）。省くと並び順 */
  z?: number;
}

/** 箱庭に立つ人。title は指したとき・選んだときに出す名前 */
export type SceneActor = Actor & { title?: string };

/** 人の頭の上に浮かべる字（週の行動で伸びた量・けが）。key が変わったときだけ1回浮かぶ */
export interface Pop {
  rikishiId: number;
  text: string;
  tone: 'up' | 'hurt';
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
  z: number;
}

function place(d: Drawn, s: Loaded, index: number): Placed {
  const [ax, ay] = d.anchor === 'tip' ? s.tip : [Math.floor(s.w / 2), s.h - 1];
  return { d, s, left: Math.round(d.x - ax), top: Math.round(d.y - ay), z: d.z ?? index };
}

/** 人の絵を、描けるキャンバスにする（同じ見た目は使い回す） */
const people = new Map<string, HTMLCanvasElement>();
function personCanvas(look: Actor['look'], frame: 0 | 1, flip: boolean): HTMLCanvasElement {
  const key = `${look.pose}:${frame}:${look.skin}:${look.mawashi}:${look.hair}:${look.build}:${look.cloth ?? ''}:${flip ? 1 : 0}`;
  const hit = people.get(key);
  if (hit) return hit;
  const px = personPixels({ ...look, frame, flip });
  const c = document.createElement('canvas');
  c.width = px.width;
  c.height = px.height;
  const img = new ImageData(px.width, px.height);
  img.data.set(px.data);
  c.getContext('2d')?.putImageData(img, 0, 0);
  people.set(key, c);
  return c;
}

/** もう浮かべた字の組（画面を開き直しても、同じ組は浮かべない） */
const shownPops = new Set<string>();

/** 人の動きの拍（ミリ秒）と、行き来の1往復の拍数 */
const BEAT = 420;
const WALK_BEATS = 8;

/** その拍の、人の足元とコマ・向き */
function actorAt(a: Actor, beat: number): { x: number; y: number; frame: 0 | 1; flip: boolean } {
  const k = (beat + a.phase) % WALK_BEATS;
  const frame = ((beat + a.phase) % 2) as 0 | 1;
  const flip = a.look.flip ?? false;
  if (!a.to) return { x: a.x, y: a.y, frame, flip };
  const half = WALK_BEATS / 2;
  const f = k < half ? k / half : (WALK_BEATS - k) / half;
  // 戻るときは向きを返す
  return {
    x: Math.round(a.x + (a.to.x - a.x) * f),
    y: Math.round(a.y + (a.to.y - a.y) * f),
    frame,
    flip: k >= half ? !flip : flip,
  };
}

/** 決まったばらつき（0〜1。乱数を使わない） */
function hash(i: number, salt: number): number {
  return ((Math.imul(i + 1, 2654435761) ^ Math.imul(salt + 7, 40503)) >>> 0) / 4294967296;
}

/** 季節のもの: 春は花びら、秋は落ち葉、冬は雪が、ゆっくり降る */
function drawWeather(ctx: CanvasRenderingContext2D, box: View, season: Season, t: number): void {
  const W = box.x1 - box.x0;
  const H = box.y1 - box.y0;
  const kind = {
    spring: { n: 16, color: PALETTE.sakura, fall: 14, sway: 10 },
    summer: null,
    autumn: { n: 12, color: PALETTE.momiji, fall: 18, sway: 8 },
    winter: { n: 46, color: PALETTE.snow, fall: 22, sway: 4 },
  }[season];
  if (!kind) return;
  ctx.fillStyle = kind.color;
  for (let i = 0; i < kind.n; i++) {
    const speed = kind.fall * (0.6 + hash(i, 1) * 0.8);
    const y = (hash(i, 2) * H + (t / 1000) * speed) % H;
    const x =
      (hash(i, 3) * W + Math.sin(t / 900 + i) * kind.sway + (t / 1000) * 3 * hash(i, 4)) % W;
    const size = hash(i, 5) < 0.4 ? 2 : 1;
    ctx.fillRect(Math.round(box.x0 + x), Math.round(box.y0 + y), size, size);
  }
}

/** ちゃんこ場の湯気: 小さなかたまりが上がって消える */
function drawSmoke(ctx: CanvasRenderingContext2D, at: { x: number; y: number }, t: number): void {
  ctx.fillStyle = PALETTE.washi;
  for (let i = 0; i < 7; i++) {
    const age = (t / 3200 + i / 7) % 1;
    const size = 3 + Math.round(age * 5);
    ctx.globalAlpha = 0.85 * (1 - age);
    const x = Math.round(at.x + age * 14 + Math.sin(t / 700 + i * 2) * 2);
    const y = Math.round(at.y - age * 34);
    // 角を落とした、まるいかたまり
    ctx.fillRect(x + 1, y, size - 2, size);
    ctx.fillRect(x, y + 1, size, size - 2);
  }
  ctx.globalAlpha = 1;
}

/**
 * 箱庭を1枚のキャンバスに描く（地面 → 奥の物から順に）。1枚の画として拡大するので、ドットの大きさがそろう。
 * 人は拍に合わせて動く（動きを減らす設定では止める）。押せる物・人は、押すとその画面へ・話しかける
 */
export function Hakoniwa({
  items,
  actors,
  base,
  drawBase,
  view,
  label,
  onAction,
  onPick,
  selected = null,
  season = null,
  smoke = null,
  maxWidth = 960,
  minWidth = 0,
  focus = 0.5,
  pops = [],
  popKey = '',
}: {
  items: Drawn[];
  actors?: SceneActor[];
  /** これがまだ取り込まれていなければ、何も出さない */
  base: string;
  drawBase?: (ctx: CanvasRenderingContext2D) => void;
  /** 見える範囲。y0 を省くと、いちばん高い絵の上まで */
  view: Omit<View, 'y0'> & { y0?: number };
  label: string;
  onAction?: (a: SceneAction) => void;
  /** 人を押した（弟子の ID） */
  onPick?: (rikishiId: number) => void;
  /** 選んでいる弟子（頭の上に印） */
  selected?: number | null;
  /** 季節のもの（花びら・落ち葉・雪）を降らせる */
  season?: Season | null;
  /** 湯気を上げる所（舞台のドット） */
  smoke?: { x: number; y: number } | null;
  maxWidth?: number;
  /** 狭い画面でもこの幅より小さくしない（はみ出る分は横に動かして見る） */
  minWidth?: number;
  /** はみ出るとき、はじめに見せる所（0: 左端 〜 1: 右端） */
  focus?: number;
  /** 人の頭の上に浮かべる字 */
  pops?: Pop[];
  /** 浮かべる字の組の鍵（同じ鍵では、画面を開き直しても浮かべない） */
  popKey?: string;
}) {
  const { t } = useI18n();
  const canvas = useRef<HTMLCanvasElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const [placed, setPlaced] = useState<Placed[] | null>(null);
  const [hover, setHover] = useState<{ x: number; y: number; text: string; go?: string } | null>(
    null,
  );
  const key = JSON.stringify(items);
  useEffect(() => {
    let live = true;
    Promise.all(items.map((d) => load(d.sprite))).then((ss) => {
      if (!live) return;
      setPlaced(items.flatMap((d, i) => (ss[i] ? [place(d, ss[i]!, i)] : [])));
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

  // 描く・動かす。最後に描いた人の位置を、当たり判定に使う
  const drawnActors = useRef<{ a: SceneActor; left: number; top: number }[]>([]);
  const live = useRef({ actors, selected, season, smoke });
  live.current = { actors, selected, season, smoke };
  useEffect(() => {
    const c = canvas.current;
    if (!c || !placed || !box) return;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    const W = box.x1 - box.x0;
    const H = box.y1 - box.y0;
    // 地面は一度だけ描いて使い回す
    let ground: HTMLCanvasElement | null = null;
    if (drawBase) {
      ground = document.createElement('canvas');
      ground.width = W;
      ground.height = H;
      const g = ground.getContext('2d');
      if (g) {
        g.translate(-box.x0, -box.y0);
        drawBase(g);
      }
    }
    const still =
      typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    const draw = (time: number) => {
      const now = live.current;
      const beat = still ? 0 : Math.floor(time / BEAT);
      ctx.imageSmoothingEnabled = false;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, W, H);
      if (ground) ctx.drawImage(ground, 0, 0);
      ctx.translate(-box.x0, -box.y0);
      const list: { z: number; draw: () => void }[] = placed.map((p) => ({
        z: p.z,
        draw: () => ctx.drawImage(p.s.img, p.left, p.top),
      }));
      drawnActors.current = [];
      for (const a of now.actors ?? []) {
        const at = actorAt(a, beat);
        const left = at.x - FOOT.x;
        const top = at.y - FOOT.y;
        drawnActors.current.push({ a, left, top });
        list.push({
          z: a.z,
          draw: () => {
            if (a.look.pose !== 'lie') {
              // 足元の影（地面に立たせる）
              ctx.globalAlpha = 0.22;
              ctx.fillStyle = PALETTE.sumi;
              ctx.fillRect(at.x - 7, at.y - 1, 15, 3);
              ctx.fillRect(at.x - 5, at.y - 2, 11, 5);
              ctx.globalAlpha = 1;
            }
            ctx.drawImage(personCanvas(a.look, at.frame, at.flip), left, top);
            if (a.rikishiId !== null && a.rikishiId === now.selected) {
              // 選んだ弟子の頭の上に、紅の印（拍で上下する）
              const y = top - 3 - (beat % 2);
              ctx.fillStyle = PALETTE.sumi;
              ctx.fillRect(left + FOOT.x - 4, y - 1, 9, 6);
              ctx.fillStyle = PALETTE.beni;
              ctx.fillRect(left + FOOT.x - 3, y, 7, 2);
              ctx.fillRect(left + FOOT.x - 2, y + 2, 5, 1);
              ctx.fillRect(left + FOOT.x - 1, y + 3, 3, 1);
            }
          },
        });
      }
      list.sort((p, q) => p.z - q.z);
      for (const it of list) it.draw();
      if (now.smoke) drawSmoke(ctx, now.smoke, still ? 0 : time);
      if (now.season) drawWeather(ctx, box, now.season, still ? 0 : time);
    };
    if (still) {
      draw(0);
      // 選んだ弟子の印などは、変わるたびに描き直す
      const id = setInterval(() => draw(0), 500);
      return () => clearInterval(id);
    }
    let raf = 0;
    let last = -1;
    const loop = (time: number) => {
      // 1秒に12回ほど描けば足りる
      const step = Math.floor(time / 85);
      if (step !== last) {
        last = step;
        draw(time);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [placed, box, drawBase]);

  // はみ出る幅のときは、見せたい所（庭のまん中）から始める
  const ready = box !== null;
  useEffect(() => {
    const el = scroller.current;
    if (el && ready) el.scrollLeft = (el.scrollWidth - el.clientWidth) * focus;
  }, [ready, focus]);

  if (!sprite(base) || !box) return null;
  const W = box.x1 - box.x0;
  const H = box.y1 - box.y0;

  type Hit =
    { kind: 'actor'; a: SceneActor; left: number; top: number } | { kind: 'piece'; p: Placed };
  /** 画面の座標 → 押した人・物（人が先。物は絵の不透明な所だけ当たる） */
  const at = (e: { clientX: number; clientY: number }): Hit | null => {
    const c = canvas.current;
    if (!c || !placed) return null;
    const r = c.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * W + box.x0;
    const y = ((e.clientY - r.top) / r.height) * H + box.y0;
    const acts = [...drawnActors.current].sort((p, q) => q.a.z - p.a.z);
    for (const d of acts) {
      if (d.a.rikishiId === null) continue;
      // 指で押しやすいよう、絵より少し広く当てる
      if (
        x >= d.left + 2 &&
        x <= d.left + PERSON.width - 2 &&
        y >= d.top - 2 &&
        y <= d.top + PERSON.height
      )
        return { kind: 'actor', ...d };
    }
    const pieces = [...placed].sort((p, q) => q.z - p.z);
    for (const p of pieces) {
      const lx = Math.floor(x - p.left);
      const ly = Math.floor(y - p.top);
      if (lx < 0 || ly < 0 || lx >= p.s.w || ly >= p.s.h) continue;
      if (p.s.alpha[ly * p.s.w + lx]! > 0) return p.d.action ? { kind: 'piece', p } : null;
    }
    return null;
  };
  const actions = [
    ...new Map(placed!.filter((p) => p.d.action).map((p) => [p.d.action!, p])).values(),
  ];
  const name = (p: Placed) =>
    t(`scene.piece.${p.d.sprite.replace(/_\d$|__\w+$/, '')}` as MessageKey);
  const chosen = drawnActors.current.find(
    (d) => d.a.rikishiId !== null && d.a.rikishiId === selected,
  );

  return (
    <div className="hakoniwa">
      <div className="hakoniwa__scroll" ref={scroller}>
        <div
          className="hakoniwa__stage"
          style={{ aspectRatio: `${W} / ${H}`, maxWidth, minWidth: minWidth || undefined }}
          role="img"
          aria-label={label}
        >
          <canvas
            ref={canvas}
            width={W}
            height={H}
            className={`hakoniwa__canvas ${hover ? 'is-pointing' : ''}`}
            onMouseMove={(e) => {
              const h = at(e);
              if (!h) return setHover(null);
              if (h.kind === 'actor')
                setHover({
                  x: h.left + PERSON.width / 2,
                  y: h.top,
                  text: h.a.title ?? '',
                  go: t('scene.go.talk'),
                });
              else
                setHover({
                  x: h.p.left + h.p.s.w / 2,
                  y: h.p.top,
                  text: name(h.p) + (h.p.d.label ? `「${h.p.d.label}」` : ''),
                  go: t(`scene.go.${h.p.d.action}` as MessageKey),
                });
            }}
            onMouseLeave={() => setHover(null)}
            onClick={(e) => {
              const h = at(e);
              if (!h) return;
              if (h.kind === 'actor') onPick?.(h.a.rikishiId!);
              else onAction?.(h.p.d.action!);
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
          {(hover ??
            (chosen
              ? { x: chosen.left + PERSON.width / 2, y: chosen.top - 6, text: chosen.a.title ?? '' }
              : null)) &&
            (() => {
              const tip = hover ?? {
                x: chosen!.left + PERSON.width / 2,
                y: chosen!.top - 6,
                text: chosen!.a.title ?? '',
                go: undefined,
              };
              return (
                <span
                  className="hakoniwa__tip"
                  style={{
                    left: `${Math.min(92, Math.max(8, ((tip.x - box.x0) / W) * 100))}%`,
                    top: `${((tip.y - box.y0) / H) * 100}%`,
                  }}
                >
                  {tip.text}
                  {tip.go && <span className="hakoniwa__tip-go">{tip.go}</span>}
                </span>
              );
            })()}
          {popKey &&
            !shownPops.has(popKey) &&
            pops.map((p) => {
              const a = (actors ?? []).find((x) => x.rikishiId === p.rikishiId);
              if (!a) return null;
              return (
                <span
                  key={`${popKey}:${p.rikishiId}`}
                  className={`hakoniwa__pop is-${p.tone}`}
                  aria-hidden="true"
                  style={{
                    left: `${((a.x - box.x0) / W) * 100}%`,
                    top: `${((a.y - PERSON.height - box.y0) / H) * 100}%`,
                  }}
                  onAnimationEnd={() => shownPops.add(popKey)}
                >
                  {p.text}
                </span>
              );
            })}
        </div>
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
