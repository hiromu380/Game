/**
 * シミュレーションの主要な型定義
 */
import type { PartParams } from './balance';
import type { Score } from './core/score';

/** パーツの種類 */
export const PART_IDS = [
  'switch',
  'conveyor',
  'splitter',
  'gear',
  'press',
  'barrel',
  'junkbot',
  'rebooter',
  'dock',
  // フェーズ2で追加
  'merger',
  'chainMeter',
  'spreader',
  'copier',
  'reflector',
  'turntable',
  'oiler',
  'coil',
  'solar',
  'inspector',
  'piggyBank',
] as const;
export type PartId = (typeof PART_IDS)[number];

/** パーツの向き（4方向）: 0=上 1=右 2=下 3=左 */
export type Dir4 = 0 | 1 | 2 | 3;

/**
 * 信号の進行方向（8方向）: 0=上 1=右上 2=右 3=右下 4=下 5=左下 6=左 7=左上
 * 爆発ドラム缶が斜めにも発射するため、信号は8方向を持つ
 */
export type Dir8 = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;

/** 盤面に置かれたパーツ */
export interface Part {
  id: PartId;
  dir: Dir4;
}

/** 盤面。cells は行優先（index = y * width + x）、空マスは null */
export interface Board {
  width: number;
  height: number;
  cells: (Part | null)[];
}

/** シミュレーション中の信号 */
export interface Signal {
  id: number;
  x: number;
  y: number;
  dir: Dir8;
  value: Score;
}

/**
 * シミュレーションのルール
 * ラン開始時に「基本（balance.ts）→ メタ進行 → ボス修正」の順に組み立てる（config/ を参照）
 */
export interface RuleSet {
  tickLimit: number;
  switchSignalValue: number;
  maxActivations: Record<PartId, number | null>;
  /** パーツ固有の効果量（倍率など） */
  params: PartParams;
  /** 使用不可のマス（index = y * width + x）。入った信号は消滅する */
  blockedCells: number[];
  /** 出荷口の加算をこの値で割る（切り捨て）。通常は 1 */
  dockDivisor: number;
  /** 経済系パーツが1回のシミュレーションで生める予算の上限 */
  maxIncomePerSim: number;
}

/** simulate の入力 */
export interface SimInput {
  board: Board;
  seed: number;
  rules: RuleSet;
}

/** 信号が消えた理由 */
export type VanishReason = 'outOfBoard' | 'emptyCell' | 'exhausted' | 'inert' | 'blocked';

/**
 * tick 単位のイベントログ。クライアントはこれを再生して演出する
 * （演出側でロジックを再計算しないこと）
 */
export type SimEvent =
  /** 信号が (x,y) から dir 方向へ発射された（次の tick で隣へ移動する） */
  | { tick: number; type: 'emit'; signalId: number; x: number; y: number; dir: Dir8; value: Score }
  /** 信号が (x,y) へ移動した */
  | { tick: number; type: 'move'; signalId: number; x: number; y: number }
  /** (x,y) のパーツが信号を受けて発動した（受けた信号はここで消費される） */
  | { tick: number; type: 'activate'; signalId: number; x: number; y: number; partId: PartId }
  /** 出荷口が value を出荷した。total はその時点の累計 */
  | { tick: number; type: 'ship'; x: number; y: number; value: Score; total: Score }
  /** (x,y) のパーツの発動回数がリセットされた */
  | { tick: number; type: 'reset'; x: number; y: number }
  /** 信号が消滅した */
  | { tick: number; type: 'vanish'; signalId: number; x: number; y: number; reason: VanishReason }
  /** 合流するパーツ（合流炉）が、同じ tick の2本目以降の信号を取り込んだ */
  | { tick: number; type: 'absorb'; signalId: number; x: number; y: number }
  /** 経済系パーツが予算を生んだ。total はその時点の累計 */
  | { tick: number; type: 'income'; x: number; y: number; amount: number; total: number }
  /** tick 上限に達し、信号が残ったまま打ち切った */
  | { tick: number; type: 'halt'; reason: 'tickLimit'; remainingSignals: number };

/** 1回のシミュレーションの統計 */
export interface SimStats {
  /** 連鎖数 = 信号によるパーツ発動の合計回数（スイッチの初回発射は含まない） */
  chainCount: number;
  /** 発動したパーツのマス数（重複なし） */
  activatedParts: number;
  /** 出荷回数 */
  shipCount: number;
  /** 信号が取った最大値 */
  maxValue: Score;
  /** 実行した tick 数 */
  ticks: number;
  /** tick 上限で強制終了したか */
  haltedByTickLimit: boolean;
}

/** simulate の出力 */
export interface SimResult {
  score: Score;
  /** 経済系パーツが生んだ次シフトの予算 */
  income: number;
  events: SimEvent[];
  stats: SimStats;
}
