/**
 * ラン進行の型定義
 *
 * RunState はそのまま JSON 化して保存できる形にしている（Score は文字列で保持）。
 */
import type { FloorTileId } from '../floor/types';
import type { BossModifierId, DayEventId } from '../balance';
import type { RunConfig } from '../config/runConfig';
import type { Board, PartId, SimResult, SimStats } from '../types';

/** ショップの商品1つ */
export interface ShopOffer {
  partId: PartId;
  price: number;
  sold: boolean;
}

/** 確定したシフトの記録 */
export interface ShiftRecord {
  shiftIndex: number;
  /** 出荷量（scoreToString した文字列） */
  score: string;
  quota: number;
  cleared: boolean;
  chainCount: number;
  /** 経済系パーツが生んだ予算 */
  income: number;
  /** ボスシフトだった場合の修正ルール */
  boss: BossModifierId | null;
}

/**
 * ランの進行状況
 * - building: 配置中（試運転は何度でも可能）
 * - cleared:  全シフトのノルマを達成してラン終了
 * - failed:   ノルマ未達でラン終了
 */
export type RunPhase = 'building' | 'cleared' | 'failed';

export interface RunState {
  /** ランのシード。用途別のシードはここから派生する（seeds.ts） */
  seed: number;
  /** ラン開始時に確定した設定一式 */
  config: RunConfig;
  /** 現在のシフト（0 始まり） */
  shiftIndex: number;
  phase: RunPhase;
  budget: number;
  board: Board;
  /** 手持ち（購入済み・未配置のパーツ） */
  inventory: Partial<Record<PartId, number>>;
  shop: ShopOffer[];
  /** このシフトでリロールした回数（リロール価格とショップのシードに使う） */
  rerollCount: number;
  /** このシフトで試運転した回数（試運転のシードに使う） */
  trialCount: number;
  history: ShiftRecord[];
  /** 延長戦に入っているか（全シフトクリア後に続けた） */
  overtime: boolean;
  /** メタ進行に記録済みのシフト数（延長戦で同じシフトを二重に記録しないため） */
  metaRecordedShifts: number;
  /** 今日のイベント（2日目以降の朝に選ぶ。導入前のセーブには無い） */
  dayEvent?: DayEventState | null;
  /** このシフトのボーナス床（シフト開始時に湧く。そのシフトのみ有効。導入前のセーブには無い） */
  bonusFloor?: BonusFloorState | null;
}

/** 日ごとのイベントの状態 */
export interface DayEventState {
  /** 何日目のイベントか（0 始まり） */
  day: number;
  /** 候補（この中から1つ選ぶ） */
  choices: DayEventId[];
  /** 選んだイベント。選ぶまでは null（選ぶまで組み立て・本番はできない） */
  chosen: DayEventId | null;
  /** 試供品でもらったパーツ（表示用） */
  samplePart: PartId | null;
  /**
   * 床の出来事で変わったマス（その日のあいだ有効）。tile が null なら、ステージの使用不可が解消された
   * 導入前のセーブには無い
   */
  floorChanges?: { index: number; tile: FloorTileId | null }[];
}

/** シフト開始時のボーナス床 */
export interface BonusFloorState {
  shiftIndex: number;
  cells: { index: number; tile: FloorTileId }[];
}

/** 操作の結果。失敗時は理由キー（i18n で表示する）を返す */
export type RunActionResult = { ok: true; state: RunState } | { ok: false; error: RunError };

export type RunError =
  | 'notBuilding'
  | 'offerNotFound'
  | 'alreadySold'
  | 'notEnoughBudget'
  | 'notInInventory'
  | 'cellOccupied'
  | 'cellEmpty'
  | 'cellBlocked'
  | 'outOfBoard'
  | 'cannotSell'
  | 'rerollDisabled'
  /** 今日のイベントをまだ選んでいない */
  | 'eventNotChosen'
  /** 選べるイベントがない・候補の番号が正しくない */
  | 'noEventToChoose'
  /** 本番シードを外から渡す設定（デイリー）なのに渡されなかった */
  | 'seedRequired';

/** シフトを確定した結果 */
export interface ShiftOutcome {
  cleared: boolean;
  quota: number;
  income: number;
  stats: SimStats;
}

export interface CommitResult {
  state: RunState;
  result: SimResult;
  outcome: ShiftOutcome;
}
