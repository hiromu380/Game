/**
 * 音を鳴らす仕組み（Web Audio API）
 *
 * - 効果音: サウンドマニフェストのレシピから合成するか、ファイルを再生する
 * - BGM: audio/bgm.ts のレシピから合成し、少し先まで予約しながらループする（BGM_ASSETS にファイルがあればそちら）
 * - 音量: マスター × 効果音 / BGM の2段。ミュートあり
 *
 * ブラウザは「ユーザーが操作するまで音を出せない」ため、AudioContext は最初に鳴らすときに作る。
 * 画面が隠れている間は止める（watchLifecycle）。
 */
import { barSeconds, BGM_RECIPES, bgmBarNotes, type BgmKey, type BgmNote } from './bgm';
import { BGM_ASSETS, SOUND_ASSETS, type SoundKey, type SynthRecipe } from './manifest';

/** BGM を何秒先まで予約するか・予約を見直す間隔（ミリ秒） */
const BGM_LOOKAHEAD_SEC = 1.2;
const BGM_TICK_MS = 250;
/** 曲の切り替えでフェードする秒数 */
const BGM_FADE_SEC = 1.2;

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
  private bgmKey: BgmKey | null = null;
  /** 合成 BGM の再生状態（曲ごとの出口・次に予約する小節） */
  private bgmPlayer: {
    out: GainNode;
    timer: ReturnType<typeof setInterval>;
  } | null = null;
  private ambienceOscillators: OscillatorNode[] = [];
  private ambienceGains: GainNode[] = [];
  private ambienceKey: string | null = null;

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
    this.watchLifecycle(this.ctx);
    return this.ctx;
  }

  /**
   * - 操作のたびに、止まっていれば鳴らせる状態に戻す（効果音の鳴らない操作でも BGM が始まるように。
   *   iOS で着信などに割り込まれて止まったときも、次の操作で戻る）
   * - 画面が隠れている間（別のアプリ・タブ・最小化）は止め、戻ったら再開する
   */
  private watchLifecycle(ctx: AudioContext): void {
    if (typeof document === 'undefined') return;
    const wake = () => {
      if (!document.hidden && ctx.state !== 'running') void ctx.resume();
    };
    for (const type of ['pointerdown', 'keydown', 'touchend']) {
      window.addEventListener(type, wake, { capture: true, passive: true });
    }
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) void ctx.suspend();
      else void ctx.resume();
    });
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

  /** BGM を流す（同じ曲なら何もしない。null で止める）。前の曲はフェードアウトする */
  playBgm(key: BgmKey | null): void {
    if (key === this.bgmKey) return;
    this.bgmKey = key;
    this.bgmSource?.stop();
    this.bgmSource = null;
    this.stopSynthBgm();
    if (!key) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.bgmBus) return;
    const asset = BGM_ASSETS[key];
    if (asset?.kind === 'file') {
      void this.playFile(ctx, this.bgmBus, asset.src, asset.volume, 1, true).then((source) => {
        this.bgmSource = source;
      });
      return;
    }
    this.startSynthBgm(ctx, key);
  }

  private startSynthBgm(ctx: AudioContext, key: BgmKey): void {
    const recipe = BGM_RECIPES[key];
    const out = ctx.createGain();
    out.gain.setValueAtTime(0, ctx.currentTime);
    out.gain.linearRampToValueAtTime(1, ctx.currentTime + BGM_FADE_SEC);
    out.connect(this.bgmBus!);
    let bar = 0;
    let barTime = ctx.currentTime + 0.1;
    const schedule = () => {
      // AudioContext が止まっている間（まだ操作がない）は時刻が進まないので、先の分だけ予約して待つ
      while (barTime < ctx.currentTime + BGM_LOOKAHEAD_SEC) {
        for (const note of bgmBarNotes(recipe, bar)) this.scheduleBgmNote(ctx, out, note, barTime);
        bar++;
        barTime += barSeconds(recipe);
      }
    };
    schedule();
    this.bgmPlayer = { out, timer: setInterval(schedule, BGM_TICK_MS) };
  }

  private stopSynthBgm(): void {
    const player = this.bgmPlayer;
    if (!player || !this.ctx) return;
    clearInterval(player.timer);
    const now = this.ctx.currentTime;
    player.out.gain.cancelScheduledValues(now);
    player.out.gain.setValueAtTime(player.out.gain.value, now);
    player.out.gain.linearRampToValueAtTime(0, now + BGM_FADE_SEC);
    setTimeout(() => player.out.disconnect(), (BGM_FADE_SEC + 2) * 1000);
    this.bgmPlayer = null;
  }

  /** BGM の1音を予約する（打楽器はノイズにフィルターをかけて作る） */
  private scheduleBgmNote(ctx: AudioContext, out: AudioNode, note: BgmNote, barTime: number): void {
    const t0 = barTime + note.at;
    const t1 = t0 + note.duration;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, t0);
    // 和音は柔らかく立ち上げ、打楽器は鋭く
    const attack = note.duration > 0.6 ? Math.min(0.4, note.duration / 4) : 0.004;
    gain.gain.linearRampToValueAtTime(note.volume, t0 + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, t1);
    let tail: AudioNode = gain;
    if (note.lowpass) {
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = note.lowpass;
      gain.connect(filter);
      tail = filter;
    }
    tail.connect(out);

    if (note.wave === 'noise') {
      const source = ctx.createBufferSource();
      source.buffer = this.noiseBuffer(ctx, note.duration);
      const filter = ctx.createBiquadFilter();
      // 高い音はハイハット、低い音は金属を叩く音
      filter.type = note.freq > 2000 ? 'highpass' : 'bandpass';
      filter.frequency.value = note.freq;
      if (filter.type === 'bandpass') filter.Q.value = 8;
      source.connect(filter).connect(gain);
      source.start(t0);
      source.stop(t1);
      return;
    }
    const osc = ctx.createOscillator();
    osc.type = note.wave;
    // キック: 高めから一気に下げて、低い鼓動にする
    if (note.freq === 55 && note.wave === 'sine') {
      osc.frequency.setValueAtTime(140, t0);
      osc.frequency.exponentialRampToValueAtTime(45, t0 + 0.12);
    } else {
      osc.frequency.setValueAtTime(note.freq, t0);
    }
    osc.connect(gain);
    osc.start(t0);
    osc.stop(t1 + 0.05);
  }

  /**
   * 工場の低い環境音。音源ファイルなしでも世界の時間を感じられるよう、
   * ごく小さな2つの発振音を重ねる。SEを初めて鳴らした時にブラウザ側で再開される。
   */
  playAmbience(period: number | null, alert: boolean): void {
    const key = period === null ? null : `${period}:${alert}`;
    if (key === this.ambienceKey) return;
    for (const oscillator of this.ambienceOscillators) oscillator.stop();
    for (const node of [...this.ambienceOscillators, ...this.ambienceGains]) node.disconnect();
    this.ambienceOscillators = [];
    this.ambienceGains = [];
    this.ambienceKey = key;
    if (period === null) return;

    const ctx = this.ensureContext();
    if (!ctx || !this.bgmBus) return;
    const base = [54, 62, 46][period] ?? 54;
    const frequencies = alert ? [base, base * 1.5] : [base, base * 2.01];
    frequencies.forEach((frequency, index) => {
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      oscillator.type = index === 0 ? 'sine' : 'triangle';
      oscillator.frequency.value = frequency;
      gain.gain.value = alert ? 0.018 : 0.012;
      oscillator.connect(gain).connect(this.bgmBus!);
      oscillator.start();
      this.ambienceOscillators.push(oscillator);
      this.ambienceGains.push(gain);
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
