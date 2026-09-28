/**
 * 連鎖演出の閾値と強さ（演出の調整はこのファイルだけで行う）
 *
 * 「桁数」は出荷した値の桁数（例: 12,345 は 5 桁）。値が大きいほど、連鎖が長いほど派手になる。
 */
import { hex, INK, SIGNAL_TIERS } from '../assets/palette';

export const EFFECTS_CONFIG = {
  /** スローモーション: 大きな出荷や、連鎖数の節目で一瞬だけ時間を遅くする */
  slowMo: {
    /** この桁数以上の出荷でスローにする */
    minShipDigits: 5,
    /** この連鎖数に達した瞬間にスローにする */
    chainMilestones: [30, 60, 100],
    /** スロー中の時間の速さ（1 = 通常） */
    timeScale: 0.3,
    /** スローの長さ（実時間ミリ秒） */
    durationMs: 650,
  },

  /** カットイン: 特に大きな出荷のときに、画面を横切る帯を出す */
  cutIn: {
    /** この桁数以上の出荷で出す（1回の再生で、より大きな桁のときだけ再表示） */
    minShipDigits: 6,
    /** 表示の長さ（実時間ミリ秒） */
    durationMs: 1300,
  },

  /** 画面の揺れ（px） */
  shake: {
    /** この桁数以上の出荷から揺らす */
    minShipDigits: 3,
    /** 1桁増えるごとの揺れ幅 */
    perDigit: 2,
    /** 爆発ドラム缶の揺れ幅 */
    barrel: 10,
    max: 18,
  },

  /** パーティクルの数 */
  particles: {
    /** 出荷: 基本数 + 桁数 × perDigit */
    shipBase: 6,
    shipPerDigit: 3,
    /** 爆発ドラム缶 */
    barrelSparks: 18,
    barrelSmoke: 6,
    max: 40,
  },

  /** 連鎖数カウンター: この連鎖数に達したら大きく弾ませて色を変える */
  chainCounter: {
    /** 表示を始める連鎖数 */
    showFrom: 3,
    milestones: [10, 20, 30, 50, 100],
    colors: [INK.white, ...SIGNAL_TIERS.slice(0, 5)].map(hex),
  },

  /**
   * 演出の強さ（設定画面で選ぶ）。数値は揺れ・パーティクルの倍率。
   * minimal ではスロー・カットインも出さない
   */
  strength: { full: 1, reduced: 0.5, minimal: 0 },
} as const;

export type EffectStrength = keyof typeof EFFECTS_CONFIG.strength;
