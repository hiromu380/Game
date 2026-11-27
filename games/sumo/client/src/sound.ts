/**
 * 効果音（Web Audio で合成。外部の音源は使わない）
 * - clap: 拍子木（立ち合いの前）
 * - hit: ぶつかる音
 * - fall: 土俵に落ちる音
 * - drum: 太鼓（見せ場）
 * - tick: 星取りの札が入る小さな木の音
 * - cheer: 勝負が決まったときの歓声（ざわめきが盛り上がって引く）
 * - roll: 大きな見せ場（優勝・大関や横綱の昇進）の太鼓の連打と大歓声、締めの拍子木
 * - drumCheer: 中くらいの見せ場（新十両・新入幕・部屋の新記録）の太鼓と歓声
 */
let ctx: AudioContext | null = null;
/** すべての音が通る音量のつまみ */
let master: GainNode | null = null;

/** 音量の段（ユーザー設定 volume） */
export type Volume = 'high' | 'mid' | 'low';
export const VOLUME_GAIN: Record<Volume, number> = { high: 1, mid: 0.55, low: 0.25 };
let gain = VOLUME_GAIN.high;

/** 音量を変える（次に鳴らす音から効く） */
export function setVolume(v: Volume): void {
  gain = VOLUME_GAIN[v];
  if (master) master.gain.value = gain;
}

function audio(): AudioContext | null {
  try {
    ctx ??= new AudioContext();
    if (ctx.state === 'suspended') void ctx.resume();
    if (!master) {
      master = ctx.createGain();
      master.gain.value = gain;
      master.connect(ctx.destination);
    }
    return ctx;
  } catch {
    return null;
  }
}

/** 音の出口（音量のつまみ。なければスピーカー） */
function out(ac: AudioContext): AudioNode {
  return master ?? ac.destination;
}

function noise(ac: AudioContext, seconds: number): AudioBuffer {
  const buf = ac.createBuffer(1, Math.ceil(ac.sampleRate * seconds), ac.sampleRate);
  const data = buf.getChannelData(0);
  // 毎回同じ音にするため、乱数ではなく決まった式で作る
  let s = 12345;
  for (let i = 0; i < data.length; i++) {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    data[i] = (s / 0x3fffffff - 1) * (1 - i / data.length);
  }
  return buf;
}

function burst(
  ac: AudioContext,
  at: number,
  freq: number,
  q: number,
  gain: number,
  seconds: number,
) {
  const src = ac.createBufferSource();
  src.buffer = noise(ac, seconds);
  const filter = ac.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = freq;
  filter.Q.value = q;
  const g = ac.createGain();
  g.gain.setValueAtTime(gain, at);
  g.gain.exponentialRampToValueAtTime(0.001, at + seconds);
  src.connect(filter).connect(g).connect(out(ac));
  src.start(at);
}

function thump(ac: AudioContext, at: number, freq: number, gain: number, seconds: number) {
  const osc = ac.createOscillator();
  osc.frequency.setValueAtTime(freq, at);
  osc.frequency.exponentialRampToValueAtTime(freq / 2, at + seconds);
  const g = ac.createGain();
  g.gain.setValueAtTime(gain, at);
  g.gain.exponentialRampToValueAtTime(0.001, at + seconds);
  osc.connect(g).connect(out(ac));
  osc.start(at);
  osc.stop(at + seconds);
}

/** 歓声: 帯域を絞った雑音を、ふくらませてから引かせる */
function swell(ac: AudioContext, at: number, gain: number, seconds: number) {
  const src = ac.createBufferSource();
  const buf = ac.createBuffer(1, Math.ceil(ac.sampleRate * seconds), ac.sampleRate);
  const data = buf.getChannelData(0);
  let s = 6789;
  for (let i = 0; i < data.length; i++) {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    data[i] = s / 0x3fffffff - 1;
  }
  src.buffer = buf;
  const filter = ac.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = 900;
  filter.Q.value = 0.6;
  const g = ac.createGain();
  g.gain.setValueAtTime(0.001, at);
  g.gain.exponentialRampToValueAtTime(gain, at + 0.25);
  g.gain.exponentialRampToValueAtTime(0.001, at + seconds);
  src.connect(filter).connect(g).connect(out(ac));
  src.start(at);
}

export type SoundKind = 'clap' | 'hit' | 'fall' | 'drum' | 'tick' | 'cheer' | 'roll' | 'drumCheer';

export function playSound(kind: SoundKind): void {
  const ac = audio();
  if (!ac) return;
  const t = ac.currentTime;
  if (kind === 'clap') {
    burst(ac, t, 2400, 8, 0.5, 0.06);
    burst(ac, t + 0.18, 2400, 8, 0.5, 0.06);
  } else if (kind === 'hit') {
    thump(ac, t, 110, 0.6, 0.18);
    burst(ac, t, 500, 1, 0.25, 0.1);
  } else if (kind === 'tick') {
    burst(ac, t, 1800, 6, 0.16, 0.04);
  } else if (kind === 'cheer') {
    swell(ac, t, 0.16, 1.4);
  } else if (kind === 'roll') {
    // 太鼓がだんだん速くなって、大歓声と拍子木で締める
    let at = 0;
    for (let i = 0; i < 12; i++) {
      thump(ac, t + at, i === 11 ? 100 : 82, 0.5, 0.3);
      at += Math.max(0.07, 0.26 - i * 0.02);
    }
    swell(ac, t + at - 0.2, 0.24, 2.2);
    burst(ac, t + at + 0.1, 2400, 8, 0.5, 0.06);
    burst(ac, t + at + 0.28, 2400, 8, 0.5, 0.06);
  } else if (kind === 'drumCheer') {
    [0, 0.32, 0.64, 0.8].forEach((d, i) => thump(ac, t + d, i === 3 ? 95 : 80, 0.55, 0.35));
    swell(ac, t + 0.8, 0.16, 1.4);
  } else if (kind === 'drum') {
    // ドン・ドン・ドドン
    [0, 0.32, 0.64, 0.8].forEach((d, i) => thump(ac, t + d, i === 3 ? 95 : 80, 0.55, 0.35));
  } else {
    thump(ac, t, 70, 0.5, 0.3);
    burst(ac, t, 300, 0.8, 0.3, 0.25);
  }
}
