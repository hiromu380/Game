/**
 * 週替わりチャレンジの RunConfig を組み立てる
 *
 * - 全員同じ条件: メタ進行の層は外す（全パーツ・7×7）。延長戦なし
 * - 1回の挑戦＝3シフト（balance/ の weekly.shifts）。その週の全員・全日で同じ設定
 * - 床のステージ: 週のシードから、2日目相当の帯（balance/stages.ts の weeklyBand）で1日分を生成する
 * - 今週の特殊ルール: ボス修正ルールの仕組みを流用し、3シフト全体にかける（週の ID から決定論的に選ぶ）
 * - 価格: その週の相場（サーバーが週の切り替えで確定して渡す。なければ基準価格）
 * - 本番シードはサーバーの秘密値から作るため、commitSeedMode は external（練習モードは derived）
 *
 * ランシード（ショップ・ボス・試運転用）は週の ID と候補番号から作る公開値。全員に同じショップが並ぶ。
 * 候補番号: 公開前の自動検証（サーバーのジョブ）で不合格なら 1, 2, … と引き直す。
 * fallback: 引き直しの上限に達したときの代替設定（やさしい帯のステージ・特殊ルールなし）
 */
import { BALANCE, type Balance } from '../balance';
import { createPrng, deriveSeed, hashString } from '../core/prng';
import { bossSeed } from '../run/seeds';
import type { PartId } from '../types';
import { buildRunConfig, drawBoss, type RunConfig } from './runConfig';

/** 特殊ルールの抽選に使う派生ラベル（用途別シードのラベル 1〜5 と重ならない値） */
const LABEL_SPECIAL_RULE = 6;

/** 週の ID（週の開始日。例: '2026-10-05'）と候補番号から、全員共通のランシードを作る */
export function weeklyRunSeed(weekId: string, candidate = 0): number {
  return hashString(`weekly:${weekId}:${candidate}`);
}

export interface WeeklyConfigInput {
  weekId: string;
  /** 自動検証で引き直した回数（0 から） */
  candidate?: number;
  /** 引き直しの上限に達したときの代替設定 */
  fallback?: boolean;
  /** その週の相場価格（省略時は基準価格） */
  prices?: Partial<Record<PartId, number>>;
  /** 練習モード用（本番シードをクライアント側で作る） */
  practice?: boolean;
  balance?: Balance;
}

export function buildWeeklyConfig({
  weekId,
  candidate = 0,
  fallback = false,
  prices = {},
  practice = false,
  balance = BALANCE,
}: WeeklyConfigInput): RunConfig {
  const runSeed = weeklyRunSeed(weekId, fallback ? -1 : candidate);
  // メタ進行は渡さない（全パーツ・7×7）。シフト表だけ週替わり用に差し替える
  const base = buildRunConfig({
    balance: { ...balance, shifts: balance.weekly.shifts },
    bossSeed: bossSeed(runSeed),
    runSeed,
    stageBands: [fallback ? balance.stages.weeklyFallbackBand : balance.stages.weeklyBand],
  });

  const globalModifier = fallback
    ? null
    : drawBoss(
        createPrng(deriveSeed(runSeed, LABEL_SPECIAL_RULE)),
        { ...base.bossParams, candidates: [...balance.weekly.specialRules] },
        base.board,
        null,
        base.stages?.days[0],
      );

  return {
    ...base,
    economy: { ...base.economy, prices: { ...base.economy.prices, ...prices } },
    globalModifier,
    // ランダム配置権を週替わりにも出すか（balance/floors.ts の inWeekly）
    floorPermit: balance.floorPermit.inWeekly ? base.floorPermit : undefined,
    commitSeedMode: practice ? 'derived' : 'external',
    mode: practice ? 'practice' : 'weekly',
    overtimeAllowed: false,
  };
}
