/**
 * BGM（合成するループ曲。外部素材は使わない）
 *
 * 曲は「小節ごとの和音」と「パート（ベース・和音・アルペジオ・打楽器）」のレシピで書く。
 * 鳴らす音の一覧は bgmBarNotes（純粋関数）で求め、AudioEngine が少し先まで予約して鳴らす。
 * 同じレシピ・同じ小節からは、いつも同じ音の並びになる（乱数は使わない）。
 */

export type BgmKey = 'building' | 'night' | 'result';

export type BgmWave = OscillatorType | 'noise';

/** パートの種類（和音のどの音を、どのリズムで鳴らすか） */
export interface BgmPart {
  kind: 'bass' | 'pad' | 'arp' | 'hat' | 'kick' | 'clank';
  wave: BgmWave;
  /** 音量（0〜1。BGM のバスでさらに下げる） */
  volume: number;
  /** 何オクターブずらすか（和音の音に足す） */
  octave?: number;
  /** ローパスの周波数（Hz。こもらせて工場の奥で鳴っている感じにする） */
  lowpass?: number;
  /** 鳴らす拍（16分音符の位置 0〜15）。省略時はパートの既定 */
  steps?: number[];
  /** 1音の長さ（16分音符いくつ分） */
  length?: number;
  /** 鳴らす小節（ループの何小節目か。省略時は全部） */
  bars?: number[];
}

export interface BgmRecipe {
  bpm: number;
  /** 小節ごとの和音（MIDI ノート番号。先頭が根音） */
  chords: number[][];
  parts: BgmPart[];
}

/** 予約する1音（小節の頭からの秒・周波数・長さ） */
export interface BgmNote {
  at: number;
  freq: number;
  duration: number;
  wave: BgmWave;
  volume: number;
  lowpass: number | null;
}

const midiToFreq = (midi: number) => 440 * 2 ** ((midi - 69) / 12);

/** 1小節の長さ（秒。4/4 拍子） */
export function barSeconds(recipe: BgmRecipe): number {
  return (60 / recipe.bpm) * 4;
}

const DEFAULT_STEPS: Record<BgmPart['kind'], number[]> = {
  bass: [0, 6, 8, 14],
  pad: [0],
  arp: [0, 2, 4, 6, 8, 10, 12, 14],
  hat: [2, 6, 10, 14],
  kick: [0, 8],
  clank: [12],
};
const DEFAULT_LENGTH: Record<BgmPart['kind'], number> = {
  bass: 2,
  pad: 16,
  arp: 1.5,
  hat: 0.5,
  kick: 1,
  clank: 1,
};

/** ループの bar 小節目（0 始まり。和音の数で一周する）に鳴らす音 */
export function bgmBarNotes(recipe: BgmRecipe, bar: number): BgmNote[] {
  const index = ((bar % recipe.chords.length) + recipe.chords.length) % recipe.chords.length;
  const chord = recipe.chords[index] ?? [];
  const step = barSeconds(recipe) / 16;
  const notes: BgmNote[] = [];
  for (const part of recipe.parts) {
    if (part.bars && !part.bars.includes(index)) continue;
    const steps = part.steps ?? DEFAULT_STEPS[part.kind];
    const duration = (part.length ?? DEFAULT_LENGTH[part.kind]) * step;
    const shift = (part.octave ?? 0) * 12;
    const base = {
      wave: part.wave,
      volume: part.volume,
      lowpass: part.lowpass ?? null,
      duration,
    };
    steps.forEach((s, i) => {
      const at = s * step;
      switch (part.kind) {
        case 'bass':
          notes.push({ ...base, at, freq: midiToFreq((chord[0] ?? 45) + shift) });
          break;
        case 'pad':
          for (const midi of chord) notes.push({ ...base, at, freq: midiToFreq(midi + shift) });
          break;
        case 'arp': {
          // 和音の音を下から順にたどる（上がって下がる）
          const order = [...chord, ...chord.slice(1, -1).reverse()];
          notes.push({ ...base, at, freq: midiToFreq((order[i % order.length] ?? 57) + shift) });
          break;
        }
        case 'hat':
        case 'clank':
          notes.push({ ...base, at, freq: part.kind === 'hat' ? 8000 : 900 });
          break;
        case 'kick':
          notes.push({ ...base, at, freq: 55 });
          break;
      }
    });
  }
  return notes.sort((a, b) => a.at - b.at);
}

// ---------------------------------------------------------------------------
// 曲（A マイナー中心。工場の奥で鳴っているような、こもった低い音）
// ---------------------------------------------------------------------------

const Am = [45, 52, 57, 60];
const F = [41, 48, 53, 57];
const C = [48, 52, 55, 60];
const E = [40, 47, 52, 56];
const Dm = [38, 50, 53, 57];
const Bb = [46, 50, 53, 58];
const G = [43, 50, 55, 59];

export const BGM_RECIPES: Record<BgmKey, BgmRecipe> = {
  /** 組み立て中: 落ち着いて考えられる、ゆっくりした反復 */
  building: {
    bpm: 84,
    chords: [Am, Am, F, E, Am, Dm, F, E],
    parts: [
      { kind: 'pad', wave: 'triangle', volume: 0.035, lowpass: 900 },
      { kind: 'bass', wave: 'triangle', volume: 0.09, octave: -1, lowpass: 500 },
      {
        kind: 'arp',
        wave: 'square',
        volume: 0.02,
        octave: 1,
        lowpass: 1400,
        bars: [1, 3, 5, 7],
      },
      { kind: 'hat', wave: 'noise', volume: 0.012 },
      { kind: 'clank', wave: 'noise', volume: 0.03, bars: [3, 7] },
    ],
  },
  /** 夜シフト（ボス）: 速く、半音のぶつかりで不穏に。四つ打ちの低い鼓動 */
  night: {
    bpm: 100,
    chords: [Am, Bb, Am, E],
    parts: [
      { kind: 'pad', wave: 'sawtooth', volume: 0.02, lowpass: 700 },
      {
        kind: 'bass',
        wave: 'sawtooth',
        volume: 0.06,
        octave: -1,
        lowpass: 380,
        steps: [0, 3, 6, 8, 11, 14],
      },
      { kind: 'kick', wave: 'sine', volume: 0.12, steps: [0, 4, 8, 12] },
      { kind: 'hat', wave: 'noise', volume: 0.014, steps: [2, 6, 10, 14] },
      { kind: 'arp', wave: 'square', volume: 0.018, octave: 1, lowpass: 1200, bars: [1, 3] },
    ],
  },
  /** 結果画面: ゆっくり、少しだけ明るい終わり方 */
  result: {
    bpm: 72,
    chords: [F, G, C, Am],
    parts: [
      { kind: 'pad', wave: 'sine', volume: 0.045, lowpass: 1600 },
      { kind: 'bass', wave: 'triangle', volume: 0.07, octave: -1, steps: [0, 8], length: 6 },
      { kind: 'arp', wave: 'sine', volume: 0.03, octave: 2, steps: [0, 4, 8, 12], length: 3 },
    ],
  },
};
