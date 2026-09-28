/**
 * 音を鳴らす仕組み（Web Audio API）
 *
 * - 効果音: サウンドマニフェストのレシピから合成するか、ファイルを再生する
 * - BGM: 仕組みのみ（BGM_ASSETS に曲が設定されていれば、ループ再生する）
 * - 音量: マスター × 効果音 / BGM の2段。ミュートあり
 *
 * ブラウザは「ユーザーが操作するまで音を出せない」ため、AudioContext は最初に鳴らすときに作る。
 */
import { BGM_ASSETS, SOUND_ASSETS, type BgmKey, type SoundKey, type SynthRecipe } from './manifest';

export interface VolumeSettings {
  masterVolume: number;
  seVolume: number;
  bgmVolume: number;
  muted: boolean;
}

/** 同じ効果音を短い間に何度も鳴らさない間隔（秒）。信号が多いときにうるさくならないように */
const MIN_INTERVAL_SEC = 0.03;

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private seBus: GainNode | null = null;
  private bgmBus: GainNode | null = null;
  private volumes: VolumeSettings = { masterVolume: 80, seVolume: 80, bgmVolume: 60, muted: false };
  private lastPlayed = new Map<SoundKey, number>();
  private fileBuffers = new Map<string, Promise<AudioBuffer>>();
  private bgmSource: AudioBufferSourceNode | null = null;

  /** AudioContext を用意する（初回だけ作る）。音が出せない環境では null */
  private ensureContext(): AudioContext | null {
    if (this.ctx) return this.ctx;
    const Ctor = typeof window !== 'undefined' ? window.AudioContext : undefined;
    if (!Ctor) return null;
    this.ctx = new Ctor();
    this.master = this.ctx.createGain();
    this.seBus = this.ctx.createGain();
    this.bgmBus = this.ctx.createGain();
    this.seBus.connect(this.master);
    this.bgmBus.connect(this.master);
    this.master.connect(this.ctx.destination);
    this.applyVolumes();
    return this.ctx;
  }

  setVolumes(volumes: VolumeSettings): void {
    this.volumes = volumes;
    this.applyVolumes();
  }

  private applyVolumes(): void {
    if (!this.master || !this.seBus || !this.bgmBus) return;
    const v = this.volumes;
    this.master.gain.value = v.muted ? 0 : v.masterVolume / 100;
    this.seBus.gain.value = v.seVolume / 100;
    this.bgmBus.gain.value = v.bgmVolume / 100;
  }

  /**
   * 効果音を鳴らす
   * @param semitones 音程を上げる半音の数（連鎖が続くほど高くする）
   */
  play(key: SoundKey, semitones = 0): void {
    if (this.volumes.muted) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.seBus) return;
    if (ctx.state === 'suspended') void ctx.resume();

    const now = ctx.currentTime;
    if (now - (this.lastPlayed.get(key) ?? -1) < MIN_INTERVAL_SEC) return;
    this.lastPlayed.set(key, now);

    const asset = SOUND_ASSETS[key];
    const rate = 2 ** (semitones / 12);
    if (asset.kind === 'synth') this.playRecipe(ctx, this.seBus, asset.recipe, rate);
    else void this.playFile(ctx, this.seBus, asset.src, asset.volume, rate, false);
  }

  /** BGM を流す（曲が設定されていなければ何もしない） */
  playBgm(key: BgmKey | null): void {
    this.bgmSource?.stop();
    this.bgmSource = null;
    const asset = key ? BGM_ASSETS[key] : null;
    const ctx = asset ? this.ensureContext() : null;
    if (!asset || !ctx || !this.bgmBus || asset.kind !== 'file') return;
    void this.playFile(ctx, this.bgmBus, asset.src, asset.volume, 1, true).then((source) => {
      this.bgmSource = source;
    });
  }

  /** レシピから音を合成して鳴らす */
  private playRecipe(ctx: AudioContext, out: AudioNode, recipe: SynthRecipe, rate: number): void {
    const start = ctx.currentTime;
    for (const note of recipe.notes) {
      const t0 = start + note.at;
      const t1 = t0 + note.duration;
      const gain = ctx.createGain();
      // 短いアタックと減衰（プツッというノイズを防ぐ）
      gain.gain.setValueAtTime(0, t0);
      gain.gain.linearRampToValueAtTime(recipe.volume, t0 + 0.005);
      gain.gain.exponentialRampToValueAtTime(0.0001, t1);
      gain.connect(out);

      if (recipe.wave === 'noise') {
        const source = ctx.createBufferSource();
        source.buffer = this.noiseBuffer(ctx, note.duration);
        // 爆発っぽく低音寄りにする
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(1800 * rate, t0);
        filter.frequency.exponentialRampToValueAtTime(200, t1);
        source.connect(filter).connect(gain);
        source.start(t0);
        source.stop(t1);
        continue;
      }

      const osc = ctx.createOscillator();
      osc.type = recipe.wave;
      osc.frequency.setValueAtTime(note.freq * rate, t0);
      if (note.slideTo) osc.frequency.exponentialRampToValueAtTime(note.slideTo * rate, t1);
      osc.connect(gain);
      osc.start(t0);
      osc.stop(t1 + 0.02);
    }
  }

  private noiseBuffer(ctx: AudioContext, duration: number): AudioBuffer {
    const length = Math.ceil(ctx.sampleRate * duration);
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    // 見た目・音専用の乱数（シミュレーションとは無関係）
    for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
    return buffer;
  }

  /** 音声ファイルを読み込んで鳴らす（本番素材用） */
  private async playFile(
    ctx: AudioContext,
    out: AudioNode,
    src: string,
    volume: number,
    rate: number,
    loop: boolean,
  ): Promise<AudioBufferSourceNode> {
    let buffer = this.fileBuffers.get(src);
    if (!buffer) {
      buffer = fetch(src)
        .then((r) => r.arrayBuffer())
        .then((data) => ctx.decodeAudioData(data));
      this.fileBuffers.set(src, buffer);
    }
    const source = ctx.createBufferSource();
    source.buffer = await buffer;
    source.playbackRate.value = rate;
    source.loop = loop;
    const gain = ctx.createGain();
    gain.gain.value = volume;
    source.connect(gain).connect(out);
    source.start();
    return source;
  }
}

/** アプリ全体で1つだけ使う */
export const audio = new AudioEngine();
