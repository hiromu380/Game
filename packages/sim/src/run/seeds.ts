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
