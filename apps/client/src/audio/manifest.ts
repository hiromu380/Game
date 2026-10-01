/**
 * サウンドマニフェスト（キー → 音の定義）
 *
 * 画面側は必ずキーで音を鳴らす。本番の音素材に差し替えるときは、kind: 'file' の定義
 * （src にファイルパス）へ書き換えるだけでよい。
 * 現在は仮SEとして、Web Audio API で合成する「レシピ」を使っている（外部素材は使わない）。
 */

/** 合成する音の1つの音符 */
export interface SynthNote {
  /** 周波数（Hz） */
  freq: number;
  /** 鳴り始め（秒。音の先頭からの時間） */
  at: number;
  /** 長さ（秒） */
  duration: number;
  /** 終わりの周波数（指定するとその高さへ滑らかに変わる） */
  slideTo?: number;
}

export interface SynthRecipe {
  /** 波形。noise はホワイトノイズ（爆発など） */
  wave: OscillatorType | 'noise';
  notes: SynthNote[];
  /** 音量（0〜1） */
  volume: number;
}

export type SoundAsset =
  | { kind: 'synth'; recipe: SynthRecipe }
  | {
      kind: 'file';
      /** 音声ファイルのパス（public/ からの相対） */
      src: string;
      volume: number;
    };

/** 効果音のキー */
export type SoundKey =
  | 'place'
  | 'rotate'
  | 'buy'
  | 'sell'
  | 'reroll'
  | 'returnPart'
  | 'error'
  | 'tick'
  | 'ship'
  | 'explode'
  | 'quotaMet'
  | 'runFailed'
  | 'runCleared'
  | 'unlock'
  | 'shiftStart'
  | 'bossAlert';

export const SOUND_ASSETS: Record<SoundKey, SoundAsset> = {
  // ---- 組み立て操作 ----
  place: {
    kind: 'synth',
    recipe: {
      wave: 'square',
      volume: 0.25,
      notes: [
        { freq: 330, at: 0, duration: 0.06 },
        { freq: 494, at: 0.05, duration: 0.07 },
      ],
    },
  },
  rotate: {
    kind: 'synth',
    recipe: {
      wave: 'triangle',
      volume: 0.3,
      notes: [{ freq: 600, at: 0, duration: 0.05, slideTo: 900 }],
    },
  },
  buy: {
    kind: 'synth',
    recipe: {
      wave: 'square',
      volume: 0.22,
      notes: [
        { freq: 988, at: 0, duration: 0.06 },
        { freq: 1319, at: 0.06, duration: 0.12 },
      ],
    },
  },
  sell: {
    kind: 'synth',
    recipe: {
      wave: 'square',
      volume: 0.22,
      notes: [
        { freq: 1319, at: 0, duration: 0.06 },
        { freq: 880, at: 0.06, duration: 0.1 },
      ],
    },
  },
  reroll: {
    kind: 'synth',
    recipe: {
      wave: 'triangle',
      volume: 0.3,
      notes: [{ freq: 400, at: 0, duration: 0.15, slideTo: 1200 }],
    },
  },
  returnPart: {
    kind: 'synth',
    recipe: {
      wave: 'triangle',
      volume: 0.3,
      notes: [{ freq: 700, at: 0, duration: 0.08, slideTo: 350 }],
    },
  },
  error: {
    kind: 'synth',
    recipe: {
      wave: 'sawtooth',
      volume: 0.15,
      notes: [
        { freq: 180, at: 0, duration: 0.12 },
        { freq: 140, at: 0.1, duration: 0.14 },
      ],
    },
  },

  // ---- 工場内放送 ----
  shiftStart: {
    kind: 'synth',
    recipe: {
      wave: 'sine',
      volume: 0.16,
      notes: [
        { freq: 659, at: 0, duration: 0.16 },
        { freq: 784, at: 0.2, duration: 0.22 },
      ],
    },
  },
  bossAlert: {
    kind: 'synth',
    recipe: {
      wave: 'square',
      volume: 0.12,
      notes: [
        { freq: 220, at: 0, duration: 0.14 },
        { freq: 220, at: 0.23, duration: 0.14 },
        { freq: 165, at: 0.46, duration: 0.28 },
      ],
    },
  },

  // ---- 再生中（音程は連鎖数に応じて上げる） ----
  tick: {
    kind: 'synth',
    recipe: { wave: 'triangle', volume: 0.12, notes: [{ freq: 440, at: 0, duration: 0.04 }] },
  },
  ship: {
    kind: 'synth',
    recipe: {
      wave: 'square',
      volume: 0.2,
      notes: [
        { freq: 784, at: 0, duration: 0.05 },
        { freq: 1175, at: 0.05, duration: 0.05 },
        { freq: 1568, at: 0.1, duration: 0.12 },
      ],
    },
  },
  explode: {
    kind: 'synth',
    recipe: { wave: 'noise', volume: 0.35, notes: [{ freq: 1, at: 0, duration: 0.35 }] },
  },

  // ---- 結果 ----
  quotaMet: {
    kind: 'synth',
    recipe: {
      wave: 'square',
      volume: 0.22,
      notes: [
        { freq: 523, at: 0, duration: 0.1 },
        { freq: 659, at: 0.1, duration: 0.1 },
        { freq: 784, at: 0.2, duration: 0.1 },
        { freq: 1047, at: 0.3, duration: 0.3 },
      ],
    },
  },
  runCleared: {
    kind: 'synth',
    recipe: {
      wave: 'square',
      volume: 0.22,
      notes: [
        { freq: 523, at: 0, duration: 0.12 },
        { freq: 659, at: 0.12, duration: 0.12 },
        { freq: 784, at: 0.24, duration: 0.12 },
        { freq: 1047, at: 0.36, duration: 0.12 },
        { freq: 1319, at: 0.48, duration: 0.12 },
        { freq: 1568, at: 0.6, duration: 0.5 },
      ],
    },
  },
  runFailed: {
    kind: 'synth',
    recipe: {
      wave: 'sawtooth',
      volume: 0.18,
      notes: [
        { freq: 392, at: 0, duration: 0.2 },
        { freq: 330, at: 0.2, duration: 0.2 },
        { freq: 262, at: 0.4, duration: 0.5, slideTo: 196 },
      ],
    },
  },
  unlock: {
    kind: 'synth',
    recipe: {
      wave: 'triangle',
      volume: 0.3,
      notes: [
        { freq: 880, at: 0, duration: 0.08 },
        { freq: 1109, at: 0.08, duration: 0.08 },
        { freq: 1319, at: 0.16, duration: 0.25 },
      ],
    },
  },
};

/** BGM のキー（仕組みのみ。曲はまだ入れていない） */
export type BgmKey = 'building' | 'result';

/** BGM の定義。曲を入れるときは { kind: 'file', src, volume } を設定する */
export const BGM_ASSETS: Record<BgmKey, SoundAsset | null> = {
  building: null,
  result: null,
};

/** 連鎖が続くほど音程を上げる: 連鎖数 → 半音の数（上限あり） */
export const CHAIN_PITCH = {
  /** 何連鎖ごとに半音上げるか */
  chainsPerSemitone: 2,
  /** 上げる上限（半音） */
  maxSemitones: 24,
};

/** 連鎖数から、上げる音程（半音の数）を求める */
export function chainSemitones(chainCount: number): number {
  return Math.min(CHAIN_PITCH.maxSemitones, Math.floor(chainCount / CHAIN_PITCH.chainsPerSemitone));
}
