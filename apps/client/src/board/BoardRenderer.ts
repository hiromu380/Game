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
  isBlockedCell,
  type FloorCell,
  type FloorLayer,
  type FloorParams,
  type FloorTileId,
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
import type { PlaybackSpeed } from '../playback/timeline';
import {
  buildChoreography,
  type Choreography,
  ChoreographyPlayer,
  MOVE_RATIO,
  type Cue,
} from '../playback/choreography';
import {
  boardPixelSize,
  INITIAL_BOARD_PIXEL_SIZE,
  CELL_SIZE,
  cellCenter,
  pixelToCell,
} from './layout';
import { summarizeBreaks } from '../playback/breaks';
import { summarizeTrace } from '../playback/trace';
import { bestPlacementCells, type PlacementHints } from './hints';
import type { SoundKey } from '../audio/manifest';
import { EFFECTS_CONFIG } from '../config/effects';
import { INPUT_CONFIG } from '../config/input';
import { EffectsLayer, type EffectSettings } from './fx/EffectsLayer';
import { ParticlePool } from './fx/particlePool';
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
  createFloorTile,
  createPartView,
  PART_DISPLAY_SIZE,
  SignalView,
  SignalViewPool,
} from './views';

/** 盤面の表示状態（React 側から渡される） */
export interface BoardViewState {
  board: Board;
  /** 現在のシフトのルール（倍率バッジなどの表示に使う。ボス修正込み） */
  rules: RuleSet;
  /** 現在のシフトの床（ステージ・ボスの使用不可など） */
  floor: FloorLayer;
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

/** 床の効果音の音程（倍率が大きい床ほど高い） */
const FLOOR_SEMITONES: Record<FloorTileId, number> = { add: 0, double: 4, triple: 9, blocked: 0 };

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
  /** ノルマを超えた瞬間の帯の文言 */
  getQuotaCrossLabel: () => string;
  /** 床タイルの短い表記（マスの左上・演出。例: ×2・+3） */
  getFloorShort: (tile: FloorTileId, params: FloorParams) => string;
  /** 床の説明（ホバー時。ボーナス床・出来事の床は期間も） */
  getFloorDescription: (cell: FloorCell, params: FloorParams) => string;
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

/** tick がこれより短いときは、細かい演出（パーツの発光・コインの数）を間引く */
const THIN_TICK_MS = 70;

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
  /** 信号の尾（信号より下に描く） */
  private readonly trailLayer = new Container();
  private readonly trails = new ParticlePool(this.trailLayer, EFFECTS_CONFIG.trail.maxAlive);
  private readonly signalLayer = new Container();
  /** 再生中の演出（発光・パーティクル・揺れ・スロー・連鎖カウンター・カットイン） */
  private readonly effects: EffectsLayer;
  private readonly tooltipLayer = new Container();
  private readonly tweens = new TweenManager();

  /** マス index → パーツの表示オブジェクト（発光演出で使う） */
  private partViews = new Map<number, Container>();
  /** マス index → いま描いてあるパーツの中身（種類・向き・バッジ）。変わったマスだけ作り直す */
  private partKeys = new Map<number, string>();
  /** いま描いてある床タイル・使用不可・予告の中身（変わったときだけ作り直す） */
  private floorKey = '';
  /** 信号 id → 表示オブジェクト */
  private signalViews = new Map<number, SignalView>();
  /** 信号の表示の使い回し */
  private readonly signals: SignalViewPool;
  /** 選択枠・ホバー枠（1つの Graphics に描き直す） */
  private readonly frames = new Graphics();
  /** 配置の見本（同じパーツ・向きの間は使い回す） */
  private ghost: { key: string; view: Container } | null = null;
  private readonly tooltipBg = new Graphics();
  private readonly tooltipLabel = new Text({
    text: '',
    style: { fill: BOARD_THEME.tooltipText, fontSize: 14, fontWeight: 'bold' },
  });
  /** 配置の手がかり（盤面・選んだパーツが同じ間は求め直さない） */
  private hintCache: {
    state: BoardViewState;
    partId: PartId;
    hints: PlacementHints | null;
  } | null = null;
  /** いま出しているラベルの中身（同じなら描き直さない） */
  private tooltipKey = '';
  /** 次のフレームで描画が必要か（何も動いていないときは描画を止めて、CPU・GPU・電池を使わない） */
  private needsRender = true;

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
  /** 再生中の演出の流れ（playback/choreography.ts） */
  private timeline: ChoreographyPlayer | null = null;
  /** ピークで止めている残り時間（この間は再生も演出も進めない。揺れだけ続ける） */
  private freezeMs = 0;
  private effectSettings: EffectSettings = { strength: 'full', shake: true, reduceFlashes: false };
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
    this.signals = new SignalViewPool((value) => options.formatCompact(value));
    this.tooltipLabel.anchor.set(0.5);
    this.tooltipBg.visible = false;
    this.tooltipLabel.visible = false;
    this.overlayLayer.addChild(this.frames);
    this.tooltipLayer.addChild(this.tooltipBg, this.tooltipLabel);
    this.effects = new EffectsLayer(
      this.tweens,
      textures.junkbot,
      {
        chain: options.formatChain,
        cutInTitle: options.getCutInTitle,
        income: options.formatIncome,
        score: options.formatScore,
        compact: options.formatCompact,
        quotaCross: options.getQuotaCrossLabel,
      },
      (x, y) => (this.state ? this.partViews.get(y * this.state.board.width + x) : undefined),
      () => ({ width: this.app.screen.width, height: this.app.screen.height }),
    );

    this.root.addChild(
      this.floorLayer,
      this.blockLayer,
      this.partLayer,
      this.status.traceLayer,
      this.status.pipLayer,
      this.overlayLayer,
      this.trailLayer,
      this.signalLayer,
      this.effects.boardLayer,
      this.status.breakLayer,
      this.tooltipLayer,
    );
    app.stage.addChild(this.root, this.effects.screenLayer);

    // マウス・タッチ操作
    app.stage.eventMode = 'static';
    app.stage.hitArea = app.screen;
    // 入力は盤面全体（stage）で受けてマスに変換するので、中の表示オブジェクトは当たり判定の対象から外す
    // （マウスを動かすたびに全部のパーツ・演出をたどらずに済む）
    app.stage.interactiveChildren = false;
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

    // 描画は必要なときだけ自分で行う（PixiJS の「毎フレーム必ず描く」処理は外す）
    app.ticker.remove(app.render, app);
    app.ticker.add((ticker) => this.update(ticker.deltaMS));
    // 描画先が作り直されたら（GPU の切り替えなど）描き直す
    app.canvas.addEventListener('webglcontextrestored', () => this.requestRender());
  }

  /** 次のフレームで描く（止めていた描画のループを起こす） */
  private requestRender(): void {
    this.needsRender = true;
    if (!this.app.ticker.started) this.app.ticker.start();
  }

  /** 再生・演出・揺れのどれかが動いているか（動いている間は毎フレーム描く） */
  private get isAnimating(): boolean {
    return (
      this.timeline !== null || !this.tweens.isIdle || this.freezeMs > 0 || this.effects.isShaking
    );
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
    // 使い回し用に取っておいた表示と、共有している形を捨てる
    this.signals.destroy();
    this.status.destroy();
    this.effects.destroy();
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

    this.drawFloorTiles(state);
    this.drawParts(state, sizeChanged);
    this.drawOverlay();
  }

  /** 床タイル・使用不可マス・夜の予告を描く（中身が前と同じなら何もしない） */
  private drawFloorTiles(state: BoardViewState): void {
    const labels: string[] = [];
    let key = `${state.board.width}x${state.board.height}|${state.upcomingBlocked.join(',')}|`;
    for (let cell = 0; cell < state.floor.length; cell++) {
      const floorCell = state.floor[cell];
      if (!floorCell) continue;
      const label = isBlockedCell(state.floor, cell)
        ? ''
        : this.options.getFloorShort(floorCell.tile, state.rules.floorParams);
      labels[cell] = label;
      key += `${cell}:${floorCell.tile}:${floorCell.source}:${label};`;
    }
    if (key === this.floorKey) return;
    this.floorKey = key;

    this.blockLayer.removeChildren().forEach((c) => c.destroy({ children: true }));
    // 床タイル（盤面の下層。パーツより下に、控えめに描く）
    for (let cell = 0; cell < state.floor.length; cell++) {
      const floorCell = state.floor[cell];
      if (!floorCell) continue;
      const x = cell % state.board.width;
      const y = Math.floor(cell / state.board.width);
      this.blockLayer.addChild(
        isBlockedCell(state.floor, cell)
          ? createBlockedCell(x, y, false, this.boardTextures)
          : createFloorTile(x, y, floorCell, labels[cell] ?? '', this.boardTextures),
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
  }

  /**
   * パーツを描く。種類・向き・バッジが前と変わったマスだけ作り直す
   * （選択やホバーが変わるたびに、盤面全部を作り直さない）
   */
  private drawParts(state: BoardViewState, rebuildAll: boolean): void {
    const { board } = state;
    if (rebuildAll) {
      this.partLayer.removeChildren().forEach((c) => c.destroy({ children: true }));
      this.partViews.clear();
      this.partKeys.clear();
    }
    let changed = false;
    /** 手応えの演出の候補（置いた・外した・回したマス） */
    const touched: { kind: 'placed' | 'removed' | 'rotated'; x: number; y: number }[] = [];
    for (let y = 0; y < board.height; y++) {
      for (let x = 0; x < board.width; x++) {
        const index = y * board.width + x;
        const part = getPart(board, x, y);
        const badge = part ? this.badgeOf(part, x, y) : null;
        const key = part
          ? `${part.id}:${part.dir}:${badge ? `${badge.kind}${badge.value}` : ''}`
          : undefined;
        const previous = this.partKeys.get(index);
        if (key === previous) continue;
        changed = true;
        if (!previous) touched.push({ kind: 'placed', x, y });
        else if (!key) touched.push({ kind: 'removed', x, y });
        else if (
          part &&
          previous.split(':')[0] === part.id &&
          previous.split(':')[1] !== `${part.dir}`
        ) {
          touched.push({ kind: 'rotated', x, y });
        }
        this.partViews.get(index)?.destroy({ children: true });
        this.partViews.delete(index);
        this.partKeys.delete(index);
        if (!part || key === undefined) continue;
        const view = createPartView(part, this.textures, badge);
        const { px, py } = cellCenter(x, y);
        view.position.set(px, py);
        this.partViews.set(index, view);
        this.partKeys.set(index, key);
      }
    }
    if (!changed) return;
    // 重なりの順（マス番号の昇順）を保つ
    this.partLayer.removeChildren();
    const indices = [...this.partViews.keys()].sort((a, b) => a - b);
    for (const index of indices) this.partLayer.addChild(this.partViews.get(index)!);

    // 置く・外す・回すの手応え。盤面を丸ごと描いたとき（読み込み・片付け）と再生中は出さない
    const p = EFFECTS_CONFIG.placement;
    if (rebuildAll || this.timeline || touched.length > p.maxCells) return;
    if (this.effects.strengthPower <= 0) return;
    for (const cell of touched) {
      if (cell.kind === 'removed') {
        this.effects.dust(cell.x, cell.y);
        continue;
      }
      const view = this.partViews.get(cell.y * board.width + cell.x);
      if (!view) continue;
      const placed = cell.kind === 'placed';
      if (placed) view.scale.set(0.6);
      this.tweens.add({
        duration: placed ? p.popMs : p.nudgeMs,
        onUpdate: (t) => {
          if (view.destroyed) return;
          // 置いたとき: 小さく出て、少し行き過ぎてから収まる。回したとき: 少しふくらんで戻る
          const e = easeOutCubic(t);
          view.scale.set(
            placed ? 0.6 + 0.4 * e + 0.14 * Math.sin(Math.PI * t) : 1 + 0.12 * (1 - e),
          );
        },
        onComplete: () => {
          if (!view.destroyed) view.scale.set(1);
        },
      });
    }
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

  /** 選択枠・ホバー枠・配置プレビュー・名前ラベルを描く（表示オブジェクトは作り直さず、描き直す） */
  private drawOverlay(): void {
    this.requestRender();
    const frames = this.frames.clear();
    let ghostShown = false;
    let tooltip: { x: number; y: number; text: string } | null = null;
    const state = this.state;

    if (state) {
      const { board, highlight, placing, guideCell } = state;
      // 配置の手がかり: 選んだパーツの効果がいちばん大きい空きマスの四隅に印を付ける
      // （初回ガイドで置くマスを案内している間と、再生中は出さない）
      if (placing && !guideCell && !this.timeline) {
        const hints = this.hintsFor(state, placing.partId);
        if (hints) {
          for (const index of hints.cells) {
            cornerMarks(frames, index % board.width, Math.floor(index / board.width));
          }
          frames.stroke({ width: 3, color: BOARD_THEME.ghostOk, alpha: 0.8, cap: 'round' });
        }
      }
      if (guideCell && !this.timeline) {
        cellFrame(frames, guideCell.x, guideCell.y, BOARD_THEME.ghostOk, 5);
      }
      if (highlight) cellFrame(frames, highlight.x, highlight.y, BOARD_THEME.selected, 4);
      if (this.cursor && !this.timeline) {
        cellFrame(frames, this.cursor.x, this.cursor.y, BOARD_THEME.hazardYellow, 5);
      }

      // ドラッグ中: 動かす先の枠（空きマスなら緑、ふさがっていれば赤）と、指についてくるパーツ
      const dragging = this.drag?.pointer ? this.drag : null;
      // 再生中はホバー表示を出さない（演出を見やすくするため）
      const hovered = this.timeline ? null : this.hovered;
      if (dragging && !this.timeline) {
        const moving = getPart(board, dragging.from.x, dragging.from.y);
        const target = this.hovered;
        if (target && (target.x !== dragging.from.x || target.y !== dragging.from.y)) {
          const free = !getPart(board, target.x, target.y);
          cellFrame(
            frames,
            target.x,
            target.y,
            free ? BOARD_THEME.ghostOk : BOARD_THEME.blocked,
            3,
          );
        }
        // 動かしているパーツの元のマスに枠（指についてくる絵は画面側で出す: 盤面の外まで動かせるように）
        if (moving) cellFrame(frames, dragging.from.x, dragging.from.y, BOARD_THEME.selected, 2);
      } else if (hovered) {
        const part = getPart(board, hovered.x, hovered.y);
        if (placing && !part) {
          // 配置プレビュー: 半透明のパーツと緑の枠
          cellFrame(frames, hovered.x, hovered.y, BOARD_THEME.ghostOk, 3);
          // 見本には、そのマスに置いたときの効果量（×3・+4）も出す
          const ghost = this.ghostFor(
            placing.partId,
            placing.dir,
            getPartBadge(
              { id: placing.partId, dir: placing.dir },
              board,
              hovered.x,
              hovered.y,
              state.rules,
            ),
          );
          const { px, py } = cellCenter(hovered.x, hovered.y);
          ghost.position.set(px, py);
          ghostShown = true;
          tooltip = { ...hovered, text: this.withFloor(hovered, placing.partId) };
        } else if (part) {
          cellFrame(frames, hovered.x, hovered.y, 0xffffff, 2);
          tooltip = { ...hovered, text: this.withFloor(hovered, part.id) };
        } else {
          // 空きマスの床: 効果の説明
          const text = this.withFloor(hovered, null);
          if (text) tooltip = { ...hovered, text };
        }
      }
    }

    if (this.ghost) this.ghost.view.visible = ghostShown;
    this.showTooltip(tooltip);
  }

  /** 配置の見本（半透明のパーツ）。同じパーツ・向きなら前に作ったものを使う */
  private ghostFor(partId: PartId, dir: Dir4, badge: PartBadge | null): Container {
    const key = `${partId}:${dir}:${badge ? `${badge.kind}${badge.value}` : ''}`;
    if (this.ghost?.key !== key) {
      const old = this.ghost?.view;
      if (old) {
        this.overlayLayer.removeChild(old);
        old.destroy({ children: true });
      }
      const view = createPartView({ id: partId, dir }, this.textures, badge);
      view.alpha = 0.55;
      this.overlayLayer.addChild(view);
      this.ghost = { key, view };
    }
    return this.ghost.view;
  }

  private hintsFor(state: BoardViewState, partId: PartId): PlacementHints | null {
    const cache = this.hintCache;
    if (cache && cache.state === state && cache.partId === partId) return cache.hints;
    const hints = bestPlacementCells(state.board, state.floor, state.rules, partId);
    this.hintCache = { state, partId, hints };
    return hints;
  }

  /** ホバーの文言: パーツ名と、そのマスの床の説明（床がなければパーツ名だけ） */
  private withFloor(cell: { x: number; y: number }, partId: PartId | null): string {
    const state = this.state;
    const floorCell = state?.floor[cell.y * state.board.width + cell.x] ?? null;
    const lines = partId ? [this.options.getPartName(partId)] : [];
    if (state && floorCell) {
      lines.push(this.options.getFloorDescription(floorCell, state.rules.floorParams));
    }
    return lines.join('\n');
  }

  /** マスの上にパーツ名のラベルを出す（null で消す） */
  private showTooltip(tooltip: { x: number; y: number; text: string } | null): void {
    const bg = this.tooltipBg;
    const label = this.tooltipLabel;
    bg.visible = tooltip !== null;
    label.visible = tooltip !== null;
    if (!tooltip) return;
    const { x, y, text } = tooltip;
    const key = `${x},${y},${this.app.screen.width}:${text}`;
    if (key === this.tooltipKey) return;
    this.tooltipKey = key;
    if (label.text !== text) label.text = text;
    const w = label.width + 16;
    const h = Math.max(24, label.height + 8);
    const { px, py } = cellCenter(x, y);
    // 最上段では下に出す
    const top = y === 0 ? py + CELL_SIZE / 2 + 4 : py - CELL_SIZE / 2 - h - 4;
    const left = Math.min(Math.max(px - w / 2, 2), this.app.screen.width - w - 2);
    bg.clear().roundRect(left, top, w, h, 6).fill({ color: BOARD_THEME.tooltipBg, alpha: 0.9 });
    label.position.set(left + w / 2, top + h / 2);
  }

  // ---------------------------------------------------------------------------
  // イベント再生
  // ---------------------------------------------------------------------------

  /**
   * シミュレーション結果の再生を始める
   * quota: ノルマ（超えた瞬間を見せる。なければ null）
   */
  play(
    result: SimResult,
    speed: PlaybackSpeed,
    callbacks: PlaybackCallbacks,
    quota: number | null = null,
    peakFirst = false,
  ): void {
    this.clearPlayback();
    this.status.resetPips();
    this.status.clearBreaks();
    this.lastResult = result;
    const choreography = buildChoreography(result.events, {
      strength: this.effectSettings.strength,
      reduceFlashes: this.effectSettings.reduceFlashes,
      quota,
    });
    this.timeline = new ChoreographyPlayer(result.events, choreography);
    this.freezeMs = 0;
    this.callbacks = callbacks;
    this.speed = speed;
    this.drawOverlay();
    this.requestRender();
    if (speed === 'skip') this.skip();
    else if (peakFirst) this.fastForwardToPeak(choreography);
  }

  /** 撮影用: ピークの少し前まで、演出なしで盤面だけ進める */
  private fastForwardToPeak(choreography: Choreography): void {
    const peak = choreography.cues.find((c) => c.kind === 'peak');
    if (!peak || !this.timeline) return;
    const skipMs = peak.atMs - EFFECTS_CONFIG.choreography.capturePeakLeadMs;
    if (skipMs <= 0) return;
    let chain = 0;
    for (const tick of this.timeline.advance(skipMs).ticks) {
      this.applyTick(tick.events, 0);
      chain += tick.events.filter((e) => e.type === 'activate').length;
    }
    this.tweens.finishAll();
    this.effects.reset();
    this.effects.restoreChain(chain);
  }

  /** 演出の強さ・揺れの設定を反映する */
  setEffectSettings(settings: EffectSettings): void {
    this.effectSettings = settings;
    this.effects.setSettings(settings);
  }

  setSpeed(speed: PlaybackSpeed): void {
    this.speed = speed;
    if (speed === 'skip') this.skip();
  }

  /** 残りの演出を飛ばして最終状態にする */
  skip(): void {
    if (!this.timeline) return;
    for (const tick of this.timeline.flush().ticks) this.applyTick(tick.events, 0);
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
    this.trails.releaseAll();
    for (const view of this.signalViews.values()) this.signals.release(view);
    for (const child of [...this.signalLayer.children]) {
      if (child instanceof SignalView) this.signals.release(child);
    }
    this.signalViews.clear();
    this.status.resetPips();
    this.requestRender();
  }

  private update(deltaMs: number): void {
    const wasAnimating = this.isAnimating;
    // ピークで止めている間は、再生も演出も進めない（揺れだけ続ける）
    let scaled = deltaMs;
    if (this.freezeMs > 0) {
      const frozen = Math.min(this.freezeMs, deltaMs);
      this.freezeMs -= frozen;
      scaled = deltaMs - frozen;
    }
    const speed = this.speed;
    if (this.timeline && speed !== 'skip' && scaled > 0) {
      const rate = speed;
      const due = this.timeline.advance(scaled * rate);
      for (const tick of due.ticks) this.applyTick(tick.events, tick.durationMs / rate);
      for (const cue of due.cues) this.applyCue(cue, rate);
    }
    this.tweens.update(scaled);

    // 揺れ（盤面全体をずらす。前面の連鎖カウンター・カットインは揺らさない）
    const offset = this.effects.update(deltaMs);
    this.root.position.set(offset.x, offset.y);

    // 全 tick を再生し終え、演出も落ち着いたら終了を通知
    if (this.timeline?.isFinished && this.tweens.isIdle) this.finishPlayback();

    // 動きがあったフレームと、盤面が変わった直後のフレームだけ描く。何もなければループごと止める
    if (wasAnimating || this.needsRender || this.isAnimating) {
      this.needsRender = false;
      this.app.render();
    } else {
      this.app.ticker.stop();
    }
  }

  private finishPlayback(): void {
    const callbacks = this.callbacks;
    this.timeline = null;
    this.callbacks = null;
    if (this.lastResult && this.state) {
      this.status.showBreaks(summarizeBreaks(this.lastResult.events, this.state.board));
      this.status.showTrace(summarizeTrace(this.lastResult.events));
    }
    this.drawOverlay();
    callbacks?.onFinish();
  }

  /** 演出の命令を見た目・音に反映する（rate: 再生速度。長さを速さに合わせて縮める） */
  private applyCue(cue: Cue, rate: number): void {
    switch (cue.kind) {
      case 'windup': {
        this.options.playSound('windup', 0);
        const switches: { x: number; y: number }[] = [];
        const board = this.state?.board;
        board?.cells.forEach((c, i) => {
          if (c?.id === 'switch')
            switches.push({ x: i % board.width, y: Math.floor(i / board.width) });
        });
        this.effects.windup(switches, cue.durationMs / rate);
        break;
      }
      case 'note':
        // 1連鎖ごとに半音上がる音階。8段ごとに音色が変わる
        this.options.playSound(`chain${cue.timbre}` as SoundKey, cue.semitone);
        break;
      case 'multiplier':
        this.effects.multiplier(cue.x, cue.y, cue.text, 700 / rate);
        break;
      case 'floor':
        // 床の効果: 倍率が大きい床ほど音程が高い
        this.options.playSound('floor', FLOOR_SEMITONES[cue.tile]);
        this.effects.floor(cue.x, cue.y, cue.tile, cue.text, 700 / rate);
        break;
      case 'digitUp':
        this.options.playSound('digitUp', 0);
        this.effects.digitUp(cue.total);
        break;
      case 'quotaCross':
        this.options.playSound('quotaCross', 0);
        this.effects.quotaCross();
        break;
      case 'flash':
        this.effects.flash(cue.alpha, cue.durationMs / rate);
        break;
      case 'peak':
        this.freezeMs = cue.hitstopMs / rate;
        this.options.playSound('peak', 0);
        this.effects.peak();
        break;
      case 'stamp':
        this.options.playSound('stamp', 0);
        this.effects.stamp(cue.total, cue.durationMs / rate);
        break;
    }
  }

  /** 1 tick 分のイベントを見た目に反映する。tickMs=0 なら即時 */
  private applyTick(events: SimEvent[], tickMs: number): void {
    const moveMs = tickMs * MOVE_RATIO;
    // 信号の尾は、じっくり見せる tick でだけ出す
    const trail = tickMs >= THIN_TICK_MS;
    const fxMs = Math.max(tickMs, 1) * 1.2;
    const instant = tickMs === 0;
    this.effects.setThin(tickMs < THIN_TICK_MS);
    const sound = (key: SoundKey) => {
      if (!instant) this.options.playSound(key, 0);
    };
    // 信号が移動するだけの tick にも小さな音を入れ、無音の間を作らない（発動した tick は連鎖の音階が鳴る）
    if (events.some((e) => e.type === 'move') && !events.some((e) => e.type === 'activate')) {
      sound('tick');
    }

    for (const event of events) {
      switch (event.type) {
        case 'emit': {
          // 信号は発射元のマスに出現し、次の tick で移動を始める
          const view = this.signals.acquire(event.value);
          const generation = view.generation;
          const { px, py } = cellCenter(event.x, event.y);
          view.position.set(px, py);
          view.visible = false;
          this.signalLayer.addChild(view);
          this.signalViews.set(event.signalId, view);
          this.tweens.add({
            delay: event.tick === 0 ? 0 : moveMs,
            duration: fxMs * 0.4,
            onStart: () => {
              if (view.generation === generation) view.visible = true;
            },
            // ポンと出てくる
            onUpdate: (t) => {
              if (view.generation === generation) view.scale.set(0.4 + 0.6 * easeOutCubic(t));
            },
          });
          break;
        }
        case 'move':
          this.moveSignal(event.signalId, event.x, event.y, moveMs, trail);
          break;
        case 'vanish': {
          // 盤面外への移動は move イベントがないため、ここで外へ動かす
          if (event.reason === 'outOfBoard')
            this.moveSignal(event.signalId, event.x, event.y, moveMs, trail);
          const view = this.signalViews.get(event.signalId);
          this.signalViews.delete(event.signalId);
          if (view) {
            const generation = view.generation;
            this.tweens.add({
              delay: moveMs,
              duration: fxMs * 0.5,
              onUpdate: (t) => {
                if (view.generation !== generation) return;
                view.alpha = 1 - t;
                view.scale.set(1 - 0.5 * t);
              },
              onComplete: () => this.releaseSignal(view, generation),
            });
          }
          break;
        }
        case 'activate': {
          // 受けた信号はパーツに吸収される
          const view = this.signalViews.get(event.signalId);
          this.signalViews.delete(event.signalId);
          const generation = view?.generation ?? 0;
          this.tweens.add({
            delay: moveMs,
            duration: 0,
            onComplete: () => {
              this.releaseSignal(view, generation);
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
          const generation = view?.generation ?? 0;
          this.tweens.add({
            delay: moveMs,
            duration: 0,
            onComplete: () => this.releaseSignal(view, generation),
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

  /** 使い終わった信号の表示を返す（すでに返して別の信号に使われていたら何もしない） */
  private releaseSignal(view: SignalView | undefined, generation: number): void {
    if (view && view.generation === generation) this.signals.release(view);
  }

  private moveSignal(
    signalId: number,
    x: number,
    y: number,
    durationMs: number,
    trail: boolean,
  ): void {
    const view = this.signalViews.get(signalId);
    if (!view) return;
    const fromX = view.x;
    const fromY = view.y;
    const generation = view.generation;
    const { px, py } = cellCenter(x, y);
    this.tweens.add({
      duration: durationMs,
      onUpdate: (t) => {
        if (view.generation !== generation) return;
        const e = easeOutCubic(t);
        view.position.set(fromX + (px - fromX) * e, fromY + (py - fromY) * e);
      },
    });
    if (trail && view.visible) this.leaveTrail(view.tier, fromX, fromY, px, py, durationMs);
  }

  /** 信号の尾: 通った道すじに、信号の色の小さな点を残して消す（数は演出の強さで減る） */
  private leaveTrail(
    tier: number,
    fromX: number,
    fromY: number,
    toX: number,
    toY: number,
    durationMs: number,
  ): void {
    const c = EFFECTS_CONFIG.trail;
    const count = Math.round(c.dots * this.effects.strengthPower);
    const color = BOARD_THEME.signalTiers[tier] ?? BOARD_THEME.signalTiers[0]!;
    for (let i = 0; i < count; i++) {
      // 道すじに等間隔に置き、信号がその位置を通る時刻に出す（信号の減速カーブを逆算する）
      const p = (i + 0.5) / (count + 0.5);
      const f = 1 - Math.cbrt(1 - p);
      const x = fromX + (toX - fromX) * p;
      const y = fromY + (toY - fromY) * p;
      let dot: ReturnType<ParticlePool['acquire']> = null;
      this.tweens.add({
        delay: durationMs * f,
        duration: Math.max(c.fadeMs, durationMs * 1.5),
        onStart: () => {
          dot = this.trails.acquire('dot', color);
          dot?.position.set(x, y);
        },
        onUpdate: (t) => {
          if (!dot) return;
          dot.alpha = c.alpha * (1 - t);
          dot.scale.set(c.startScale + (c.endScale - c.startScale) * t);
        },
        onComplete: () => {
          if (dot) this.trails.release(dot);
        },
      });
    }
  }
}

/** マスの四隅のかぎ形の印を g の線に足す（色・太さは呼び出し側で stroke する） */
function cornerMarks(g: Graphics, x: number, y: number): void {
  const { px, py } = cellCenter(x, y);
  const half = CELL_SIZE / 2 - 7;
  const len = 10;
  for (const sx of [-1, 1]) {
    for (const sy of [-1, 1]) {
      const cx = px + sx * half;
      const cy = py + sy * half;
      g.moveTo(cx - sx * len, cy)
        .lineTo(cx, cy)
        .lineTo(cx, cy - sy * len);
    }
  }
}

/** マスを囲む枠を g に描き足す */
function cellFrame(g: Graphics, x: number, y: number, color: number, width: number): void {
  const { px, py } = cellCenter(x, y);
  const half = CELL_SIZE / 2 - 3;
  g.roundRect(px - half, py - half, half * 2, half * 2, 8).stroke({ width, color });
}
