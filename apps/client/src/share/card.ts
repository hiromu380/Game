/**
 * スコア共有カードの組み立て（純粋な関数）: 結果データ → 描画命令の配列
 *
 * 画面や Canvas には触れない（描くのは share/renderCard.ts）。文言は呼び出し側で翻訳して渡す。
 * - 通常ラン: 盤面の縮小図を載せる（配置データから描き直す。スクリーンショットは使わない）
 * - 週替わり: 盤面はネタバレになるので載せず、シフトごとの結果（達成・未達・未到達）を載せる
 */
import type { Board, PartId } from '@chain-factory/sim';
import { BOARD_COLORS, UI_COLORS } from '../assets/palette';
import { SHARE_CONFIG, type ShareCardSize } from '../config/share';

/** 画像の種類（実際の画像は描く側で素材マニフェストから取る） */
export type CardImage = 'logo' | 'bolt' | `part:${PartId}`;

export type DrawCommand =
  | { kind: 'rect'; x: number; y: number; w: number; h: number; color: string; radius?: number }
  /** ハザード柄（黄と黒の斜めしま）の帯。band はしま1本の幅 */
  | { kind: 'hazard'; x: number; y: number; w: number; h: number; band: number }
  | {
      kind: 'text';
      x: number;
      y: number;
      text: string;
      size: number;
      color: string;
      weight: 400 | 800;
      align: 'left' | 'center' | 'right';
    }
  /** dir: パーツの向き（回転させる素材だけ描く側で回す） */
  | { kind: 'image'; image: CardImage; x: number; y: number; w: number; h: number; dir?: number };

export type ShiftResult = 'cleared' | 'failed' | 'notPlayed';

export interface ShareCardInput {
  /** 見出し（例: 「打ち上げ成功！」「週替わり #12」） */
  title: string;
  /** 見出しの下の小さな文字（週替わりの日付など。なければ null） */
  subtitle: string | null;
  scoreLabel: string;
  /** 出荷量（表記済みの文字列） */
  score: string;
  /** 到達したシフト（例: 「シフト 7 / 9 まで到達」） */
  shifts: string;
  /** 順位（週替わりで取れたときだけ。例: 「12位・上位 5%」） */
  rank: string | null;
  /** 通常ランの盤面（週替わりは null） */
  board: Board | null;
  /** 週替わりのシフトごとの結果（通常ランは null） */
  results: ShiftResult[] | null;
  url: string;
}

const C = {
  bg: UI_COLORS.bg,
  panel: UI_COLORS.panel,
  text: UI_COLORS.text,
  muted: UI_COLORS.muted,
  accent: UI_COLORS.accent,
  met: UI_COLORS.met,
  missed: UI_COLORS.missed,
  floor: BOARD_COLORS.floorA,
  floorAlt: BOARD_COLORS.floorB,
  empty: UI_COLORS.secondary,
};

/** 出荷量の文字の大きさ: 枠の幅に収まるよう、桁が多いほど小さくする */
export function fitScoreSize(text: string, maxWidth: number): number {
  const { max, min } = SHARE_CONFIG.scoreFont;
  const fit = Math.floor(maxWidth / (Math.max(1, text.length) * SHARE_CONFIG.digitWidthRatio));
  return Math.max(min, Math.min(max, fit));
}

/** 盤面の縮小図（ハザード柄の枠・床・パーツ） */
function boardThumbnail(board: Board, x: number, y: number, size: number): DrawCommand[] {
  const frame = Math.round(size * 0.04);
  const inner = size - frame * 2;
  const cell = inner / Math.max(board.width, board.height);
  const commands: DrawCommand[] = [
    { kind: 'hazard', x, y, w: size, h: size, band: frame * 1.5 },
    { kind: 'rect', x: x + frame, y: y + frame, w: inner, h: inner, color: C.floor },
  ];
  for (let cy = 0; cy < board.height; cy++) {
    for (let cx = 0; cx < board.width; cx++) {
      const px = x + frame + cx * cell;
      const py = y + frame + cy * cell;
      if ((cx + cy) % 2 === 1) {
        commands.push({ kind: 'rect', x: px, y: py, w: cell, h: cell, color: C.floorAlt });
      }
      const part = board.cells[cy * board.width + cx];
      if (part) {
        const pad = cell * 0.08;
        commands.push({
          kind: 'image',
          image: `part:${part.id}`,
          x: px + pad,
          y: py + pad,
          w: cell - pad * 2,
          h: cell - pad * 2,
          dir: part.dir,
        });
      }
    }
  }
  return commands;
}

/** シフトごとの結果の四角の列 */
function resultRow(results: ShiftResult[], x: number, y: number, box: number): DrawCommand[] {
  const color = { cleared: C.met, failed: C.missed, notPlayed: C.empty } as const;
  return results.map((r, i) => ({
    kind: 'rect',
    x: x + i * (box * 1.25),
    y,
    w: box,
    h: box,
    color: color[r],
    radius: box * 0.2,
  }));
}

/** カードの描画命令 */
export function buildShareCard(input: ShareCardInput, size: ShareCardSize): DrawCommand[] {
  const { width: W, height: H } = SHARE_CONFIG.sizes[size];
  const landscape = size === 'landscape';
  const margin = Math.round(W * 0.045);
  const stripe = Math.round(H * 0.022);
  const commands: DrawCommand[] = [
    { kind: 'rect', x: 0, y: 0, w: W, h: H, color: C.bg },
    { kind: 'hazard', x: 0, y: 0, w: W, h: stripe, band: stripe },
    { kind: 'hazard', x: 0, y: H - stripe, w: W, h: stripe, band: stripe },
  ];

  // 絵（通常ランは盤面、週替わりはボルト）: 横長は右側に置く。正方形は文字の下に置く（大きさは残りの高さで決める）
  const landscapeArt = Math.round(H * 0.72);
  const artX0 = W - margin - landscapeArt;

  // 文字の列（横長は左側、正方形は中央ぞろえ）
  const colX = landscape ? margin : W / 2;
  const align = landscape ? 'left' : 'center';
  const colWidth = landscape ? artX0 - margin * 2 : W - margin * 2;
  let y = stripe + margin;

  const logoW = Math.round((landscape ? 0.3 : 0.42) * W);
  const logoH = Math.round((logoW * 90) / 253); // ロゴの縦横比（art/logo.ts の viewBox）
  commands.push({
    kind: 'image',
    image: 'logo',
    x: landscape ? colX : (W - logoW) / 2,
    y,
    w: logoW,
    h: logoH,
  });
  y += logoH + margin * 0.8;

  const titleSize = Math.round(W * (landscape ? 0.036 : 0.045));
  commands.push({
    kind: 'text',
    x: colX,
    y,
    text: input.title,
    size: titleSize,
    color: C.accent,
    weight: 800,
    align,
  });
  y += titleSize * 1.2;
  if (input.subtitle) {
    const s = Math.round(titleSize * 0.6);
    commands.push({
      kind: 'text',
      x: colX,
      y,
      text: input.subtitle,
      size: s,
      color: C.muted,
      weight: 400,
      align,
    });
    y += s * 1.4;
  }

  const labelSize = Math.round(titleSize * 0.62);
  y += labelSize * 0.6;
  commands.push({
    kind: 'text',
    x: colX,
    y,
    text: input.scoreLabel,
    size: labelSize,
    color: C.muted,
    weight: 400,
    align,
  });
  y += labelSize * 1.1;
  const scoreSize = fitScoreSize(input.score, colWidth);
  commands.push({
    kind: 'text',
    x: colX,
    y,
    text: input.score,
    size: scoreSize,
    color: C.met,
    weight: 800,
    align,
  });
  y += scoreSize * 1.05;

  const infoSize = Math.round(titleSize * 0.8);
  commands.push({
    kind: 'text',
    x: colX,
    y,
    text: input.shifts,
    size: infoSize,
    color: C.text,
    weight: 800,
    align,
  });
  y += infoSize * 1.4;
  if (input.rank) {
    commands.push({
      kind: 'text',
      x: colX,
      y,
      text: input.rank,
      size: infoSize,
      color: C.accent,
      weight: 800,
      align,
    });
    y += infoSize * 1.4;
  }
  if (input.results) {
    const box = Math.round(infoSize * 0.9);
    const rowWidth = input.results.length * box * 1.25 - box * 0.25;
    commands.push(...resultRow(input.results, landscape ? colX : (W - rowWidth) / 2, y, box));
  }

  const urlSize = Math.round(titleSize * 0.55);
  const urlY = H - stripe - margin * 0.9;
  if (input.results) y += Math.round(infoSize * 0.9) + margin * 0.6;
  const art = landscape
    ? { x: artX0, y: (H - landscapeArt) / 2, size: landscapeArt }
    : (() => {
        const size = Math.max(0, Math.round(Math.min(W * 0.5, urlY - margin * 0.6 - y)));
        return { x: (W - size) / 2, y, size };
      })();
  if (art.size > 0) {
    if (input.board) commands.push(...boardThumbnail(input.board, art.x, art.y, art.size));
    else
      commands.push({ kind: 'image', image: 'bolt', x: art.x, y: art.y, w: art.size, h: art.size });
  }
  commands.push({
    kind: 'text',
    x: landscape ? margin : W / 2,
    y: urlY,
    text: input.url,
    size: urlSize,
    color: C.muted,
    weight: 400,
    align,
  });
  return commands;
}
