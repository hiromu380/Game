/**
 * PixiJS による盤面の描画と、シミュレーションイベントの再生演出
 *
 * - 盤面（マス・パーツ・選択枠）の描画
 * - events を tick ごとに再生: 信号の移動 / パーツの発光 / 出荷時の数字ポップ / リセットの波紋
 *
 * ゲームロジックはここでは一切計算しない。見た目はアセットマニフェスト経由で決める。
 */
import {
  rotateCcw,
  rotateCw,
  type Board,
  type Dir4,
  type Part,
  type Score,
  type SimEvent,
  type SimResult,
} from '@chain-factory/sim';
import { Application, Container, Graphics, Text } from 'pixi.js';
import { BOARD_THEME, PART_ASSETS, type ShapeKind } from '../assets/manifest';
import { PlaybackTimeline, type PlaybackSpeed } from '../playback/timeline';
import { formatCompact, formatScore } from '../ui/format';
import {
  BOARD_PIXEL_HEIGHT,
  BOARD_PIXEL_WIDTH,
  CELL_SIZE,
  cellCenter,
  pixelToCell,
} from './layout';
import { easeOutCubic, TweenManager } from './tweens';

/** 盤面上で強調表示するマス */
export interface BoardHighlight {
  x: number;
  y: number;
}

export interface PlaybackCallbacks {
  /** 出荷があるたびに累計を通知 */
  onShip: (total: Score) => void;
  /** 再生がすべて終わった */
  onFinish: () => void;
}

/** 1 tick のうち信号の移動にかける割合（残りで発光などの演出） */
const MOVE_RATIO = 0.55;

export class BoardRenderer {
  private readonly app: Application;
  private readonly cellLayer = new Container();
  private readonly partLayer = new Container();
  private readonly signalLayer = new Container();
  private readonly fxLayer = new Container();
  private readonly tweens = new TweenManager();

  /** マス index → パーツの表示オブジェクト（発光演出で使う） */
  private partViews = new Map<number, Container>();
  /** 信号 id → 表示オブジェクト */
  private signalViews = new Map<number, Container>();

  private board: Board | null = null;
  private timeline: PlaybackTimeline | null = null;
  private callbacks: PlaybackCallbacks | null = null;
  private speed: PlaybackSpeed = 1;

  private constructor(app: Application, onCellClick: (x: number, y: number) => void) {
    this.app = app;
    app.stage.addChild(this.cellLayer, this.partLayer, this.signalLayer, this.fxLayer);

    // クリックされたマスを通知
    app.stage.eventMode = 'static';
    app.stage.hitArea = app.screen;
    app.stage.on('pointertap', (e) => {
      if (!this.board) return;
      const cell = pixelToCell(e.global.x, e.global.y, this.board.width, this.board.height);
      if (cell) onCellClick(cell.x, cell.y);
    });

    app.ticker.add((ticker) => this.update(ticker.deltaMS));
  }

  /** PixiJS の初期化は非同期のため、生成はこの関数で行う */
  static async create(
    parent: HTMLElement,
    onCellClick: (x: number, y: number) => void,
  ): Promise<BoardRenderer> {
    const app = new Application();
    await app.init({
      width: BOARD_PIXEL_WIDTH,
      height: BOARD_PIXEL_HEIGHT,
      background: BOARD_THEME.background,
      antialias: true,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
    });
    app.canvas.classList.add('board-canvas');
    parent.appendChild(app.canvas);
    return new BoardRenderer(app, onCellClick);
  }

  destroy(): void {
    this.app.destroy(true, { children: true });
  }

  // ---------------------------------------------------------------------------
  // 盤面の描画
  // ---------------------------------------------------------------------------

  /** 盤面・選択中のマスを描き直す */
  setBoard(board: Board, highlight: BoardHighlight | null): void {
    this.board = board;
    this.cellLayer.removeChildren().forEach((c) => c.destroy());
    this.partLayer.removeChildren().forEach((c) => c.destroy({ children: true }));
    this.partViews.clear();

    for (let y = 0; y < board.height; y++) {
      for (let x = 0; x < board.width; x++) {
        const { px, py } = cellCenter(x, y);
        const isSelected = highlight?.x === x && highlight?.y === y;

        // マスの下地
        const cell = new Graphics()
          .roundRect(
            px - CELL_SIZE / 2 + 2,
            py - CELL_SIZE / 2 + 2,
            CELL_SIZE - 4,
            CELL_SIZE - 4,
            6,
          )
          .fill(BOARD_THEME.cell)
          .stroke({
            width: isSelected ? 3 : 1,
            color: isSelected ? BOARD_THEME.selected : BOARD_THEME.cellBorder,
          });
        this.cellLayer.addChild(cell);

        const part = board.cells[y * board.width + x];
        if (part) {
          const view = createPartView(part);
          view.position.set(px, py);
          this.partLayer.addChild(view);
          this.partViews.set(y * board.width + x, view);
        }
      }
    }
  }

  // ---------------------------------------------------------------------------
  // イベント再生
  // ---------------------------------------------------------------------------

  /** シミュレーション結果の再生を始める */
  play(result: SimResult, speed: PlaybackSpeed, callbacks: PlaybackCallbacks): void {
    this.clearPlayback();
    this.timeline = new PlaybackTimeline(result.events);
    this.callbacks = callbacks;
    this.speed = speed;
    if (speed === 'skip') this.skip();
  }

  setSpeed(speed: PlaybackSpeed): void {
    this.speed = speed;
    if (speed === 'skip') this.skip();
  }

  /** 残りの演出を飛ばして最終状態にする */
  skip(): void {
    if (!this.timeline) return;
    for (const tickEvents of this.timeline.flush()) this.applyTick(tickEvents, 0);
    this.tweens.finishAll();
    this.finishPlayback();
  }

  /** 再生中の信号・演出を消す */
  clearPlayback(): void {
    // 先に通知先を外してから残りの演出を片付ける（古い再生の通知を出さないため）
    this.timeline = null;
    this.callbacks = null;
    this.tweens.finishAll();
    this.signalLayer.removeChildren().forEach((c) => c.destroy({ children: true }));
    this.fxLayer.removeChildren().forEach((c) => c.destroy({ children: true }));
    this.signalViews.clear();
  }

  private update(deltaMs: number): void {
    if (this.timeline && this.speed !== 'skip') {
      const tickMs = PlaybackTimeline.tickMs(this.speed);
      for (const tickEvents of this.timeline.advance(deltaMs, this.speed)) {
        this.applyTick(tickEvents, tickMs);
      }
    }
    this.tweens.update(deltaMs);

    // 全 tick を再生し終え、演出も落ち着いたら終了を通知
    if (this.timeline?.isFinished && this.tweens.isIdle) this.finishPlayback();
  }

  private finishPlayback(): void {
    const callbacks = this.callbacks;
    this.timeline = null;
    this.callbacks = null;
    callbacks?.onFinish();
  }

  /** 1 tick 分のイベントを見た目に反映する。tickMs=0 なら即時 */
  private applyTick(events: SimEvent[], tickMs: number): void {
    const moveMs = tickMs * MOVE_RATIO;
    const fxMs = Math.max(tickMs, 1) * 1.2;

    for (const event of events) {
      switch (event.type) {
        case 'emit': {
          // 信号は発射元のマスに出現し、次の tick で移動を始める
          const view = createSignalView(event.value);
          const { px, py } = cellCenter(event.x, event.y);
          view.position.set(px, py);
          view.visible = false;
          this.signalLayer.addChild(view);
          this.signalViews.set(event.signalId, view);
          this.tweens.add({
            delay: event.tick === 0 ? 0 : moveMs,
            duration: 0,
            onStart: () => (view.visible = true),
          });
          break;
        }
        case 'move':
          this.moveSignal(event.signalId, event.x, event.y, moveMs);
          break;
        case 'vanish': {
          // 盤面外への移動は move イベントがないため、ここで外へ動かす
          if (event.reason === 'outOfBoard')
            this.moveSignal(event.signalId, event.x, event.y, moveMs);
          const view = this.signalViews.get(event.signalId);
          this.signalViews.delete(event.signalId);
          if (view) {
            this.tweens.add({
              delay: moveMs,
              duration: fxMs * 0.5,
              onUpdate: (t) => (view.alpha = 1 - t),
              onComplete: () => view.destroy({ children: true }),
            });
          }
          break;
        }
        case 'activate': {
          // 受けた信号はパーツに吸収される
          const view = this.signalViews.get(event.signalId);
          this.signalViews.delete(event.signalId);
          this.tweens.add({
            delay: moveMs,
            duration: 0,
            onComplete: () => {
              view?.destroy({ children: true });
              this.flashPart(event.x, event.y, fxMs);
            },
          });
          break;
        }
        case 'ship':
          this.tweens.add({
            delay: moveMs,
            duration: 0,
            onComplete: () => {
              this.popText(event.x, event.y, `+${formatScore(event.value)}`, fxMs * 2.5);
              this.callbacks?.onShip(event.total);
            },
          });
          break;
        case 'reset':
          this.tweens.add({
            delay: moveMs,
            duration: 0,
            onComplete: () => this.ripple(event.x, event.y, fxMs * 1.5),
          });
          break;
      }
    }
  }

  private moveSignal(signalId: number, x: number, y: number, durationMs: number): void {
    const view = this.signalViews.get(signalId);
    if (!view) return;
    const fromX = view.x;
    const fromY = view.y;
    const { px, py } = cellCenter(x, y);
    this.tweens.add({
      duration: durationMs,
      onUpdate: (t) => {
        const e = easeOutCubic(t);
        view.position.set(fromX + (px - fromX) * e, fromY + (py - fromY) * e);
      },
    });
  }

  /** パーツを一瞬光らせる */
  private flashPart(x: number, y: number, durationMs: number): void {
    const { px, py } = cellCenter(x, y);
    const glow = new Graphics()
      .roundRect(-CELL_SIZE / 2 + 2, -CELL_SIZE / 2 + 2, CELL_SIZE - 4, CELL_SIZE - 4, 8)
      .fill({ color: BOARD_THEME.glow, alpha: 0.7 });
    glow.position.set(px, py);
    this.fxLayer.addChild(glow);

    const part = this.board ? this.partViews.get(y * this.board.width + x) : undefined;
    this.tweens.add({
      duration: durationMs,
      onUpdate: (t) => {
        glow.alpha = 1 - t;
        part?.scale.set(1 + 0.18 * (1 - t));
      },
      onComplete: () => {
        glow.destroy();
        part?.scale.set(1);
      },
    });
  }

  /** 出荷量などの数字を浮かび上がらせる */
  private popText(x: number, y: number, text: string, durationMs: number): void {
    const { px, py } = cellCenter(x, y);
    const label = new Text({
      text,
      style: {
        fill: BOARD_THEME.shipText,
        fontSize: 22,
        fontWeight: 'bold',
        stroke: { color: BOARD_THEME.background, width: 4 },
      },
    });
    label.anchor.set(0.5);
    label.position.set(px, py - 10);
    this.fxLayer.addChild(label);
    this.tweens.add({
      duration: durationMs,
      onUpdate: (t) => {
        label.y = py - 10 - 36 * easeOutCubic(t);
        label.alpha = t < 0.6 ? 1 : 1 - (t - 0.6) / 0.4;
      },
      onComplete: () => label.destroy(),
    });
  }

  /** 発動回数リセットの波紋 */
  private ripple(x: number, y: number, durationMs: number): void {
    const { px, py } = cellCenter(x, y);
    const ring = new Graphics()
      .circle(0, 0, CELL_SIZE / 2)
      .stroke({ width: 4, color: BOARD_THEME.reset });
    ring.position.set(px, py);
    this.fxLayer.addChild(ring);
    this.tweens.add({
      duration: durationMs,
      onUpdate: (t) => {
        ring.scale.set(0.4 + 0.8 * t);
        ring.alpha = 1 - t;
      },
      onComplete: () => ring.destroy(),
    });
  }
}

// -----------------------------------------------------------------------------
// 表示オブジェクトの生成
// -----------------------------------------------------------------------------

/** パーツの出力方向（矢印の表示用）。方向を持たないパーツは空 */
function outputDirs(part: Part): Dir4[] {
  switch (part.id) {
    case 'splitter':
      return [rotateCcw(part.dir), rotateCw(part.dir)];
    case 'barrel':
    case 'junkbot':
    case 'dock':
      return [];
    default:
      return [part.dir];
  }
}

/** アセットマニフェストに従ってパーツを描く（中心が原点） */
function createPartView(part: Part): Container {
  const view = new Container();
  const asset = PART_ASSETS[part.id];
  const size = CELL_SIZE * 0.66;

  if (asset.kind === 'shape') {
    view.addChild(drawShape(asset.shape, size, asset.color));
    const glyph = new Text({
      text: asset.glyph,
      style: { fill: BOARD_THEME.glyph, fontSize: 24, fontWeight: 'bold' },
    });
    glyph.anchor.set(0.5);
    view.addChild(glyph);
  }
  // kind: 'image' は本番素材の導入時に Sprite で描画する（フェーズ2以降）

  // 出力方向の矢印
  for (const dir of outputDirs(part)) {
    const arrow = new Graphics().poly([0, -6, 7, 5, -7, 5]).fill(BOARD_THEME.arrow);
    const offset = CELL_SIZE * 0.4;
    const angle = (dir * Math.PI) / 2;
    arrow.position.set(Math.sin(angle) * offset, -Math.cos(angle) * offset);
    arrow.rotation = angle;
    view.addChild(arrow);
  }
  return view;
}

function drawShape(shape: ShapeKind, size: number, color: number): Graphics {
  const r = size / 2;
  const g = new Graphics();
  switch (shape) {
    case 'square':
      g.roundRect(-r, -r, size, size, 8);
      break;
    case 'circle':
      g.circle(0, 0, r);
      break;
    case 'diamond':
      g.poly([0, -r * 1.1, r * 1.1, 0, 0, r * 1.1, -r * 1.1, 0]);
      break;
    case 'hexagon': {
      const points: number[] = [];
      for (let i = 0; i < 6; i++) {
        const a = (Math.PI / 3) * i + Math.PI / 6;
        points.push(Math.cos(a) * r, Math.sin(a) * r);
      }
      g.poly(points);
      break;
    }
  }
  return g.fill(color).stroke({ width: 2, color: 0x000000, alpha: 0.35 });
}

/** 信号（値つきの丸） */
function createSignalView(value: Score): Container {
  const view = new Container();
  view.addChild(
    new Graphics()
      .circle(0, 0, 15)
      .fill(BOARD_THEME.signal)
      .stroke({ width: 2, color: 0x000000, alpha: 0.4 }),
  );
  const label = new Text({
    text: formatCompact(value),
    style: { fill: BOARD_THEME.signalText, fontSize: 13, fontWeight: 'bold' },
  });
  label.anchor.set(0.5);
  view.addChild(label);
  return view;
}
