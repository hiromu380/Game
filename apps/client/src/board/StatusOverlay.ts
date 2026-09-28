/**
 * 盤面の「状態表示」レイヤー
 * - 各パーツの残り発動回数（ピップ: ●=残り ○=使用済み、無制限は ∞）
 * - 再生後の「連鎖が途切れた場所と理由」
 *
 * 発動回数の上限は sim の computeActivationLimits から受け取り、
 * 再生中は activate / reset イベントに合わせて増減させるだけ（ロジックは再計算しない）。
 */
import {
  computeActivationLimits,
  type Board,
  type RuleSet,
  type VanishReason,
} from '@chain-factory/sim';
import { Container, Graphics, Text } from 'pixi.js';
import { BOARD_THEME } from '../assets/manifest';
import type { BreakSummary } from '../playback/breaks';
import { CELL_SIZE, cellCenter } from './layout';

/** ピップを並べる最大数（これを超える上限は数字で表示）。向きの矢印と重ならない数にしている */
const MAX_PIPS = 3;

export class StatusOverlay {
  readonly pipLayer = new Container();
  readonly breakLayer = new Container();

  private board: Board | null = null;
  private rulesKey = '';
  private limits: (number | null)[] = [];
  private remaining: (number | null)[] = [];
  /** マス index → ピップの表示（部分的に描き直すため） */
  private pipViews = new Map<number, Container>();

  constructor(private readonly getBreakLabel: (reason: VanishReason) => string) {}

  /** 盤面が変わったら上限を計算し直してピップを描く。盤面自体が変わったら途切れ表示を消す */
  setBoard(board: Board, rules: RuleSet): void {
    // 盤面もルールも変わっていなければ何もしない（再生後の残り回数表示を保つため）
    const rulesKey = JSON.stringify(rules);
    if (board === this.board && rulesKey === this.rulesKey) return;
    if (board !== this.board) this.clearBreaks();
    this.board = board;
    this.rulesKey = rulesKey;
    this.limits = computeActivationLimits(board, rules);
    this.resetPips();
  }

  /** 残り発動回数を満タンに戻す（再生開始時・再生終了後） */
  resetPips(): void {
    this.remaining = [...this.limits];
    this.pipLayer.removeChildren().forEach((c) => c.destroy({ children: true }));
    this.pipViews.clear();
    if (!this.board) return;
    this.board.cells.forEach((part, index) => {
      if (part && part.id !== 'switch') this.drawPips(index);
    });
  }

  /** パーツが発動した（残りを1減らす） */
  onActivate(x: number, y: number): void {
    const index = this.indexOf(x, y);
    const current = this.remaining[index];
    if (current === null || current === undefined) return;
    this.remaining[index] = Math.max(0, current - 1);
    this.drawPips(index);
  }

  /** 発動回数がリセットされた（満タンに戻す） */
  onReset(x: number, y: number): void {
    const index = this.indexOf(x, y);
    this.remaining[index] = this.limits[index] ?? null;
    this.drawPips(index);
  }

  /** 途切れた場所に理由のマーカーを置く */
  showBreaks(summary: BreakSummary): void {
    this.clearBreaks();
    for (const marker of summary.markers) {
      const { px, py } = cellCenter(marker.x, marker.y);
      const label =
        this.getBreakLabel(marker.reason) + (marker.count > 1 ? `×${marker.count}` : '');
      const view = createBreakMarker(label, BREAK_COLORS[marker.reason]);
      // マスの右上寄りに置き、パーツの絵を隠しすぎないようにする
      view.position.set(px + CELL_SIZE * 0.18, py - CELL_SIZE * 0.3);
      this.breakLayer.addChild(view);
    }
  }

  clearBreaks(): void {
    this.breakLayer.removeChildren().forEach((c) => c.destroy({ children: true }));
  }

  private indexOf(x: number, y: number): number {
    return y * (this.board?.width ?? 0) + x;
  }

  private drawPips(index: number): void {
    this.pipViews.get(index)?.destroy({ children: true });
    this.pipViews.delete(index);
    if (!this.board || !this.board.cells[index]) return;

    const limit = this.limits[index];
    if (limit === 0 || limit === undefined) return; // 信号に反応しないパーツ（潤滑油タンクなど）
    const view = createPips(limit, this.remaining[index] ?? null);
    const { px, py } = cellCenter(index % this.board.width, Math.floor(index / this.board.width));
    view.position.set(px + CELL_SIZE * 0.42, py - CELL_SIZE * 0.42);
    this.pipLayer.addChild(view);
    this.pipViews.set(index, view);
  }
}

/** 途切れた理由ごとのマーカー色 */
const BREAK_COLORS: Record<VanishReason, number> = {
  outOfBoard: 0x90a4ae,
  emptyCell: 0xffb74d,
  exhausted: 0xef5350,
  blocked: 0xc62828,
  inert: 0x9575cd,
};

/** 残り発動回数のピップ（右上の角から下へ縦に並べる） */
function createPips(limit: number | null, remaining: number | null): Container {
  const view = new Container();
  if (limit === null) {
    view.addChild(pipText('∞'));
    return view;
  }
  if (limit > MAX_PIPS) {
    view.addChild(pipText(`${remaining ?? limit}/${limit}`));
    return view;
  }
  for (let i = 0; i < limit; i++) {
    const filled = i < (remaining ?? limit);
    const dot = new Graphics().circle(-4, 4 + i * 8, 3.3);
    if (filled) dot.fill(BOARD_THEME.pipFilled).stroke({ width: 1.5, color: 0x000000, alpha: 0.6 });
    else dot.stroke({ width: 1.5, color: BOARD_THEME.pipEmpty });
    view.addChild(dot);
  }
  return view;
}

function pipText(text: string): Text {
  const label = new Text({
    text,
    style: {
      fill: BOARD_THEME.pipFilled,
      fontSize: 11,
      fontWeight: 'bold',
      stroke: { color: 0x000000, width: 3 },
    },
  });
  label.anchor.set(1, 0);
  return label;
}

/** 途切れた理由のマーカー（小さな吹き出し） */
function createBreakMarker(text: string, color: number): Container {
  const view = new Container();
  const label = new Text({ text, style: { fill: 0xffffff, fontSize: 11, fontWeight: 'bold' } });
  label.anchor.set(0.5);
  const w = label.width + 10;
  view.addChild(
    new Graphics()
      .roundRect(-w / 2, -9, w, 18, 9)
      .fill(color)
      .stroke({ width: 1.5, color: 0x000000, alpha: 0.5 }),
    label,
  );
  return view;
}
