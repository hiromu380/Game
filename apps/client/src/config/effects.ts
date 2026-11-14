/**
 * 連鎖演出の閾値と強さ（演出の調整はこのファイルだけで行う）
 *
 * 「桁数」は出荷した値の桁数（例: 12,345 は 5 桁）。値が大きいほど、連鎖が長いほど派手になる。
 * 時間の流れ（溜め・加速・ピークの止め・上限時間・光の回数）は choreography にまとめる。
 */
import { hex, INK, SIGNAL_TIERS } from '../assets/palette';

export const EFFECTS_CONFIG = {
  /** カットイン: 特に大きな出荷のときに、画面を横切る帯を出す */
  cutIn: {
    /** この桁数以上の出荷で出す（1回の再生で、より大きな桁のときだけ再表示） */
    minShipDigits: 6,
    /** 表示の長さ（実時間ミリ秒） */
    durationMs: 1300,
  },

  /** 計測不能（合計が balance/ の桁数に達した）: 警告の帯と、震える「計測不能」の文字 */
  unmeasurable: {
    durationMs: 1900,
    bandHeight: 120,
    /** 文字の震えの幅（px。演出の強さで増減。「弱」では震えない） */
    jitterPx: 5,
    /** 揺れ（px） */
    shake: 26,
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
    /** 同時に出せるパーティクルの上限（使い回し。board/fx/particlePool.ts） */
    maxAlive: 240,
  },

  /** 金色パーツへの合体: 消える2マスから光の粒が集まり（gatherMs）、金の輪が広がる（ringMs） */
  merge: {
    gatherMs: 260,
    ringMs: 500,
    /** 消えるマス1つあたりの粒・合体後に散る火花の数（演出の強さで増減） */
    dotsPerCell: 6,
    sparks: 14,
    sparksMs: 520,
  },

  /** 連鎖数カウンター: この連鎖数に達したら大きく弾ませて色を変える */
  chainCounter: {
    /** 表示を始める連鎖数 */
    showFrom: 3,
    milestones: [10, 20, 30, 50, 100],
    colors: [INK.white, ...SIGNAL_TIERS.slice(0, 5)].map(hex),
  },

  /**
   * 演出の強さ（設定画面で選ぶ。full = 強・reduced = 中・minimal = 弱）。数値は揺れ・パーティクルの倍率。
   * minimal ではカットインも出さない
   */
  strength: { full: 1, reduced: 0.5, minimal: 0 },

  /** 画面上部の出荷量のカウントアップの長さ（ミリ秒。ui/useCountUp.ts） */
  countUpMs: 450,

  /**
   * 連鎖の演出の流れ（playback/choreography.ts）。時間はすべて再生速度 1x のときのミリ秒
   */
  choreography: {
    /** 押した直後の溜め（光が集まり、低い音が鳴る）。強さごと */
    windupMs: { full: 420, reduced: 250, minimal: 0 },
    /** 1 tick の長さ: 最初は baseTickMs、連鎖が1つ進むごとに accelPercent% に縮み、minTickMs で止まる */
    tempo: { baseTickMs: 320, accelPercent: 94, minTickMs: 110 },
    /**
     * 演出全体（溜めとピーク・スタンプを除く）の上限。これを超える連鎖は、tick を一律に短くし（compressedMinTickMs まで）、
     * それでも収まらない分は要所（最後の出荷の少し前）まで一気に進める
     */
    maxTotalMs: 8000,
    compressedMinTickMs: 40,
    /** 要所まで一気に進めたあと、最後に見せる長さ */
    tailMs: 1800,
    /** ピーク（最後の出荷）で一瞬止める長さ。強さごと */
    hitstopMs: { full: 110, reduced: 60, minimal: 0 },
    /** 最後の「ドン」（合計の表示）の長さ */
    stampMs: 900,
    /** 盤面の光（ピーク・ノルマ超え・桁上がり）の強さ。不透明度の上限（強さごと）と、1回の長さ */
    flash: { alpha: { full: 0.35, reduced: 0.2, minimal: 0 }, durationMs: 260 },
    /** 点滅の上限（光過敏性への配慮）: 1秒あたりの回数 */
    maxFlashesPerSecond: 3,
    /** 撮影モードの「ピークから再生」: ピークの何ミリ秒前から見せるか（X の動画で最初の2秒に山場を入れる） */
    capturePeakLeadMs: 1500,
    /** 倍率の数字（×2・+8）を浮かべる数の上限と、同じ時刻に重ならない間隔 */
    multiplierPops: { max: 30, minGapMs: 45 },
    /** 連鎖の音: 1連鎖ごとに半音上がる（上限あり）。stepsPerTimbre 段ごとに音色を変える */
    notes: { maxSemitones: 24, stepsPerTimbre: 8, timbres: 3 },
  },
  /**
   * ランダム配置権のルーレット: 枠が跳ぶ回数（演出の強さごと。1 なら跳ばずに止まる）と、1回の間隔・最後の減速
   * （強で合計およそ 0.9 秒）
   */
  permitRoulette: {
    hops: { full: 10, reduced: 6, minimal: 1 },
    baseHopMs: 55,
    slowdownMs: 140,
  },
} as const;

export type EffectStrength = keyof typeof EFFECTS_CONFIG.strength;

/** 操作の手応えの短い表示（購入 −3円 など）を出しておく時間（ミリ秒） */
export const FEEDBACK_NOTE_MS = 1600;
