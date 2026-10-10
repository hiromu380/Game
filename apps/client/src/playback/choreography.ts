/**
 * 連鎖の演出の流れ（純粋な関数）: sim の events → 演出の命令列（いつ・何を）
 *
 * - sim の結果は変えない。events を読むだけで、パーツの計算をやり直すことはしない
 *   （倍率の数字は「パーツに入った信号の値」と「そのパーツから出た信号の値」の比として events から読む）
 * - 同じ events と設定からは、必ず同じ命令列になる（乱数を使わない）
 * - 溜め → 連鎖（進むほどテンポが速くなる）→ ピーク（最後の出荷で一瞬止める）→ 合計の「ドン」
 * - 長い連鎖は一律に速め、それでも上限を超える分は要所まで一気に進める（演出全体の上限時間を必ず守る）
 * - 盤面の光は1秒に3回まで。「点滅を減らす」なら光を出さない
 * 設定値は config/effects.ts の choreography。描く側（board/）はこの命令列をそのまま再生する
 */
import { BALANCE, scoreOf, type FloorTileId, type Score, type SimEvent } from '@chain-factory/sim';
import { EFFECTS_CONFIG, type EffectStrength } from '../config/effects';
import { groupEventsByTick } from './timeline';

/** 信号の移動にかける割合（tick の開始からこの割合の時刻に、到着したパーツが発動する） */
export const MOVE_RATIO = 0.55;

export interface ChoreographyOptions {
  strength: EffectStrength;
  /** 点滅を減らす（盤面の光を出さない） */
  reduceFlashes: boolean;
  /** ノルマ（試運転・本番の両方で、超えた瞬間を見せる。なければ null） */
  quota: number | null;
  /** 計測不能の桁数（既定は balance/ の値。テストで差し替える） */
  unmeasurableDigits?: number;
}

export type Cue =
  /** 溜め（光が集まる・低い音） */
  | { atMs: number; kind: 'windup'; durationMs: number }
  /** 連鎖の音（その tick で発動した分をまとめて1音） */
  | { atMs: number; kind: 'note'; semitone: number; timbre: number }
  /** 倍率が乗った瞬間（×2・+8） */
  | { atMs: number; kind: 'multiplier'; x: number; y: number; text: string }
  /** 床の効果を受けた（マスが光り、床の種類の色で「×2」「+3」が浮かぶ。倍率ポップと同じ上限で間引く） */
  | { atMs: number; kind: 'floor'; x: number; y: number; tile: FloorTileId; text: string }
  /** 合計の桁が上がった（K → M → B の切り替わり）。digits は新しい桁数 */
  | { atMs: number; kind: 'digitUp'; digits: number; total: Score }
  /** 合計がノルマを超えた */
  | { atMs: number; kind: 'quotaCross' }
  /** 合計が「計測不能」の桁数に達した（メーターが振り切れる。以後は桁上がりを出さない） */
  | { atMs: number; kind: 'unmeasurable' }
  /** 盤面の光（面積は盤面の中、不透明度は alpha まで） */
  | { atMs: number; kind: 'flash'; alpha: number; durationMs: number }
  /** ピーク: 一瞬止めて大きく揺らす */
  | { atMs: number; kind: 'peak'; hitstopMs: number }
  /** 最後の合計の「ドン」 */
  | { atMs: number; kind: 'stamp'; total: Score; durationMs: number };

export interface Choreography {
  /** tick ごとの開始時刻と長さ（ミリ秒、再生速度 1x） */
  ticks: { atMs: number; durationMs: number }[];
  cues: Cue[];
  /** 演出全体の長さ（溜め・ピーク・スタンプ込み） */
  totalMs: number;
  /** 上限に収めるため速めた・一気に進めた（細かい演出を間引く目安） */
  compressed: boolean;
}

const C = EFFECTS_CONFIG.choreography;

/** 値の桁数 */
const digitsOf = (value: Score) => value.toString().length;

/** 連鎖が進むほど短くなる tick の長さ */
function tempoMs(chain: number): number {
  const { baseTickMs, accelPercent, minTickMs } = C.tempo;
  return Math.max(minTickMs, Math.round(baseTickMs * Math.pow(accelPercent / 100, chain)));
}

/** 倍率の表記: 整数倍なら ×n、足し算なら +n（変化がなければ null） */
function multiplierText(input: Score, output: Score): string | null {
  if (output <= input || input <= 0n) return output > input ? `+${output - input}` : null;
  if (output % input === 0n) return `×${output / input}`;
  return `+${output - input}`;
}

export function buildChoreography(events: SimEvent[], options: ChoreographyOptions): Choreography {
  const ticksEvents = groupEventsByTick(events);
  const windupMs = C.windupMs[options.strength];
  const hitstopMs = C.hitstopMs[options.strength];
  const flashAlpha = options.reduceFlashes ? 0 : C.flash.alpha[options.strength];

  // 1. tick の長さ: 連鎖が進むほど速く
  let chain = 0;
  const raw: number[] = ticksEvents.map((tickEvents) => {
    const d = tempoMs(chain);
    chain += tickEvents.filter((e) => e.type === 'activate').length;
    return d;
  });
  // 2. 上限に収める: まず一律に速め、それでも超える分は要所（最後の出荷の少し前）まで一気に進める
  const lastShipTick = ticksEvents.reduce(
    (last, evs, i) => (evs.some((e) => e.type === 'ship') ? i : last),
    -1,
  );
  const sum = raw.reduce((a, b) => a + b, 0);
  let compressed = false;
  let durations = raw;
  if (sum > C.maxTotalMs) {
    compressed = true;
    const factor = C.maxTotalMs / sum;
    durations = raw.map((d) => Math.max(C.compressedMinTickMs, Math.round(d * factor)));
    const scaled = durations.reduce((a, b) => a + b, 0);
    if (scaled > C.maxTotalMs) {
      // 最後から数えて tailMs に収まる tick だけを見せ、それより前は 0ms（一気に進める）
      const end = Math.max(lastShipTick, 0);
      let budget = C.tailMs;
      let keepFrom = end + 1;
      while (keepFrom > 0 && budget - durations[keepFrom - 1]! >= 0) {
        keepFrom--;
        budget -= durations[keepFrom]!;
      }
      durations = durations.map((d, i) =>
        i < keepFrom ? 0 : i > end ? Math.min(d, C.compressedMinTickMs) : d,
      );
    }
  }

  // 3. 時刻を並べ、命令を作る
  const ticks: Choreography['ticks'] = [];
  const cues: Cue[] = [];
  if (windupMs > 0) cues.push({ atMs: 0, kind: 'windup', durationMs: windupMs });

  const values = new Map<number, Score>();
  let t = windupMs;
  let chainSoFar = 0;
  let total = scoreOf(0);
  let quotaCrossed = false;
  const unmeasurableDigits = options.unmeasurableDigits ?? BALANCE.unmeasurable.digits;
  let overflowed = false;
  let lastFlashAt = -Infinity;
  let pops = 0;
  let lastPopAt = -Infinity;
  let lastFloorPopAt = -Infinity;
  const flash = (atMs: number) => {
    if (flashAlpha <= 0 || atMs - lastFlashAt < 1000 / C.maxFlashesPerSecond) return;
    lastFlashAt = atMs;
    cues.push({ atMs, kind: 'flash', alpha: flashAlpha, durationMs: C.flash.durationMs });
  };

  ticksEvents.forEach((tickEvents, i) => {
    const d = durations[i]!;
    ticks.push({ atMs: t, durationMs: d });
    const at = Math.round(t + d * MOVE_RATIO);
    // 数字のポップ: 合計の数は倍率・床で共通の上限。間隔は種類ごと（同じマスの床とパーツは同時に出してよい）
    const popAllowed = (last: number) =>
      options.strength !== 'minimal' &&
      pops < C.multiplierPops.max &&
      at - last >= C.multiplierPops.minGapMs;
    // 床の効果を受けた後の値（パーツの倍率は、床の効果を受けた後の値と比べる）
    const floored = new Map<string, Score>();
    for (const e of tickEvents) {
      if (e.type !== 'floor') continue;
      floored.set(`${e.x},${e.y}`, e.after);
      const text = multiplierText(e.before, e.after);
      if (text && popAllowed(lastFloorPopAt)) {
        pops++;
        lastFloorPopAt = at;
        cues.push({ atMs: at, kind: 'floor', x: e.x, y: e.y, tile: e.tile, text });
      }
    }
    // パーツに入った信号の値（この tick に消費されたもの。床の効果を受けたなら受けた後の値）
    const inputs = new Map<string, Score>();
    let activated = 0;
    for (const e of tickEvents) {
      if (e.type === 'activate') {
        activated++;
        const key = `${e.x},${e.y}`;
        const v = floored.get(key) ?? values.get(e.signalId);
        if (v !== undefined) inputs.set(key, v);
      }
    }
    for (const e of tickEvents) {
      if (e.type === 'emit') {
        values.set(e.signalId, e.value);
        const input = inputs.get(`${e.x},${e.y}`);
        if (input === undefined) continue;
        inputs.delete(`${e.x},${e.y}`); // 同じパーツの2本目以降（分岐）は数字を重ねない
        const text = multiplierText(input, e.value);
        if (text && popAllowed(lastPopAt)) {
          pops++;
          lastPopAt = at;
          cues.push({ atMs: at, kind: 'multiplier', x: e.x, y: e.y, text });
        }
      }
    }
    if (activated > 0 && d > 0) {
      chainSoFar += activated;
      const { maxSemitones, stepsPerTimbre, timbres } = C.notes;
      cues.push({
        atMs: at,
        kind: 'note',
        semitone: Math.min(maxSemitones, chainSoFar),
        timbre: Math.min(timbres - 1, Math.floor(chainSoFar / stepsPerTimbre)),
      });
    } else {
      chainSoFar += activated;
    }
    for (const e of tickEvents) {
      if (e.type !== 'ship') continue;
      const before = digitsOf(total);
      total = e.total;
      const after = digitsOf(total);
      if (!overflowed && after >= unmeasurableDigits) {
        overflowed = true;
        cues.push({ atMs: at, kind: 'unmeasurable' });
        flash(at);
      } else if (
        // 単位（K・M・B…）が切り替わる桁（4・7・10…桁）を越えた（計測不能の後は出さない）
        !overflowed &&
        Math.floor((after - 1) / 3) > Math.floor((before - 1) / 3) &&
        after >= 4
      ) {
        cues.push({ atMs: at, kind: 'digitUp', digits: after, total });
        flash(at);
      }
      if (!quotaCrossed && options.quota !== null && total >= scoreOf(options.quota)) {
        quotaCrossed = true;
        cues.push({ atMs: at, kind: 'quotaCross' });
        flash(at);
      }
    }
    t += d;
  });

  // 4. ピーク（最後の出荷）と「ドン」
  // 出荷が1回もない（スイッチがなく信号が出ない・届かない）ときはピークを作らない（tick が1つもないこともある）
  if (lastShipTick >= 0) {
    const peak = ticks[lastShipTick]!;
    const peakAt = Math.round(peak.atMs + peak.durationMs * MOVE_RATIO);
    cues.push({ atMs: peakAt, kind: 'peak', hitstopMs });
    flash(peakAt);
    // ピークで止めた分、それより後の tick・命令を後ろへずらす（描く側は止めている間、何も進めない）
    for (const tick of ticks) if (tick.atMs > peakAt) tick.atMs += hitstopMs;
    for (const cue of cues) if (cue.atMs > peakAt) cue.atMs += hitstopMs;
    t += hitstopMs;
  }
  cues.push({ atMs: t, kind: 'stamp', total, durationMs: C.stampMs });
  cues.sort((a, b) => a.atMs - b.atMs);
  return { ticks, cues, totalMs: t + C.stampMs, compressed };
}

/**
 * 演出の命令列を時間どおりに取り出す（描く側が毎フレーム呼ぶ）。時刻は再生速度 1x のミリ秒
 */
export class ChoreographyPlayer {
  private elapsed = 0;
  private nextTick = 0;
  private nextCue = 0;
  private readonly ticksEvents: SimEvent[][];

  constructor(
    events: SimEvent[],
    readonly choreography: Choreography,
  ) {
    this.ticksEvents = groupEventsByTick(events);
  }

  get isFinished(): boolean {
    return (
      this.nextTick >= this.choreography.ticks.length &&
      this.nextCue >= this.choreography.cues.length
    );
  }

  /** 時間を進め、この間に始まる tick（イベントと長さ）と命令を返す */
  advance(deltaMs: number): { ticks: { events: SimEvent[]; durationMs: number }[]; cues: Cue[] } {
    this.elapsed += deltaMs;
    return this.take((atMs) => atMs <= this.elapsed);
  }

  /** 残りをすべて返す（スキップ用） */
  flush(): { ticks: { events: SimEvent[]; durationMs: number }[]; cues: Cue[] } {
    return this.take(() => true);
  }

  private take(due: (atMs: number) => boolean) {
    const { ticks, cues } = this.choreography;
    const outTicks: { events: SimEvent[]; durationMs: number }[] = [];
    const outCues: Cue[] = [];
    while (this.nextTick < ticks.length && due(ticks[this.nextTick]!.atMs)) {
      outTicks.push({
        events: this.ticksEvents[this.nextTick] ?? [],
        durationMs: ticks[this.nextTick]!.durationMs,
      });
      this.nextTick++;
    }
    while (this.nextCue < cues.length && due(cues[this.nextCue]!.atMs)) {
      outCues.push(cues[this.nextCue++]!);
    }
    return { ticks: outTicks, cues: outCues };
  }
}
