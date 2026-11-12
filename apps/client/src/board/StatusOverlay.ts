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
import { Container, Graphics, GraphicsContext, Text } from 'pixi.js';
import { BOARD_THEME } from '../assets/manifest';
import type { BreakSummary } from '../playback/breaks';
import type { TraceSegment } from '../playback/trace';
import { EFFECTS_CONFIG } from '../config/effects';
import { CELL_SIZE, cellCenter } from './layout';
import { FX_COLORS, hex, VANISH_COLORS } from '../assets/palette';

/** ピップを並べる最大数（これを超える上限は数字で表示）。向きの矢印と重ならない数にしている */
const MAX_PIPS = 3;

/** 1マス分のピップの表示（発動のたびに作り直さず、中身だけ書き換える） */
interface PipView {
  view: Container;
  /** この表示を作ったときの上限（変わったら作り直す） */
  limit: number | null;
  /** ●○ の並び（上限が MAX_PIPS 以下のとき） */
  dots: Graphics[];
  /** 「2/5」の数字（上限が MAX_PIPS を超えるとき） */
  text: Text | null;
}

export class StatusOverlay {
  readonly pipLayer = new Container();
  readonly breakLayer = new Container();
  /** 再生後に残す「信号が通った道すじ」（パーツの上・ピップの下に薄く描く） */
  readonly traceLayer = new Graphics();

  private board: Board | null = null;
  private rules: RuleSet | null = null;
  /** rules を文字列にしたもの（参照が変わったときだけ、中身が同じかを比べるのに使う） */
  private rulesKey: string | null = null;
  private limits: (number | null)[] = [];
  private remaining: (number | null)[] = [];
  /** マス index → ピップの表示（部分的に書き換えるため） */
  private pipViews = new Map<number, PipView>();
  /** ピップの形（●=残り ○=使用済み）。全部のマスで共有する */
  private readonly dotFilled = new GraphicsContext()
    .circle(0, 0, 3.3)
    .fill(BOARD_THEME.pipFilled)
    .stroke({ width: 1.5, color: 0x000000, alpha: 0.6 });
  private readonly dotEmpty = new GraphicsContext()
    .circle(0, 0, 3.3)
    .stroke({ width: 1.5, color: BOARD_THEME.pipEmpty });

  constructor(private readonly getBreakLabel: (reason: VanishReason) => string) {}

  /** 盤面が変わったら上限を計算し直してピップを描く。盤面自体が変わったら途切れ表示を消す */
  setBoard(board: Board, rules: RuleSet): void {
    // 盤面もルールも変わっていなければ何もしない（再生後の残り回数表示を保つため）。
    // ルールは参照が同じならそのまま、違うときだけ中身を比べる
    if (board === this.board) {
      if (rules === this.rules) return;
      this.rulesKey ??= JSON.stringify(this.rules);
      const key = JSON.stringify(rules);
      if (key === this.rulesKey) {
        this.rules = rules;
        return;
      }
      this.rulesKey = key;
    } else {
      this.clearBreaks();
      this.rulesKey = null;
    }
    this.board = board;
    this.rules = rules;
    this.limits = computeActivationLimits(board, rules);
    this.rebuildPips();
  }

  /** 残り発動回数を満タンに戻す（再生開始時・再生終了後）。減っていたマスだけ書き換える */
  resetPips(): void {
    for (let index = 0; index < this.limits.length; index++) {
      const limit = this.limits[index] ?? null;
      if (this.remaining[index] === limit) continue;
      this.remaining[index] = limit;
      this.drawPips(index);
    }
  }

  /** 盤面・上限が変わったときに、ピップをすべて作り直す */
  private rebuildPips(): void {
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

  /**
   * 信号が通った道すじを残す（途切れた場所と同じく、盤面を変えるか次の再生まで出しておく）。
   * 線は通った本数が多いほど太く、真ん中の矢じりで向きを示す
   */
  showTrace(segments: TraceSegment[]): void {
    const c = EFFECTS_CONFIG.trace;
    const g = this.traceLayer.clear();
    const color = hex(FX_COLORS.trace);
    for (const s of segments) {
      const from = cellCenter(s.fromX, s.fromY);
      const end = cellCenter(s.toX, s.toY);
      // 盤面の外へ出た信号は、マスの境目あたりまでで止める
      const outside =
        !this.board ||
        s.toX < 0 ||
        s.toY < 0 ||
        s.toX >= this.board.width ||
        s.toY >= this.board.height;
      const reach = outside ? 0.55 : 1;
      const toX = from.px + (end.px - from.px) * reach;
      const toY = from.py + (end.py - from.py) * reach;
      const width = Math.min(c.maxWidth, c.baseWidth + (s.count - 1) * c.widthPerSignal);
      g.moveTo(from.px, from.py).lineTo(toX, toY).stroke({ width, color, cap: 'round' });
      // 矢じり（区間の真ん中に、進む向きの三角）
      const length = Math.hypot(toX - from.px, toY - from.py) || 1;
      const ux = (toX - from.px) / length;
      const uy = (toY - from.py) / length;
      const mx = (from.px + toX) / 2;
      const my = (from.py + toY) / 2;
      const a = c.arrowSize + width / 2;
      g.poly([
        mx + ux * a,
        my + uy * a,
        mx - ux * a * 0.6 - uy * a * 0.8,
        my - uy * a * 0.6 + ux * a * 0.8,
        mx - ux * a * 0.6 + uy * a * 0.8,
        my - uy * a * 0.6 - ux * a * 0.8,
      ]).fill(color);
    }
    this.traceLayer.alpha = c.alpha;
  }

  clearBreaks(): void {
    this.traceLayer.clear();
    this.breakLayer.removeChildren().forEach((c) => c.destroy({ children: true }));
  }

  private indexOf(x: number, y: number): number {
    return y * (this.board?.width ?? 0) + x;
  }

  /** index のマスのピップを、今の残り回数に合わせる（表示があれば中身だけ書き換える） */
  private drawPips(index: number): void {
    if (!this.board) return;
    const part = this.board.cells[index];
    if (!part || part.id === 'switch') return;
    const limit = this.limits[index];
    if (limit === 0 || limit === undefined) return; // 信号に反応しないパーツ（潤滑油タンクなど）
    const remaining = this.remaining[index] ?? null;

    let pips = this.pipViews.get(index);
    if (!pips) {
      pips = this.createPips(limit);
      const { px, py } = cellCenter(index % this.board.width, Math.floor(index / this.board.width));
      pips.view.position.set(px + CELL_SIZE * 0.42, py - CELL_SIZE * 0.42);
      this.pipLayer.addChild(pips.view);
      this.pipViews.set(index, pips);
    }
    if (limit === null) return; // ∞ は変わらない
    if (pips.text) {
      const text = `${remaining ?? limit}/${limit}`;
      if (pips.text.text !== text) pips.text.text = text;
      return;
    }
    pips.dots.forEach((dot, i) => {
      const context = i < (remaining ?? limit) ? this.dotFilled : this.dotEmpty;
      if (dot.context !== context) dot.context = context;
    });
  }

  /** 残り発動回数のピップ（右上の角から下へ縦に並べる）。中身は drawPips で入れる */
  private createPips(limit: number | null): PipView {
    const view = new Container();
    const pips: PipView = { view, limit, dots: [], text: null };
    if (limit === null) {
      view.addChild(pipText('∞'));
    } else if (limit > MAX_PIPS) {
      pips.text = pipText('');
      view.addChild(pips.text);
    } else {
      for (let i = 0; i < limit; i++) {
        const dot = new Graphics(this.dotFilled);
        dot.position.set(-4, 4 + i * 8);
        pips.dots.push(dot);
        view.addChild(dot);
      }
    }
    return pips;
  }

  /** 共有している形を捨てる（盤面の表示を片付けるとき） */
  destroy(): void {
    this.dotFilled.destroy();
    this.dotEmpty.destroy();
  }
}

/** 途切れた理由ごとのマーカー色 */
const BREAK_COLORS: Record<VanishReason, number> = {
  outOfBoard: hex(VANISH_COLORS.outOfBoard),
  emptyCell: hex(VANISH_COLORS.emptyCell),
  exhausted: hex(VANISH_COLORS.exhausted),
  blocked: hex(VANISH_COLORS.blocked),
  inert: hex(VANISH_COLORS.inert),
};

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
