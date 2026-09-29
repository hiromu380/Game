/**
 * デイリーチャレンジの RunConfig を組み立てる
 *
 * - 全員同じ条件: メタ進行の層は外す（全パーツ・7×7）。延長戦なし
 * - 1日＝3シフト（balance/ の daily.shifts）
 * - 床のステージ: デイリーのシードから、2日目相当の帯（balance/stages.ts の dailyBand）で1日分を生成する
 * - 今日の特殊ルール: ボス修正ルールの仕組みを流用し、3シフト全体にかける（デイリーの ID から決定論的に選ぶ）
 * - 価格: その日の相場（サーバーから渡す。なければ基準価格）
 * - 本番シードはサーバーの秘密値から作るため、commitSeedMode は external（練習モードは derived）
 *
 * ランシード（ショップ・ボス・試運転用）はデイリーの ID から作る公開値。全員に同じショップが並ぶ。
 */
import { BALANCE, type Balance } from '../balance';
import { createPrng, deriveSeed, hashString } from '../core/prng';
import { bossSeed } from '../run/seeds';
import type { PartId } from '../types';
import { buildRunConfig, drawBoss, type RunConfig } from './runConfig';

/** 特殊ルールの抽選に使う派生ラベル（用途別シードのラベル 1〜5 と重ならない値） */
const LABEL_SPECIAL_RULE = 6;

/** デイリーの ID（例: '2026-09-28'）から、全員共通のランシードを作る */
export function dailyRunSeed(dailyId: string): number {
  return hashString(`daily:${dailyId}`);
}

export interface DailyConfigInput {
  dailyId: string;
  /** その日の相場価格（省略時は基準価格） */
  prices?: Partial<Record<PartId, number>>;
  /** 練習モード用（本番シードをクライアント側で作る） */
  practice?: boolean;
  balance?: Balance;
}

export function buildDailyConfig({
  dailyId,
  prices = {},
  practice = false,
  balance = BALANCE,
}: DailyConfigInput): RunConfig {
  const runSeed = dailyRunSeed(dailyId);
  // メタ進行は渡さない（全パーツ・7×7）。シフト表だけデイリー用に差し替える
  const base = buildRunConfig({
    balance: { ...balance, shifts: balance.daily.shifts },
    bossSeed: bossSeed(runSeed),
    runSeed,
    stageBands: [balance.stages.dailyBand],
  });

  const globalModifier = drawBoss(
    createPrng(deriveSeed(runSeed, LABEL_SPECIAL_RULE)),
    { ...base.bossParams, candidates: [...balance.daily.specialRules] },
    base.board,
    null,
    base.stages?.days[0],
  );

  return {
    ...base,
    economy: { ...base.economy, prices: { ...base.economy.prices, ...prices } },
    globalModifier,
    commitSeedMode: practice ? 'derived' : 'external',
    mode: practice ? 'practice' : 'daily',
    overtimeAllowed: false,
  };
}
