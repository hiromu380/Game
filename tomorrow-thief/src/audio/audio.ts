/**
 * 音（Web Audio API で合成する。外部の音素材は使わない）
 *
 * 音量は「全体・音楽・効果音」を別々に調整できる。
 * 通常の音楽: ピアノ風の和音・控えめな金管・ブラシ風のノイズ・遠くの時計の音
 */
import type { Settings } from '../save';

export type SoundId =
  | 'lever'
  | 'reelTick'
  | 'reelStop'
  | 'winSmall'
  | 'winBig'
  | 'jackpotThud'
  | 'jackpotBrass'
  | 'coin'
  | 'rewind'
  | 'footstep'
  | 'alert'
  | 'hurt'
  | 'shockwave'
  | 'dodge'
  | 'buy'
  | 'door'
  | 'miss'
  | 'clockGlitch';

export class Audio {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private bgmGain!: GainNode;
  private seGain!: GainNode;
  private noise!: AudioBuffer;
  private bgmTimer: number | null = null;
  private bgmStep = 0;
  private settings: Settings;

  constructor(settings: Settings) {
    this.settings = settings;
  }

  /** ユーザー操作の後に呼ぶ（ブラウザの自動再生の制限） */
  unlock(): void {
    if (this.ctx) {
      void this.ctx.resume();
      return;
    }
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.bgmGain = this.ctx.createGain();
    this.seGain = this.ctx.createGain();
    this.bgmGain.connect(this.master);
    this.seGain.connect(this.master);
    this.master.connect(this.ctx.destination);
    const len = this.ctx.sampleRate;
    this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = this.noise.getChannelData(0);
    let seed = 1;
    for (let i = 0; i < len; i++) {
      seed = (seed * 16807) % 2147483647;
      data[i] = (seed / 2147483647) * 2 - 1;
    }
    this.apply(this.settings);
  }

  apply(settings: Settings): void {
    this.settings = settings;
    if (!this.ctx) return;
    this.master.gain.value = settings.master;
    this.bgmGain.gain.value = settings.bgm * 0.5;
    this.seGain.gain.value = settings.se;
  }

  private tone(
    freq: number,
    at: number,
    dur: number,
    opts: { type?: OscillatorType; vol?: number; to?: number; out?: GainNode; attack?: number } = {},
  ) {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = opts.type ?? 'sine';
    const t0 = ctx.currentTime + at;
    osc.frequency.setValueAtTime(freq, t0);
    if (opts.to) osc.frequency.exponentialRampToValueAtTime(opts.to, t0 + dur);
    const vol = opts.vol ?? 0.2;
    const attack = opts.attack ?? 0.005;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g).connect(opts.out ?? this.seGain);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  private hiss(at: number, dur: number, opts: { vol?: number; freq?: number; q?: number; out?: GainNode; reverse?: boolean } = {}) {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = opts.freq ?? 2000;
    filter.Q.value = opts.q ?? 1;
    const g = ctx.createGain();
    const t0 = ctx.currentTime + at;
    const vol = opts.vol ?? 0.15;
    if (opts.reverse) {
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(vol, t0 + dur * 0.9);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    } else {
      g.gain.setValueAtTime(vol, t0);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    }
    src.connect(filter).connect(g).connect(opts.out ?? this.seGain);
    src.start(t0, Math.random() * 0.5, dur + 0.05);
  }

  /** 効果音。volume は距離などによる追加の音量（0〜1） */
  play(id: SoundId, volume = 1): void {
    if (!this.ctx || volume <= 0) return;
    const v = volume;
    switch (id) {
      case 'lever':
        this.hiss(0, 0.08, { vol: 0.2 * v, freq: 1200 });
        this.tone(140, 0.05, 0.12, { type: 'square', vol: 0.12 * v, to: 90 });
        break;
      case 'reelTick':
        this.tone(1800, 0, 0.02, { type: 'square', vol: 0.03 * v });
        break;
      case 'reelStop':
        this.tone(320, 0, 0.08, { type: 'triangle', vol: 0.18 * v, to: 220 });
        break;
      case 'miss':
        this.tone(220, 0, 0.25, { type: 'triangle', vol: 0.1 * v, to: 180 });
        break;
      case 'winSmall':
        [659, 784, 988].forEach((f, i) => this.tone(f, i * 0.07, 0.18, { type: 'triangle', vol: 0.14 * v }));
        break;
      case 'winBig':
        [523, 659, 784, 1047, 1319].forEach((f, i) => this.tone(f, i * 0.08, 0.3, { type: 'triangle', vol: 0.16 * v }));
        break;
      case 'jackpotThud':
        this.tone(70, 0, 0.6, { type: 'sine', vol: 0.5 * v, to: 40 });
        this.hiss(0, 0.3, { vol: 0.25 * v, freq: 300 });
        break;
      case 'jackpotBrass':
        // 金管の歓声: のこぎり波の和音を重ねる
        [
          [392, 0],
          [523, 0.12],
          [659, 0.24],
          [784, 0.36],
          [1047, 0.6],
        ].forEach(([f, at]) => {
          this.tone(f!, at!, 0.9, { type: 'sawtooth', vol: 0.07 * v, attack: 0.04 });
          this.tone(f! * 1.005, at!, 0.9, { type: 'sawtooth', vol: 0.05 * v, attack: 0.04 });
        });
        break;
      case 'coin':
        this.tone(2400 + Math.random() * 600, 0, 0.06, { type: 'square', vol: 0.05 * v });
        this.tone(3600, 0.02, 0.05, { type: 'sine', vol: 0.04 * v });
        break;
      case 'rewind':
        // 時計を開く音 → 逆回しの吸い込み
        this.tone(1200, 0, 0.05, { type: 'square', vol: 0.08 * v });
        this.hiss(0.02, 0.75, { vol: 0.22 * v, freq: 900, q: 0.7, reverse: true });
        this.tone(220, 0.05, 0.7, { type: 'sine', vol: 0.12 * v, to: 880 });
        for (let i = 0; i < 8; i++) this.tone(2200 - i * 120, 0.06 + i * 0.08, 0.03, { type: 'square', vol: 0.04 * v });
        break;
      case 'footstep':
        this.tone(95, 0, 0.09, { type: 'sine', vol: 0.35 * v, to: 60 });
        this.hiss(0, 0.05, { vol: 0.12 * v, freq: 600 });
        break;
      case 'alert':
        this.tone(880, 0, 0.12, { type: 'square', vol: 0.08 * v });
        this.tone(660, 0.12, 0.14, { type: 'square', vol: 0.08 * v });
        break;
      case 'hurt':
        this.tone(200, 0, 0.25, { type: 'sawtooth', vol: 0.15 * v, to: 80 });
        break;
      case 'shockwave':
        this.tone(600, 0, 0.35, { type: 'sine', vol: 0.18 * v, to: 120 });
        this.hiss(0, 0.3, { vol: 0.12 * v, freq: 1500 });
        break;
      case 'dodge':
        this.hiss(0, 0.12, { vol: 0.1 * v, freq: 3000 });
        break;
      case 'buy':
        [988, 1319].forEach((f, i) => this.tone(f, i * 0.08, 0.15, { type: 'triangle', vol: 0.12 * v }));
        break;
      case 'door':
        this.tone(180, 0, 0.2, { type: 'triangle', vol: 0.1 * v, to: 140 });
        break;
      case 'clockGlitch':
        for (let i = 0; i < 5; i++) this.tone(1500 - i * 200, i * 0.1, 0.04, { type: 'square', vol: 0.06 * v });
        break;
    }
  }

  /** 通常の音楽（ゆったりした和音の循環。8拍ごとにコードが変わる） */
  startBgm(): void {
    if (!this.ctx || this.bgmTimer !== null) return;
    const chords = [
      [220, 261.6, 329.6, 392],
      [174.6, 220, 261.6, 329.6],
      [196, 246.9, 293.7, 349.2],
      [164.8, 207.7, 246.9, 329.6],
    ];
    const beat = 0.5;
    this.bgmTimer = window.setInterval(() => {
      if (!this.ctx || this.ctx.state !== 'running') return;
      const step = this.bgmStep++;
      const chord = chords[Math.floor(step / 8) % chords.length]!;
      const out = this.bgmGain;
      // ピアノ風の分散和音
      if (step % 2 === 0) {
        const note = chord[(step / 2) % chord.length]!;
        this.tone(note * 2, 0, 1.4, { type: 'triangle', vol: 0.06, out });
        this.tone(note * 4, 0, 0.6, { type: 'sine', vol: 0.015, out });
      }
      // 低音
      if (step % 8 === 0) this.tone(chord[0]! / 2, 0, 3.5, { type: 'sine', vol: 0.09, out, attack: 0.05 });
      // 控えめな金管（長い和音）
      if (step % 16 === 4) {
        this.tone(chord[1]!, 0, 2.5, { type: 'sawtooth', vol: 0.012, out, attack: 0.4 });
        this.tone(chord[2]!, 0, 2.5, { type: 'sawtooth', vol: 0.01, out, attack: 0.4 });
      }
      // ブラシ
      this.hiss(0, step % 2 === 1 ? 0.18 : 0.08, { vol: step % 4 === 2 ? 0.05 : 0.025, freq: 5000, q: 0.5, out });
      // 遠くの時計
      if (step % 4 === 0) this.tone(2600, 0, 0.03, { type: 'square', vol: 0.012, out });
    }, beat * 500);
  }

  stopBgm(): void {
    if (this.bgmTimer !== null) window.clearInterval(this.bgmTimer);
    this.bgmTimer = null;
  }

  /** ポーズ中は音も止める */
  suspend(paused: boolean): void {
    if (!this.ctx) return;
    if (paused) void this.ctx.suspend();
    else void this.ctx.resume();
  }
}
