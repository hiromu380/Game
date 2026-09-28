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
  getPartBadge,
  type Board,
  type Dir4,
  type Part,
  type PartBadge,
  type PartId,
  type RuleSet,
  type Score,
  type SimEvent,
  type SimResult,
  type VanishReason,
} from '@chain-factory/sim';
import { Application, Container, Graphics, Text, type FederatedPointerEvent } from 'pixi.js';
// CSP で eval を禁止している（apps/client/public/_headers）ため、PixiJS に eval を使わない
// シェーダー処理を読み込ませる。これがないと本番配信で盤面が描けない
import 'pixi.js/unsafe-eval';
import { TextStyle } from 'pixi.js';
import { FONT_STACK } from '../config/fonts';

// 盤面の文字も画面と同じ同梱フォントで描く（指定しないと端末任せになり、中国語用の字形になることがある）
TextStyle.defaultTextStyle.fontFamily = FONT_STACK;
import { BOARD_THEME } from '../assets/manifest';
import { PlaybackTimeline, type PlaybackSpeed } from '../playback/timeline';
import {
  boardPixelSize,
  INITIAL_BOARD_PIXEL_SIZE,
  CELL_SIZE,
  cellCenter,
  pixelToCell,
} from './layout';
import { summarizeBreaks } from '../playback/breaks';
import { chainSemitones, type SoundKey } from '../audio/manifest';
import { INPUT_CONFIG } from '../config/input';
import { EffectsLayer, type EffectSettings } from './fx/EffectsLayer';
import { StatusOverlay } from './StatusOverlay';
import {
  loadBoardTextures,
  loadPartTextures,
  type BoardTextures,
  type PartTextures,
} from './textures';
import { easeOutCubic, TweenManager } from './tweens';
import {
  createBlockedCell,
  createFloor,
  createPartView,
  createSignalView,
  PART_DISPLAY_SIZE,
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
  /** 今日の夜シフト（ボス）に使用不可になるマス（予告表示用） */
  upcomingBlocked: number[];
  /** どのランのどのシフトか（変わったら前の本番の表示を消す） */
  shiftKey: string;
  /** 初回ガイドで「ここに置く」マス（なければ null） */
  guideCell: { x: number; y: number } | null;
}

/** 盤面に表示する文言（i18n を通すため関数で受け取る。言語切り替えに追従する） */
export interface BoardLabels {
  /** パーツの表示名（ホバー時のラベル） */
  getPartName: (partId: PartId) => string;
  /** 収入のポップアップ（例: +1円） */
  formatIncome: (amount: number) => string;
  /** 途切れた理由の短い表示名 */
  getBreakLabel: (reason: VanishReason) => string;
  /** 連鎖数カウンター（例: 12 連鎖） */
  formatChain: (count: number) => string;
  /** 大出荷カットインの見出し */
  getCutInTitle: () => string;
  /** スコアの表記（通常 / 短い） */
  formatScore: (value: Score) => string;
  formatCompact: (value: Score) => string;
}

export interface BoardRendererOptions extends BoardLabels {
  onCellClick: (x: number, y: number) => void;
  /** 長押し（スマホで「手持ちに戻す」に使う） */
  onCellLongPress: (x: number, y: number) => void;
  /** 置いたパーツのドラッグを始めた（画面側で指についてくる絵と、手持ちの落とし先を出す） */
  onCellDragStart: (from: { x: number; y: number }, partId: PartId) => void;
  /**
   * ドラッグを終えた。target は盤面のマス（盤面の外なら null）、client は画面上の位置
   * （盤面の外で離したとき、手持ちの一覧の上かどうかを画面側で判定する）
   */
  onCellDragEnd: (
    from: { x: number; y: number },
    target: { x: number; y: number } | null,
    client: { x: number; y: number },
  ) => void;
  /** 効果音を鳴らす（semitones: 上げる音程。連鎖が続くほど高くする） */
  playSound: (key: SoundKey, semitones: number) => void;
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
  private readonly boardTextures: BoardTextures;
  private readonly options: BoardRendererOptions;

  /** 揺れ演出のために、盤面全体をこのコンテナに入れる */
  private readonly root = new Container();
  private readonly floorLayer = new Container();
  /** 使用不可マス（補修工事）と、その予告 */
  private readonly blockLayer = new Container();
  private readonly partLayer = new Container();
  private readonly overlayLayer = new Container();
  /** 残り発動回数と、途切れた理由の表示 */
  private readonly status: StatusOverlay;
  private readonly signalLayer = new Container();
  /** 再生中の演出（発光・パーティクル・揺れ・スロー・連鎖カウンター・カットイン） */
  private readonly effects: EffectsLayer;
  private readonly tooltipLayer = new Container();
  private readonly tweens = new TweenManager();

  /** マス index → パーツの表示オブジェクト（発光演出で使う） */
  private partViews = new Map<number, Container>();
  /** 信号 id → 表示オブジェクト */
  private signalViews = new Map<number, Container>();

  private state: BoardViewState | null = null;
  private hovered: { x: number; y: number } | null = null;
  private cursor: { x: number; y: number } | null = null;
  /** ドラッグ中の状態（pointer は、しきい値を超えて動かし始めてからの指・マウスの位置） */
  private drag: {
    from: { x: number; y: number };
    startX: number;
    startY: number;
    pointer: { x: number; y: number } | null;
  } | null = null;
  private timeline: PlaybackTimeline | null = null;
  /** 直近に再生した結果（再生後の「途切れた理由」表示に使う） */
  private lastResult: SimResult | null = null;
  private callbacks: PlaybackCallbacks | null = null;
  private speed: PlaybackSpeed = 1;

  private constructor(
    app: Application,
    textures: PartTextures,
    boardTextures: BoardTextures,
    options: BoardRendererOptions,
  ) {
    this.app = app;
    this.textures = textures;
    this.boardTextures = boardTextures;
    this.options = options;
    this.status = new StatusOverlay(options.getBreakLabel);
    this.effects = new EffectsLayer(
      this.tweens,
      textures.junkbot,
      {
        chain: options.formatChain,
        cutInTitle: options.getCutInTitle,
        income: options.formatIncome,
        score: options.formatScore,
      },
      (x, y) => (this.state ? this.partViews.get(y * this.state.board.width + x) : undefined),
      () => ({ width: this.app.screen.width, height: this.app.screen.height }),
    );

    this.root.addChild(
      this.floorLayer,
      this.blockLayer,
      this.partLayer,
      this.status.pipLayer,
      this.overlayLayer,
      this.signalLayer,
      this.effects.boardLayer,
      this.status.breakLayer,
      this.tooltipLayer,
    );
    app.stage.addChild(this.root, this.effects.screenLayer);

    // マウス・タッチ操作
    app.stage.eventMode = 'static';
    app.stage.hitArea = app.screen;
    // 長押しの判定: 押してから一定時間離さなければ長押し。そのときは直後のタップを無視する
    let pressTimer: ReturnType<typeof setTimeout> | null = null;
    /** 長押し・ドラッグをしたら、そのあとのタップ（クリック）を無視する */
    let longPressed = false;
    const cancelPress = () => {
      if (pressTimer) clearTimeout(pressTimer);
      pressTimer = null;
    };
    app.stage.on('pointerdown', (e) => {
      longPressed = false;
      cancelPress();
      const cell = this.toCell(e.global.x, e.global.y);
      if (!cell) return;
      // 置いたパーツの上で押したら、ドラッグの候補にする（再生中は動かせない）
      if (!this.timeline && this.state && getPart(this.state.board, cell.x, cell.y)) {
        this.drag = { from: cell, startX: e.global.x, startY: e.global.y, pointer: null };
      }
      pressTimer = setTimeout(() => {
        longPressed = true;
        options.onCellLongPress(cell.x, cell.y);
      }, INPUT_CONFIG.longPressMs);
    });
    const endDrag = (e: FederatedPointerEvent) => {
      cancelPress();
      const drag = this.drag;
      this.drag = null;
      if (!drag?.pointer) return;
      options.onCellDragEnd(drag.from, this.toCell(e.global.x, e.global.y), {
        x: e.clientX,
        y: e.clientY,
      });
      this.hovered = null;
      this.drawOverlay();
    };
    app.stage.on('pointerup', endDrag);
    app.stage.on('pointerupoutside', endDrag);
    app.stage.on('pointertap', (e) => {
      if (longPressed) return;
      const cell = this.toCell(e.global.x, e.global.y);
      if (cell) options.onCellClick(cell.x, cell.y);
    });
    // スマホの長押しで出るメニューを出さない
    app.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    // ドラッグは盤面の外まで追いかける（手持ちの一覧へ落とすため）
    app.stage.on('globalpointermove', (e) => {
      const drag = this.drag;
      if (!drag) return;
      const moved = Math.hypot(e.global.x - drag.startX, e.global.y - drag.startY);
      if (!drag.pointer && moved < INPUT_CONFIG.dragThresholdPx) return;
      if (!drag.pointer) {
        // ドラッグ開始: 長押しをやめ、指を離したときのクリックも無視する
        cancelPress();
        longPressed = true;
        const part = this.state && getPart(this.state.board, drag.from.x, drag.from.y);
        if (part) options.onCellDragStart(drag.from, part.id);
      }
      drag.pointer = { x: e.global.x, y: e.global.y };
      this.hovered = this.toCell(e.global.x, e.global.y);
      this.drawOverlay();
    });
    app.stage.on('pointermove', (e) => {
      if (!this.drag?.pointer) this.setHovered(this.toCell(e.global.x, e.global.y));
    });
    app.stage.on('pointerleave', cancelPress);
    app.stage.on('pointerleave', () => this.setHovered(null));

    app.ticker.add((ticker) => this.update(ticker.deltaMS));
  }

  /** PixiJS の初期化と画像の読み込みは非同期のため、生成はこの関数で行う */
  static async create(parent: HTMLElement, options: BoardRendererOptions): Promise<BoardRenderer> {
    const app = new Application();
    const [, textures, boardTextures] = await Promise.all([
      app.init({
        width: INITIAL_BOARD_PIXEL_SIZE.width,
        height: INITIAL_BOARD_PIXEL_SIZE.height,
        backgroundAlpha: 0,
        antialias: true,
        resolution: window.devicePixelRatio || 1,
        autoDensity: true,
      }),
      loadPartTextures(PART_DISPLAY_SIZE),
      loadBoardTextures(),
    ]);
    app.canvas.classList.add('board-canvas');
    parent.appendChild(app.canvas);
    return new BoardRenderer(app, textures, boardTextures, options);
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
    // シフトが変わったら、前の本番の「途切れた場所」の表示を消す
    // （盤面は次のシフトへそのまま持ち越されるので、盤面の変化だけでは気づけない）
    if (this.state && this.state.shiftKey !== state.shiftKey) this.status.clearBreaks();
    this.state = state;
    if (!this.timeline) this.status.setBoard(state.board, state.rules);

    if (sizeChanged) {
      // 工場拡張で盤面が広がったらキャンバスも広げる（CSS で横幅に合わせて縮小表示される）
      const size = boardPixelSize(state.board.width, state.board.height);
      this.app.renderer.resize(size.width, size.height);
      this.floorLayer.removeChildren().forEach((c) => c.destroy({ children: true }));
      this.floorLayer.addChild(
        createFloor(state.board.width, state.board.height, this.boardTextures),
      );
    }

    this.blockLayer.removeChildren().forEach((c) => c.destroy({ children: true }));
    for (const cell of state.rules.blockedCells) {
      this.blockLayer.addChild(
        createBlockedCell(
          cell % state.board.width,
          Math.floor(cell / state.board.width),
          false,
          this.boardTextures,
        ),
      );
    }
    for (const cell of state.upcomingBlocked) {
      this.blockLayer.addChild(
        createBlockedCell(
          cell % state.board.width,
          Math.floor(cell / state.board.width),
          true,
          this.boardTextures,
        ),
      );
    }

    this.partLayer.removeChildren().forEach((c) => c.destroy({ children: true }));
    this.partViews.clear();
    const { board } = state;
    for (let y = 0; y < board.height; y++) {
      for (let x = 0; x < board.width; x++) {
        const part = getPart(board, x, y);
        if (!part) continue;
        const view = createPartView(part, this.textures, this.badgeOf(part, x, y));
        const { px, py } = cellCenter(x, y);
        view.position.set(px, py);
        this.partLayer.addChild(view);
        this.partViews.set(y * board.width + x, view);
      }
    }
    this.drawOverlay();
  }

  /** 効果量バッジ（計算は sim の getPartBadge と、ランが持つルールに任せる） */
  private badgeOf(part: Part, x: number, y: number): PartBadge | null {
    if (!this.state) return null;
    return getPartBadge(part, this.state.board, x, y, this.state.rules);
  }

  /**
   * キーボード・コントローラーのカーソル（null で消す）。マウスのホバーと同じ表示（配置の見本・名前）に、
   * カーソルの枠を重ねる
   */
  setCursor(cell: { x: number; y: number } | null): void {
    this.cursor = cell;
    this.hovered = cell;
    this.drawOverlay();
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
    const { board, highlight, placing, guideCell } = this.state;

    if (guideCell && !this.timeline) {
      this.overlayLayer.addChild(cellFrame(guideCell.x, guideCell.y, BOARD_THEME.ghostOk, 5));
    }

    if (highlight)
      this.overlayLayer.addChild(cellFrame(highlight.x, highlight.y, BOARD_THEME.selected, 4));
    if (this.cursor && !this.timeline) {
      this.overlayLayer.addChild(
        cellFrame(this.cursor.x, this.cursor.y, BOARD_THEME.hazardYellow, 5),
      );
    }

    // ドラッグ中: 動かす先の枠（空きマスなら緑、ふさがっていれば赤）と、指についてくるパーツ
    const dragging = this.drag?.pointer ? this.drag : null;
    if (dragging && !this.timeline) {
      const moving = getPart(board, dragging.from.x, dragging.from.y);
      const target = this.hovered;
      if (target && (target.x !== dragging.from.x || target.y !== dragging.from.y)) {
        const free = !getPart(board, target.x, target.y);
        this.overlayLayer.addChild(
          cellFrame(target.x, target.y, free ? BOARD_THEME.ghostOk : BOARD_THEME.blocked, 3),
        );
      }
      // 動かしているパーツの元のマスに枠（指についてくる絵は画面側で出す: 盤面の外まで動かせるように）
      if (moving) {
        this.overlayLayer.addChild(
          cellFrame(dragging.from.x, dragging.from.y, BOARD_THEME.selected, 2),
        );
      }
      return;
    }

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
    const left = Math.min(Math.max(px - w / 2, 2), this.app.screen.width - w - 2);
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
    this.status.resetPips();
    this.status.clearBreaks();
    this.lastResult = result;
    this.timeline = new PlaybackTimeline(result.events);
    this.callbacks = callbacks;
    this.speed = speed;
    this.drawOverlay();
    if (speed === 'skip') this.skip();
  }

  /** 演出の強さ・揺れの設定を反映する */
  setEffectSettings(settings: EffectSettings): void {
    this.effects.setSettings(settings);
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
    this.effects.reset();
    this.finishPlayback();
  }

  /** 再生中の信号・演出を消す */
  clearPlayback(): void {
    // 先に通知先を外してから残りの演出を片付ける（古い再生の通知を出さないため）
    this.timeline = null;
    this.callbacks = null;
    this.tweens.finishAll();
    this.effects.reset();
    this.signalLayer.removeChildren().forEach((c) => c.destroy({ children: true }));
    this.signalViews.clear();
    this.status.resetPips();
  }

  private update(deltaMs: number): void {
    // スローモーション中は、再生と演出の時間をゆっくり進める
    const scaled = deltaMs * this.effects.timeScale;
    if (this.timeline && this.speed !== 'skip') {
      const tickMs = PlaybackTimeline.tickMs(this.speed);
      for (const tickEvents of this.timeline.advance(scaled, this.speed)) {
        this.applyTick(tickEvents, tickMs);
      }
    }
    this.tweens.update(scaled);

    // 揺れ（盤面全体をずらす。前面の連鎖カウンター・カットインは揺らさない）
    const offset = this.effects.update(deltaMs);
    this.root.position.set(offset.x, offset.y);

    // 全 tick を再生し終え、演出も落ち着いたら終了を通知
    if (this.timeline?.isFinished && this.tweens.isIdle) this.finishPlayback();
  }

  private finishPlayback(): void {
    const callbacks = this.callbacks;
    this.timeline = null;
    this.callbacks = null;
    if (this.lastResult && this.state) {
      this.status.showBreaks(summarizeBreaks(this.lastResult.events, this.state.board));
    }
    this.drawOverlay();
    callbacks?.onFinish();
  }

  /** 1 tick 分のイベントを見た目に反映する。tickMs=0 なら即時 */
  private applyTick(events: SimEvent[], tickMs: number): void {
    const moveMs = tickMs * MOVE_RATIO;
    const fxMs = Math.max(tickMs, 1) * 1.2;
    const instant = tickMs === 0;
    // 効果音: 信号の移動は tick ごとに1音だけ（信号が多くてもうるさくならないように）
    const sound = (key: SoundKey) => {
      if (!instant) this.options.playSound(key, chainSemitones(this.effects.chain));
    };
    if (events.some((e) => e.type === 'move')) sound('tick');

    for (const event of events) {
      switch (event.type) {
        case 'emit': {
          // 信号は発射元のマスに出現し、次の tick で移動を始める
          const view = createSignalView(event.value, this.options.formatCompact);
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
              this.status.onActivate(event.x, event.y);
              if (!instant) this.effects.onActivate(event.x, event.y, event.partId, fxMs);
              if (event.partId === 'barrel') sound('explode');
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
              if (!instant) this.effects.onShip(event.x, event.y, event.value, fxMs);
              sound('ship');
            },
          });
          break;
        case 'reset':
          this.tweens.add({
            delay: moveMs,
            duration: 0,
            onComplete: () => {
              this.status.onReset(event.x, event.y);
              if (!instant) this.effects.onReset(event.x, event.y, fxMs * 1.5);
            },
          });
          break;
        case 'absorb': {
          // 合流炉に取り込まれた信号は、到着したところで消える
          const view = this.signalViews.get(event.signalId);
          this.signalViews.delete(event.signalId);
          this.tweens.add({
            delay: moveMs,
            duration: 0,
            onComplete: () => view?.destroy({ children: true }),
          });
          break;
        }
        case 'income':
          this.tweens.add({
            delay: moveMs,
            duration: 0,
            onComplete: () => {
              if (!instant) this.effects.onIncome(event.x, event.y, event.amount, fxMs);
            },
          });
          break;
        case 'halt':
          // 打ち切りの表示は再生後の「途切れた理由」でまとめて行う
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
}

/** マスを囲む枠 */
function cellFrame(x: number, y: number, color: number, width: number): Graphics {
  const { px, py } = cellCenter(x, y);
  const half = CELL_SIZE / 2 - 3;
  return new Graphics()
    .roundRect(px - half, py - half, half * 2, half * 2, 8)
    .stroke({ width, color });
}
