/**
 * 部屋の人（元弟子のスタッフ）と、ちゃんこの方針。効果の大きさは推定の調整値（docs/realism.md「若者頭・世話人」）
 *
 * - 若者頭・世話人は協会の職員で、引退した十両・幕下の力士から師匠の推薦で採用される（給与は協会が払う）。
 *   ゲームでは部屋に1人ずつ、自分の元弟子から選ぶ
 */
import type { Diet, StaffRole } from '../model/types';

export interface StaffDef {
  /** 採用できる最高位の段（元弟子の最高位がこのどれか） */
  divisions: readonly ('makuuchi' | 'juryo' | 'makushita')[];
  /** 現役の場所数の下限 */
  minBasho: number;
}

export const STAFF: Record<StaffRole, StaffDef> = {
  /** 若者頭: 若い力士の指導と監督 */
  wakaimonogashira: { divisions: ['makuuchi', 'juryo', 'makushita'], minBasho: 30 },
  /** 世話人: 用具の管理・部屋の雑務 */
  sewanin: { divisions: ['makuuchi', 'juryo', 'makushita'], minBasho: 24 },
};

export const STAFF_IDS: readonly StaffRole[] = ['wakaimonogashira', 'sewanin'];

export const STAFF_EFFECTS = {
  /** 協会の職員の定年 */
  retireAge: 65,
  /** 若者頭: 幕下以下の弟子の稽古の伸び（腕前1ごと） */
  lowerGrowthPerSkill: 0.03,
  /** 世話人: 疲れの回復とけがの減り方（腕前1ごと） */
  recoveryPerSkill: 1.5,
  injuryCutPerSkill: 0.04,
} as const;

export interface DietDef {
  /** 食費の倍率 */
  food: number;
  /** 稽古のたびの体重の増え方（kg。休養のときは増えない） */
  gainKg: number;
  /** 疲れの回復 */
  recovery: number;
  /** けがの確率の倍率 */
  injury: number;
}

export const DIETS: Record<Diet, DietDef> = {
  standard: { food: 1, gainKg: 0, recovery: 0, injury: 1 },
  /** 大盛り: 体が大きくなるが、重さで膝や腰を痛めやすい */
  hearty: { food: 1.3, gainKg: 0.8, recovery: 0, injury: 1.08 },
  /** 栄養重視: 疲れが抜けやすく、けがも減る。食費は高い */
  balanced: { food: 1.25, gainKg: 0.2, recovery: 4, injury: 0.9 },
  /** 節約: 食費は浮くが、体が大きくならず疲れも残る */
  frugal: { food: 0.75, gainKg: -0.6, recovery: -3, injury: 1.05 },
};

export const DIET_IDS: readonly Diet[] = ['standard', 'hearty', 'balanced', 'frugal'];
