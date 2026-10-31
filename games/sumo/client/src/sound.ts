/**
 * 効果音（Web Audio で合成。外部の音源は使わない）
 * - clap: 拍子木（立ち合いの前）
 * - hit: ぶつかる音
 * - fall: 土俵に落ちる音
 * - drum: 太鼓（見せ場）
 */
let ctx: AudioContext | null = null;

function audio(): AudioContext | null {
  try {
    ctx ??= new AudioContext();
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
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
  src.connect(filter).connect(g).connect(ac.destination);
  src.start(at);
}

function thump(ac: AudioContext, at: number, freq: number, gain: number, seconds: number) {
  const osc = ac.createOscillator();
  osc.frequency.setValueAtTime(freq, at);
  osc.frequency.exponentialRampToValueAtTime(freq / 2, at + seconds);
  const g = ac.createGain();
  g.gain.setValueAtTime(gain, at);
  g.gain.exponentialRampToValueAtTime(0.001, at + seconds);
  osc.connect(g).connect(ac.destination);
  osc.start(at);
  osc.stop(at + seconds);
}

export function playSound(kind: 'clap' | 'hit' | 'fall' | 'drum'): void {
  const ac = audio();
  if (!ac) return;
  const t = ac.currentTime;
  if (kind === 'clap') {
    burst(ac, t, 2400, 8, 0.5, 0.06);
    burst(ac, t + 0.18, 2400, 8, 0.5, 0.06);
  } else if (kind === 'hit') {
    thump(ac, t, 110, 0.6, 0.18);
    burst(ac, t, 500, 1, 0.25, 0.1);
  } else if (kind === 'drum') {
    // ドン・ドン・ドドン
    [0, 0.32, 0.64, 0.8].forEach((d, i) => thump(ac, t + d, i === 3 ? 95 : 80, 0.55, 0.35));
  } else {
    thump(ac, t, 70, 0.5, 0.3);
    burst(ac, t, 300, 0.8, 0.3, 0.25);
  }
}
