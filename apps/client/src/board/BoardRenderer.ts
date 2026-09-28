/**
 * PixiJS による盤面の描画と、シミュレーションイベントの再生演出
 *
 * - 盤面（床・パーツ・倍率バッジ・選択枠）の描画
 * - マウスを乗せたマスの名前表示と、配置前のプレビュー（ゴースト）
 * - events を tick ごとに再生: 信号の移動 / パーツの発光 / 火花 / 出荷時の数字ポップ / 揺れ
 *
 * ゲームロジックはここでは一切計算しない。見た目はアセットマニフェスト経由で決める。
 */
import {
  getPart,
  getPressMultiplier,
  type Board,
  type Dir4,
  type Part,
  type PartId,
  type RuleSet,
  type Score,
  type SimEvent,
  type SimResult,
} from '@chain-factory/sim';
import { Application, Container, Graphics, Text } from 'pixi.js';
import { BOARD_THEME, PART_ASSETS } from '../assets/manifest';
import { PlaybackTimeline, type PlaybackSpeed } from '../playback/timeline';
import { formatScore } from '../ui/format';
import {
  BOARD_PIXEL_HEIGHT,
  BOARD_PIXEL_WIDTH,
  CELL_SIZE,
  cellCenter,
  pixelToCell,
} from './layout';
import { loadPartTextures, type PartTextures } from './textures';
import { easeOutCubic, TweenManager } from './tweens';
import {
  createFloor,
  createPartView,
  createSignalView,
  PART_DISPLAY_SIZE,
  valueTier,
} from './views';

/** 盤面の表示状態（React 側から渡される） */
export interface BoardViewState {
  board: Board;
  /** 現在のシフトのルール（倍率バッジなどの表示に使う。ボス修正込み） */
  rules: RuleSet;
  /** 選択中のマス */
  highlight: { x: number; y: number } | null;
  /** 配置しようとしている手持ちパーツ（マウスを乗せたマスにプレビューを出す） */
  placing: { partId: PartId; dir: Dir4 } | null;
}

export interface BoardRendererOptions {
  onCellClick: (x: number, y: number) => void;
  /** パーツの表示名（ホバー時のラベル用。言語切り替えに追従するよう関数で受け取る） */
  getPartName: (partId: PartId) => string;
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
  private readonly textures: PartTextures;
  private readonly options: BoardRendererOptions;

  /** 揺れ演出のために、盤面全体をこのコンテナに入れる */
  private readonly root = new Container();
  private readonly floorLayer = new Container();
  private readonly partLayer = new Container();
  private readonly overlayLayer = new Container();
  private readonly signalLayer = new Container();
  private readonly fxLayer = new Container();
  private readonly tooltipLayer = new Container();
  private readonly tweens = new TweenManager();

  /** マス index → パーツの表示オブジェクト（発光演出で使う） */
  private partViews = new Map<number, Container>();
  /** 信号 id → 表示オブジェクト */
  private signalViews = new Map<number, Container>();

  private state: BoardViewState | null = null;
  private hovered: { x: number; y: number } | null = null;
  private timeline: PlaybackTimeline | null = null;
  private callbacks: PlaybackCallbacks | null = null;
  private speed: PlaybackSpeed = 1;
  /** 揺れの残り強さ（px） */
  private shake = 0;

  private constructor(app: Application, textures: PartTextures, options: BoardRendererOptions) {
    this.app = app;
    this.textures = textures;
    this.options = options;

    this.root.addChild(
      this.floorLayer,
      this.partLayer,
      this.overlayLayer,
      this.signalLayer,
      this.fxLayer,
      this.tooltipLayer,
    );
    app.stage.addChild(this.root);

    // マウス・タッチ操作
    app.stage.eventMode = 'static';
    app.stage.hitArea = app.screen;
    app.stage.on('pointertap', (e) => {
      const cell = this.toCell(e.global.x, e.global.y);
      if (cell) options.onCellClick(cell.x, cell.y);
    });
    app.stage.on('pointermove', (e) => this.setHovered(this.toCell(e.global.x, e.global.y)));
    app.stage.on('pointerleave', () => this.setHovered(null));

    app.ticker.add((ticker) => this.update(ticker.deltaMS));
  }

  /** PixiJS の初期化と画像の読み込みは非同期のため、生成はこの関数で行う */
  static async create(parent: HTMLElement, options: BoardRendererOptions): Promise<BoardRenderer> {
    const app = new Application();
    const [, textures] = await Promise.all([
      app.init({
        width: BOARD_PIXEL_WIDTH,
        height: BOARD_PIXEL_HEIGHT,
        backgroundAlpha: 0,
        antialias: true,
        resolution: window.devicePixelRatio || 1,
        autoDensity: true,
      }),
      loadPartTextures(PART_DISPLAY_SIZE),
    ]);
    app.canvas.classList.add('board-canvas');
    parent.appendChild(app.canvas);
    return new BoardRenderer(app, textures, options);
  }

  destroy(): void {
    this.app.destroy(true, { children: true });
  }

  private toCell(px: number, py: number) {
    if (!this.state) return null;
    return pixelToCell(px, py, this.state.board.width, this.state.board.height);
  }

  // ---------------------------------------------------------------------------
  // 盤面の描画
  // ---------------------------------------------------------------------------

  /** 盤面・選択状態を描き直す */
  setState(state: BoardViewState): void {
    const sizeChanged =
      this.state?.board.width !== state.board.width ||
      this.state?.board.height !== state.board.height;
    this.state = state;

    if (sizeChanged) {
      this.floorLayer.removeChildren().forEach((c) => c.destroy({ children: true }));
      this.floorLayer.addChild(createFloor(state.board.width, state.board.height));
    }

    this.partLayer.removeChildren().forEach((c) => c.destroy({ children: true }));
    this.partViews.clear();
    const { board } = state;
    for (let y = 0; y < board.height; y++) {
      for (let x = 0; x < board.width; x++) {
        const part = getPart(board, x, y);
        if (!part) continue;
        const view = createPartView(part, this.textures, this.multiplierOf(part, x, y));
        const { px, py } = cellCenter(x, y);
        view.position.set(px, py);
        this.partLayer.addChild(view);
        this.partViews.set(y * board.width + x, view);
      }
    }
    this.drawOverlay();
  }

  /** ギア・プレス機の倍率（バッジ表示用。計算は sim の関数と、ランが持つルールに任せる） */
  private multiplierOf(part: Part, x: number, y: number): number | null {
    if (!this.state) return null;
    if (part.id === 'gear') return this.state.rules.params.gearMultiplier;
    if (part.id === 'press') return getPressMultiplier(this.state.board, x, y, this.state.rules);
    return null;
  }

  private setHovered(cell: { x: number; y: number } | null): void {
    if (this.hovered?.x === cell?.x && this.hovered?.y === cell?.y) return;
    this.hovered = cell;
    this.drawOverlay();
  }

  /** 選択枠・ホバー枠・配置プレビュー・名前ラベルを描く */
  private drawOverlay(): void {
    this.overlayLayer.removeChildren().forEach((c) => c.destroy({ children: true }));
    this.tooltipLayer.removeChildren().forEach((c) => c.destroy({ children: true }));
    if (!this.state) return;
    const { board, highlight, placing } = this.state;

    if (highlight)
      this.overlayLayer.addChild(cellFrame(highlight.x, highlight.y, BOARD_THEME.selected, 4));

    // 再生中はホバー表示を出さない（演出を見やすくするため）
    const hovered = this.timeline ? null : this.hovered;
    if (!hovered) return;
    const part = getPart(board, hovered.x, hovered.y);

    if (placing && !part) {
      // 配置プレビュー: 半透明のパーツと緑の枠
      const ghostPart: Part = { id: placing.partId, dir: placing.dir };
      const ghost = createPartView(ghostPart, this.textures, null);
      const { px, py } = cellCenter(hovered.x, hovered.y);
      ghost.position.set(px, py);
      ghost.alpha = 0.55;
      this.overlayLayer.addChild(cellFrame(hovered.x, hovered.y, BOARD_THEME.ghostOk, 3), ghost);
      this.showTooltip(hovered.x, hovered.y, this.options.getPartName(placing.partId));
      return;
    }
    if (part) {
      this.overlayLayer.addChild(cellFrame(hovered.x, hovered.y, 0xffffff, 2));
      this.showTooltip(hovered.x, hovered.y, this.options.getPartName(part.id));
    }
  }

  /** マスの上にパーツ名のラベルを出す */
  private showTooltip(x: number, y: number, text: string): void {
    const label = new Text({
      text,
      style: { fill: BOARD_THEME.tooltipText, fontSize: 14, fontWeight: 'bold' },
    });
    label.anchor.set(0.5);
    const w = label.width + 16;
    const h = 24;
    const { px, py } = cellCenter(x, y);
    // 最上段では下に出す
    const top = y === 0 ? py + CELL_SIZE / 2 + 4 : py - CELL_SIZE / 2 - h - 4;
    const left = Math.min(Math.max(px - w / 2, 2), BOARD_PIXEL_WIDTH - w - 2);
    const bg = new Graphics()
      .roundRect(left, top, w, h, 6)
      .fill({ color: BOARD_THEME.tooltipBg, alpha: 0.9 });
    label.position.set(left + w / 2, top + h / 2);
    this.tooltipLayer.addChild(bg, label);
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
    this.drawOverlay();
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
    this.shake = 0;
    this.finishPlayback();
  }

  /** 再生中の信号・演出を消す */
  clearPlayback(): void {
    // 先に通知先を外してから残りの演出を片付ける（古い再生の通知を出さないため）
    this.timeline = null;
    this.callbacks = null;
    this.tweens.finishAll();
    this.shake = 0;
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

    // 揺れ: ランダムにずらしながら減衰させる（演出のみ。シミュレーションとは無関係）
    if (this.shake > 0.1) {
      this.root.position.set(
        (Math.random() - 0.5) * this.shake,
        (Math.random() - 0.5) * this.shake,
      );
      this.shake *= 0.86;
    } else if (this.shake !== 0) {
      this.shake = 0;
      this.root.position.set(0, 0);
    }

    // 全 tick を再生し終え、演出も落ち着いたら終了を通知
    if (this.timeline?.isFinished && this.tweens.isIdle) this.finishPlayback();
  }

  private finishPlayback(): void {
    const callbacks = this.callbacks;
    this.timeline = null;
    this.callbacks = null;
    this.drawOverlay();
    callbacks?.onFinish();
  }

  /** 1 tick 分のイベントを見た目に反映する。tickMs=0 なら即時 */
  private applyTick(events: SimEvent[], tickMs: number): void {
    const moveMs = tickMs * MOVE_RATIO;
    const fxMs = Math.max(tickMs, 1) * 1.2;
    const instant = tickMs === 0;

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
            duration: fxMs * 0.4,
            onStart: () => (view.visible = true),
            // ポンと出てくる
            onUpdate: (t) => view.scale.set(0.4 + 0.6 * easeOutCubic(t)),
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
              onUpdate: (t) => {
                view.alpha = 1 - t;
                view.scale.set(1 - 0.5 * t);
              },
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
              if (instant) return;
              this.flashPart(event.x, event.y, event.partId, fxMs);
              if (event.partId === 'barrel') {
                this.sparks(event.x, event.y, PART_ASSETS.barrel.color, 16, fxMs * 2);
                this.shake = Math.max(this.shake, 10);
              }
            },
          });
          break;
        }
        case 'ship':
          this.tweens.add({
            delay: moveMs,
            duration: 0,
            onComplete: () => {
              this.callbacks?.onShip(event.total);
              if (instant) return;
              const tier = valueTier(event.value);
              this.popText(event.x, event.y, `+${formatScore(event.value)}`, tier, fxMs * 2.5);
              this.sparks(event.x, event.y, BOARD_THEME.shipText, 8 + tier * 3, fxMs * 1.5);
              if (tier >= 2) this.shake = Math.max(this.shake, 3 + tier * 2);
            },
          });
          break;
        case 'reset':
          this.tweens.add({
            delay: moveMs,
            duration: 0,
            onComplete: () => !instant && this.ripple(event.x, event.y, fxMs * 1.5),
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

  /** パーツをテーマ色で光らせ、弾ませる */
  private flashPart(x: number, y: number, partId: PartId, durationMs: number): void {
    const { px, py } = cellCenter(x, y);
    const glow = new Graphics()
      .circle(0, 0, CELL_SIZE * 0.55)
      .fill({ color: PART_ASSETS[partId].color, alpha: 0.55 });
    glow.position.set(px, py);
    this.fxLayer.addChild(glow);

    const part = this.state ? this.partViews.get(y * this.state.board.width + x) : undefined;
    this.tweens.add({
      duration: durationMs,
      onUpdate: (t) => {
        glow.alpha = 1 - t;
        glow.scale.set(0.6 + 0.6 * t);
        part?.scale.set(1 + 0.25 * (1 - t));
      },
      onComplete: () => {
        glow.destroy();
        part?.scale.set(1);
      },
    });
  }

  /** 火花（小さな粒が放射状に飛び散る） */
  private sparks(x: number, y: number, color: number, count: number, durationMs: number): void {
    const { px, py } = cellCenter(x, y);
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + Math.random() * 0.4;
      const distance = CELL_SIZE * (0.5 + Math.random() * 0.6);
      const dot = new Graphics().circle(0, 0, 2.5 + Math.random() * 2.5).fill(color);
      dot.position.set(px, py);
      this.fxLayer.addChild(dot);
      this.tweens.add({
        duration: durationMs,
        onUpdate: (t) => {
          const e = easeOutCubic(t);
          dot.position.set(
            px + Math.cos(angle) * distance * e,
            py + Math.sin(angle) * distance * e,
          );
          dot.alpha = 1 - t;
        },
        onComplete: () => dot.destroy(),
      });
    }
  }

  /** 出荷量の数字を浮かび上がらせる（値が大きいほど大きく） */
  private popText(x: number, y: number, text: string, tier: number, durationMs: number): void {
    const { px, py } = cellCenter(x, y);
    const label = new Text({
      text,
      style: {
        fill: BOARD_THEME.shipText,
        fontSize: 20 + tier * 5,
        fontWeight: '900',
        stroke: { color: BOARD_THEME.background, width: 5 },
      },
    });
    label.anchor.set(0.5);
    label.position.set(px, py - 10);
    this.fxLayer.addChild(label);
    this.tweens.add({
      duration: durationMs,
      onUpdate: (t) => {
        label.y = py - 10 - 40 * easeOutCubic(t);
        label.scale.set(t < 0.15 ? 0.5 + (t / 0.15) * 0.7 : 1.2 - Math.min(0.2, (t - 0.15) * 0.5));
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

/** マスを囲む枠 */
function cellFrame(x: number, y: number, color: number, width: number): Graphics {
  const { px, py } = cellCenter(x, y);
  const half = CELL_SIZE / 2 - 3;
  return new Graphics()
    .roundRect(px - half, py - half, half * 2, half * 2, 8)
    .stroke({ width, color });
}
