/**
 * 用途別シードの導出（CLAUDE.md「シード」の定義と必ず一致させること）
 *
 * ランシードひとつから、本番・ショップ・試運転・ボス計画のシードを作る。
 * 用途ごとにラベルを変えているので、互いに相関しない。
 */
import { deriveSeed } from '../core/prng';

const LABEL_COMMIT = 1;
const LABEL_SHOP = 2;
const LABEL_TRIAL = 3;
const LABEL_BOSS = 4;
const LABEL_OVERTIME = 5;
const LABEL_DAY_EVENT = 6;
const LABEL_STAGE = 7;
const LABEL_BONUS_FLOOR = 8;
const LABEL_FLOOR_PERMIT = 9;

/** 本番（スイッチを押したとき）のシード。プレイヤーには表示しない */
export function commitSeed(runSeed: number, shiftIndex: number): number {
  return deriveSeed(runSeed, LABEL_COMMIT, shiftIndex);
}

/** ショップの品揃えのシード（リロールするたびに変わる） */
export function shopSeed(runSeed: number, shiftIndex: number, rerollCount: number): number {
  return deriveSeed(runSeed, LABEL_SHOP, shiftIndex, rerollCount);
}

/** 試運転のシード（試運転するたびに変わる。本番シードとは一致しない） */
export function trialSeed(runSeed: number, shiftIndex: number, trialCount: number): number {
  return deriveSeed(runSeed, LABEL_TRIAL, shiftIndex, trialCount);
}

/** ボス計画（夜ごとの修正ルール）のシード */
export function bossSeed(runSeed: number): number {
  return deriveSeed(runSeed, LABEL_BOSS);
}

/** 延長戦で追加するシフトのボス抽選のシード */
export function overtimeSeed(runSeed: number, shiftIndex: number): number {
  return deriveSeed(runSeed, LABEL_OVERTIME, shiftIndex);
}

/**
 * 日ごとのイベントのシード（day は 0 始まりの日）
 * purpose: 0 = 候補の抽選、1 = 試供品のパーツ、2 = 床の出来事の位置
 */
export function dayEventSeed(runSeed: number, day: number, purpose: 0 | 1 | 2): number {
  return deriveSeed(runSeed, LABEL_DAY_EVENT, day, purpose);
}

/** 日ごとのステージ（床の配置）のシード（day は 0 始まりの日） */
export function stageSeed(runSeed: number, day: number): number {
  return deriveSeed(runSeed, LABEL_STAGE, day);
}

/** シフト開始時のボーナス床のシード */
export function bonusFloorSeed(runSeed: number, shiftIndex: number): number {
  return deriveSeed(runSeed, LABEL_BONUS_FLOOR, shiftIndex);
}

/** ランダム配置権の抽選のシード（その日の何枚目か: nth は 0 始まり） */
export function floorPermitSeed(runSeed: number, day: number, nth: number): number {
  return deriveSeed(runSeed, LABEL_FLOOR_PERMIT, day, nth);
}
