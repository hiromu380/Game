/**
 * 部屋の設備と契約（お金の使い道）。金額はすべて推定（docs/realism.md「設備と契約」）
 *
 * - build: 一度払えば残る（建物）。レベルは上げるだけ
 * - contract: 場所ごとに払い続ける（人との契約）。いつでも上げ下げできる
 */
import type { FacilityId } from '../model/types';

export interface FacilityDef {
  kind: 'build' | 'contract';
  /** レベルごとの費用（build: 建てる費用 / contract: 場所ごとの費用）。長さ = 最大レベル */
  costs: readonly number[];
  /** 場所ごとの維持費（build のレベルあたり） */
  upkeepPerLevel: number;
}

export const FACILITIES: Record<FacilityId, FacilityDef> = {
  /** 寮の増築: 住める力士の数が増える */
  dorm: { kind: 'build', costs: [80_000_000, 150_000_000], upkeepPerLevel: 300_000 },
  /** 稽古場の改修（土俵・鉄砲柱・器具）: 稽古の伸びが増える */
  dojo: { kind: 'build', costs: [30_000_000, 60_000_000, 100_000_000], upkeepPerLevel: 100_000 },
  /** トレーナー・治療院との契約: けがをしにくく、疲れが抜けやすい */
  trainer: { kind: 'contract', costs: [500_000, 1_000_000], upkeepPerLevel: 0 },
  /** スカウトの網（高校・大学・各地の相撲関係者とのつながり）: 入門希望者が増え、見立てが正確になる */
  scout: { kind: 'contract', costs: [400_000, 900_000], upkeepPerLevel: 0 },
};

export const FACILITY_EFFECTS = {
  /** 寮: レベルごとに住める人数 */
  dormCapacityPerLevel: 10,
  /** 稽古場: レベルごとの伸びの倍率 */
  dojoGrowthPerLevel: 0.04,
  /** トレーナー: レベルごとのけがの減り方と疲れの回復 */
  trainerInjuryCutPerLevel: 0.2,
  trainerRecoveryPerLevel: 3,
  /** スカウト: 見立ての誤差の幅（素質の ±。入門希望者の増え方は balance/career.ts） */
  scoutNoiseByLevel: [10, 6, 3] as const,
};
