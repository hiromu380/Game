/**
 * バランス定数（ゲームの数値はすべてこのフォルダに集約する）
 *
 * 種類ごとにファイルを分けている。数値を変えるときは該当するファイルだけを開けばよい:
 * - sim.ts      盤面の広さ・tick 上限などシミュレーション全体の上限・計測不能の桁数
 * - parts.ts    パーツの価格・発動回数・レア度・効果量（倍率など）・ショップの出現重み
 * - floors.ts   床タイルの効果量（×2床・加算床・×3床）とシフト開始時のボーナス床・ランダム配置権
 * - stages.ts   日ごとのステージ（床の配置のテンプレートと、日ごとの抽選の帯）
 * - economy.ts  ショップの品数・リロール・売却・最初の手持ち
 * - shifts.ts   シフト表（ノルマ・予算・報酬）・延長戦・週替わり
 * - meta.ts     メタ進行（パーツの解放条件・工場拡張）
 * - events.ts   日ごとのイベント（2日目以降の朝に選ぶ）の候補と効果量
 * - boss.ts     ボスシフトの修正ルールの効果量
 * - types.ts    上の値の型（各項目の意味はここのコメントを参照）
 *
 * - コード中に倍率・価格・回数などを直書きしないこと
 * - ここを書き換えるだけで、シミュレーション・ラン進行の挙動が変わる
 *   （ただし進行中のランは開始時に確定した RunConfig を使うため影響しない）
 * - 浮動小数点による環境差を避けるため、値はすべて整数で持つ
 * - 調整は `pnpm balance` のレポートを根拠に行い、docs/balance-log.md に記録する
 * - シミュレーションの挙動が変わる調整をしたら SIM_VERSION（version.ts）を上げる
 */
import { BOSS } from './boss';
import { ECONOMY } from './economy';
import { DAY_EVENTS } from './events';
import { BONUS_FLOORS, FLOOR_PARAMS, FLOOR_PERMIT } from './floors';
import { META } from './meta';
import { GOLDEN, PART_PARAMS, PARTS, RARITY_WEIGHTS } from './parts';
import { STAGES } from './stages';
import { WEEKLY, OVERTIME, RESET_BOARD_EACH_DAY, SHIFTS, SHIFTS_PER_DAY } from './shifts';
import { BOARD, SIM, UNMEASURABLE } from './sim';
import type { Balance } from './types';

export type * from './types';

export const BALANCE: Balance = {
  board: BOARD,
  sim: SIM,
  unmeasurable: UNMEASURABLE,
  parts: PARTS,
  partParams: PART_PARAMS,
  floorParams: FLOOR_PARAMS,
  stages: STAGES,
  bonusFloors: BONUS_FLOORS,
  floorPermit: FLOOR_PERMIT,
  rarityWeights: RARITY_WEIGHTS,
  golden: GOLDEN,
  economy: ECONOMY,
  shifts: SHIFTS,
  shiftsPerDay: SHIFTS_PER_DAY,
  resetBoardEachDay: RESET_BOARD_EACH_DAY,
  dayEvents: DAY_EVENTS,
  overtime: OVERTIME,
  weekly: WEEKLY,
  meta: META,
  boss: BOSS,
};
