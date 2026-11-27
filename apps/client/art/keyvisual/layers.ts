/**
 * キービジュアル・カプセル画像の層（背景・盤面・連鎖の光・大きな数字・キャラクター・ロゴ）
 *
 * ゲーム内の素材（src/assets の SVG・art/characters のポーズ）をそのまま組み合わせて、絵柄をゲームとそろえる。
 * 光・火花・数字の発光だけは、キービジュアルの例外として半透明の重ね塗りとぼかしを使う（docs/art-style.md「光の表現」）。
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { PartId } from '@chain-factory/sim';
import {
  BOARD_COLORS as B,
  FX_COLORS,
  INK,
  SIGNAL_TIERS,
  TITLE_COLORS as T,
} from '../../src/assets/palette';
import { composeBolt } from '../characters/bolt';
import type { Pose } from '../characters/rig';
import { lettering, textWidth } from '../lettering';
import { circle, el, group, path, rect } from '../svg';

const ASSETS = join(dirname(fileURLToPath(import.meta.url)), '../../src/assets');

/** 書き出し済みの素材（src/assets からの相対パス）を、位置と大きさを決めて埋め込む */
export function embed(
  asset: string,
  x: number,
  y: number,
  w: number,
  h: number,
  extra = '',
): string {
  const data = Buffer.from(readFileSync(join(ASSETS, asset), 'utf8')).toString('base64');
  return `<image href="data:image/svg+xml;base64,${data}" x="${x}" y="${y}" width="${w}" height="${h}" preserveAspectRatio="xMidYMid meet"${extra}/>`;
}

/** ぼかしと光のフィルター（キービジュアルの例外。各 SVG に1回だけ入れる。k は画像の大きさに合わせたぼかしの倍率） */
export function filters(k = 1): string {
  const blur = (id: string, std: number) =>
    el(
      'filter',
      { id, x: '-50%', y: '-50%', width: '200%', height: '200%' },
      el('feGaussianBlur', { stdDeviation: std * k }),
    );
  return el('defs', {}, blur('kv-glow', 6), blur('kv-glow-big', 16));
}
export const FILTERS = filters(1);

// ---- 背景 ----

/** 夕暮れの空（フラットな帯を重ねる。グラデーションは使わない） */
export function duskSky(w: number, h: number, horizon: number): string[] {
  const bands = [T['sky-top'], '#1c2040', '#2a2550', T['sky-bottom'], '#5a3358'];
  const bandH = horizon / bands.length;
  return [
    ...bands.map((c, i) => rect(0, i * bandH, w, bandH + 1, { fill: c })),
    rect(0, horizon, w, h - horizon, { fill: T.factory }),
    // 地平線の夕焼け（光の例外: 半透明・ぼかし）
    el('ellipse', {
      cx: w / 2,
      cy: horizon,
      rx: w * 0.6,
      ry: 60,
      fill: T.glow,
      opacity: 0.35,
      filter: 'url(#kv-glow-big)',
    }),
  ];
}

/** 星（決まった位置。乱数を使わず、書き出しが毎回同じになるように） */
export function stars(w: number, h: number, count: number): string[] {
  return Array.from({ length: count }, (_, i) => {
    const x = (i * 197) % w;
    const y = (i * 89) % h;
    return circle(x, y, i % 3 === 0 ? 1.6 : 1, { fill: INK.white, opacity: i % 2 ? 0.7 : 0.4 });
  });
}

/** 工場のシルエットを並べる（タイトル画面の素材） */
export function factoryRow(y: number, w: number, scale = 1): string[] {
  const fw = 260 * scale;
  const fh = 150 * scale;
  return Array.from({ length: Math.ceil(w / fw) + 1 }, (_, i) =>
    embed('title/factory.svg', i * fw - 30, y - fh, fw, fh),
  );
}

// ---- 盤面 ----

export interface BoardCell {
  x: number;
  y: number;
  part?: PartId;
  /** 向き（0:上 1:右 2:下 3:左。絵を回す） */
  dir?: 0 | 1 | 2 | 3;
  floor?: 'double' | 'triple' | 'add';
}

/** 盤面（ハザードの枠・床・床タイル・パーツ）。(x, y) は左上、cell はマスの大きさ */
export function board(
  x: number,
  y: number,
  size: number,
  cell: number,
  cells: BoardCell[],
): string[] {
  const pad = cell * 0.35;
  const out: string[] = [];
  const outer = size * cell + pad * 2;
  // 枠: 黄黒の警戒の縞
  out.push(
    rect(
      x - pad,
      y - pad,
      outer,
      outer,
      { fill: B.hazardYellow, stroke: INK.outline, 'stroke-width': 4 },
      cell * 0.15,
    ),
  );
  const stripes: string[] = [];
  for (let i = -outer; i < outer; i += cell * 0.45) {
    stripes.push(
      path(
        `M${x - pad + i} ${y - pad + outer} l${outer} ${-outer} h${cell * 0.22} l${-outer} ${outer} Z`,
        { fill: B.hazardBlack },
      ),
    );
  }
  out.push(
    el('clipPath', { id: `kvb${x}${y}` }, rect(x - pad, y - pad, outer, outer, {})),
    group({ 'clip-path': `url(#kvb${x}${y})` }, ...stripes),
  );
  for (let j = 0; j < size; j++) {
    for (let i = 0; i < size; i++) {
      out.push(
        embed(`board/floor-${((i + j * 2) % 3) + 1}.svg`, x + i * cell, y + j * cell, cell, cell),
      );
    }
  }
  for (const c of cells) {
    if (c.floor)
      out.push(embed(`board/floor-${c.floor}.svg`, x + c.x * cell, y + c.y * cell, cell, cell));
  }
  for (const c of cells) {
    if (!c.part) continue;
    const cx = x + (c.x + 0.5) * cell;
    const cy = y + (c.y + 0.5) * cell;
    out.push(
      group(
        { transform: `rotate(${(c.dir ?? 0) * 90} ${cx} ${cy})` },
        embed(
          `parts/${c.part}.svg`,
          x + c.x * cell + cell * 0.06,
          y + c.y * cell + cell * 0.06,
          cell * 0.88,
          cell * 0.88,
        ),
      ),
    );
  }
  return out;
}

// ---- 連鎖の光 ----

/** 信号の光の筋（点の列をつなぐ。外側にぼかした光、内側に明るい芯） */
export function chainLight(points: [number, number][], width: number, tier = 1): string[] {
  const d = points.map(([px, py], i) => `${i ? 'L' : 'M'}${px} ${py}`).join(' ');
  const color = SIGNAL_TIERS[Math.min(tier, SIGNAL_TIERS.length - 1)]!;
  return [
    path(d, {
      fill: 'none',
      stroke: color,
      'stroke-width': width * 2.6,
      opacity: 0.55,
      filter: 'url(#kv-glow)',
      'stroke-linejoin': 'round',
      'stroke-linecap': 'round',
    }),
    path(d, {
      fill: 'none',
      stroke: color,
      'stroke-width': width,
      'stroke-linejoin': 'round',
      'stroke-linecap': 'round',
    }),
    path(d, {
      fill: 'none',
      stroke: FX_COLORS.flash,
      'stroke-width': width * 0.35,
      'stroke-linejoin': 'round',
      'stroke-linecap': 'round',
    }),
  ];
}

/** 放射状の光の筋（押した瞬間） */
export function burst(
  cx: number,
  cy: number,
  r: number,
  rays: number,
  color: string = SIGNAL_TIERS[1]!,
): string[] {
  const out: string[] = [
    el('circle', { cx, cy, r: r * 0.5, fill: color, opacity: 0.4, filter: 'url(#kv-glow-big)' }),
  ];
  for (let i = 0; i < rays; i++) {
    const a = (i / rays) * Math.PI * 2 + 0.2;
    const inner = r * 0.25;
    const outer = r * (i % 2 ? 0.75 : 1);
    const spread = 0.05;
    const p = (ang: number, rad: number) =>
      `${(cx + Math.cos(ang) * rad).toFixed(1)} ${(cy + Math.sin(ang) * rad).toFixed(1)}`;
    out.push(
      path(`M${p(a - spread, inner)} L${p(a, outer)} L${p(a + spread, inner)} Z`, {
        fill: color,
        opacity: 0.55,
      }),
    );
  }
  return out;
}

/** 火花（小さな菱形を決まった位置に散らす） */
export function sparks(cx: number, cy: number, r: number, count: number, size: number): string[] {
  return Array.from({ length: count }, (_, i) => {
    const a = i * 2.39996;
    const d = r * (0.35 + ((i * 37) % 65) / 100);
    const x = cx + Math.cos(a) * d;
    const y = cy + Math.sin(a) * d;
    const s = size * (0.6 + ((i * 13) % 40) / 100);
    const color = SIGNAL_TIERS[i % SIGNAL_TIERS.length]!;
    return path(`M${x} ${y - s} L${x + s * 0.4} ${y} L${x} ${y + s} L${x - s * 0.4} ${y} Z`, {
      fill: color,
      stroke: INK.outline,
      'stroke-width': 1.5,
    });
  });
}

// ---- 大きな数字 ----

/** 発光する大きな数字（中央揃え。高さ 24 × scale） */
export function bigNumber(
  text: string,
  cx: number,
  y: number,
  scale: number,
  color: string = SIGNAL_TIERS[1]!,
): string[] {
  return [
    group(
      { filter: 'url(#kv-glow-big)', opacity: 0.8 },
      lettering(text, { x: cx, y, scale, fill: color, outline: null, weight: 9, anchor: 'middle' }),
    ),
    lettering(text, {
      x: cx,
      y,
      scale,
      fill: color,
      outline: INK.outline,
      weight: 6,
      anchor: 'middle',
    }),
  ];
}

/** 倍率のポップ（×2 など。小さな数字の札） */
export function pop(text: string, cx: number, cy: number, scale: number): string[] {
  const w = textWidth(text) * scale + 14 * scale;
  return [
    rect(
      cx - w / 2,
      cy - 18 * scale,
      w,
      36 * scale,
      { fill: B.badgeFill, stroke: INK.outline, 'stroke-width': 3 },
      8 * scale,
    ),
    lettering(text, {
      x: cx,
      y: cy - 12 * scale,
      scale,
      fill: B.badgeText,
      outline: null,
      weight: 5,
      anchor: 'middle',
    }),
  ];
}

// ---- キャラクター・ロゴ ----

/** ボルトの全身（腰が原点の座標を、足もと (x, groundY)・高さ height に合わせる） */
export function bolt(pose: Pose, x: number, groundY: number, height: number, flip = false): string {
  // 設定画の viewBox は y -122〜40（162）。足もと（地面）は y = 28
  const s = height / 150;
  return group(
    { transform: `translate(${x} ${groundY - 28 * s}) scale(${flip ? -s : s} ${s})` },
    ...composeBolt(pose, true),
  );
}

/** ロゴ（暗い背景用。viewBox 253×90） */
export function logo(x: number, y: number, width: number): string {
  return embed('logo/logo-dark-bg.svg', x, y, width, (width * 90) / 253);
}

/** ロケット（完成形・炎・煙。viewBox -16 -8 96 104 の素材を、中心 x・下端 y・高さで置く） */
export function rocket(cx: number, bottom: number, height: number, launching: boolean): string[] {
  const w = (height * 96) / 104;
  const out = [embed('rocket/rocket-9.svg', cx - w / 2, bottom - height, w, height)];
  if (launching) {
    const fw = height * 0.45;
    out.unshift(
      embed('rocket/smoke.svg', cx - fw * 1.4, bottom - height * 0.05, fw * 2.8, fw * 1.8),
      el('ellipse', {
        cx,
        cy: bottom,
        rx: fw * 0.6,
        ry: fw * 0.9,
        fill: '#ff7043',
        opacity: 0.5,
        filter: 'url(#kv-glow-big)',
      }),
      embed('rocket/flame.svg', cx - fw / 2, bottom - height * 0.12, fw, fw * 0.8),
    );
  }
  return out;
}
