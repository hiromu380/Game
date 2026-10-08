import {
  DEFAULT_RULES,
  scoreOf,
  simulate,
  type Board,
  type Part,
  type SimEvent,
} from '@chain-factory/sim';
import { describe, expect, it } from 'vitest';
import { EFFECTS_CONFIG } from '../src/config/effects';
import {
  buildChoreography,
  type ChoreographyOptions,
  type Cue,
} from '../src/playback/choreography';

const C = EFFECTS_CONFIG.choreography;
const strong: ChoreographyOptions = { strength: 'full', reduceFlashes: false, quota: null };

/** 横一列の盤面（左から順に並べる） */
function row(parts: Part['id'][]): Board {
  return { width: parts.length, height: 1, cells: parts.map((id) => ({ id, dir: 1 })) };
}
const run = (board: Board) => simulate({ board, seed: 1, rules: DEFAULT_RULES });

/** 小: スイッチ → ギア → 出荷口 */
const small = run(row(['switch', 'gear', 'dock']));
/** 中: ギアを何段も重ねる */
const medium = run(row(['switch', 'gear', 'gear', 'gear', 'gear', 'gear', 'gear', 'dock']));
/** 特大: tick 上限まで続く人工的なイベント列（1 tick に1回ずつ発動し、最後に出荷） */
function hugeEvents(ticks: number): SimEvent[] {
  const events: SimEvent[] = [
    { tick: 0, type: 'emit', signalId: 0, x: 0, y: 0, dir: 2, value: 1n as never },
  ];
  for (let k = 1; k < ticks; k++) {
    events.push({ tick: k, type: 'activate', signalId: k - 1, x: 0, y: 0, partId: 'conveyor' });
    events.push({ tick: k, type: 'emit', signalId: k, x: 0, y: 0, dir: 2, value: 1n as never });
  }
  events.push({
    tick: ticks,
    type: 'ship',
    x: 0,
    y: 0,
    value: scoreOf(12345),
    total: scoreOf(12345),
  });
  return events;
}

const kinds = (cues: Cue[]) => cues.map((c) => c.kind);
const flashTimes = (cues: Cue[]) => cues.filter((c) => c.kind === 'flash').map((c) => c.atMs);

describe('連鎖の演出の流れ', () => {
  it('同じ events と設定からは同じ命令列になる（決定論）', () => {
    expect(buildChoreography(medium.events, strong)).toEqual(
      buildChoreography(medium.events, strong),
    );
  });

  it('溜め → 連鎖 → ピーク → ドン の順に並ぶ', () => {
    const c = buildChoreography(small.events, strong);
    const k = kinds(c.cues);
    expect(k[0]).toBe('windup');
    expect(k.indexOf('peak')).toBeGreaterThan(k.indexOf('note'));
    expect(k.at(-1)).toBe('stamp');
    expect(c.cues.at(-1)).toMatchObject({ kind: 'stamp', total: small.score });
  });

  it('連鎖が進むほど tick が短くなる（下限あり）', () => {
    const c = buildChoreography(medium.events, strong);
    const d = c.ticks.map((t) => t.durationMs);
    expect(d[0]).toBe(C.tempo.baseTickMs);
    expect(d.at(-1)!).toBeLessThan(d[0]!);
    expect(Math.min(...d)).toBeGreaterThanOrEqual(C.tempo.minTickMs);
  });

  it('倍率が乗った瞬間に ×2 を出し、音は1連鎖ごとに上がる', () => {
    const c = buildChoreography(medium.events, strong);
    const pops = c.cues.filter((q) => q.kind === 'multiplier');
    expect(pops.length).toBe(6);
    expect(pops.every((q) => q.kind === 'multiplier' && q.text === '×2')).toBe(true);
    const notes = c.cues.flatMap((q) => (q.kind === 'note' ? [q.semitone] : []));
    expect(notes).toEqual([...notes].sort((a, b) => a - b));
    expect(new Set(notes).size).toBe(notes.length);
  });

  it('床の効果を受けた瞬間に床の種類つきで数字を出し、パーツの倍率は床の後の値と比べる', () => {
    // スイッチ → ×2床のギア → 出荷口: 床の「×2」とギアの「×2」が別々に出る（まとめて ×4 にはしない）
    const floored = simulate({
      board: row(['switch', 'gear', 'dock']),
      floor: [null, { tile: 'double', source: 'stage' }, null],
      seed: 1,
      rules: DEFAULT_RULES,
    });
    const cues = buildChoreography(floored.events, strong).cues;
    expect(cues.filter((c) => c.kind === 'floor')).toEqual([
      expect.objectContaining({ x: 1, y: 0, tile: 'double', text: '×2' }),
    ]);
    expect(cues.filter((c) => c.kind === 'multiplier').map((c) => 'text' in c && c.text)).toEqual([
      '×2',
    ]);
    // 弱では出さない
    const weak = buildChoreography(floored.events, { ...strong, strength: 'minimal' }).cues;
    expect(weak.some((c) => c.kind === 'floor')).toBe(false);
  });

  it('信号が1つも出ない（スイッチがない）本番でも、例外にならずに「ドン」だけで終わる', () => {
    const empty = run({ width: 3, height: 1, cells: [null, null, null] });
    expect(empty.events).toEqual([]);
    const c = buildChoreography(empty.events, strong);
    expect(c.ticks).toEqual([]);
    expect(kinds(c.cues)).toEqual(['windup', 'stamp']);
    // 信号は出るが出荷しない盤面も同じ（ピークなし）
    const noShip = buildChoreography(run(row(['switch', 'gear'])).events, strong);
    expect(noShip.cues.some((q) => q.kind === 'peak')).toBe(false);
  });

  it('合計の単位が変わる瞬間（1,000 以上）と、ノルマを超えた瞬間を出す', () => {
    const c = buildChoreography(hugeEvents(5), { ...strong, quota: 10 });
    expect(kinds(c.cues)).toEqual(expect.arrayContaining(['digitUp', 'quotaCross']));
    const none = buildChoreography(small.events, { ...strong, quota: 100 });
    expect(kinds(none.cues)).not.toContain('quotaCross');
  });

  it('合計が計測不能の桁数に達したら、桁上がりの代わりに「計測不能」を1回だけ出す', () => {
    // 合計 12,345（5桁）を、4桁で計測不能になる設定で
    const c = buildChoreography(hugeEvents(5), { ...strong, quota: null, unmeasurableDigits: 4 });
    expect(kinds(c.cues).filter((k) => k === 'unmeasurable')).toHaveLength(1);
    expect(kinds(c.cues)).not.toContain('digitUp');
    // 既定（balance/ の桁数）では出ない
    expect(kinds(buildChoreography(hugeEvents(5), strong).cues)).not.toContain('unmeasurable');
  });

  it('規模が大きいほど長いが、どんなに長い連鎖でも上限内に収まる', () => {
    const total = (events: SimEvent[]) => buildChoreography(events, strong).totalMs;
    expect(total(small.events)).toBeLessThan(total(medium.events));
    const extra = C.windupMs.full + C.hitstopMs.full + C.stampMs;
    for (const n of [50, 200, 500, 5000]) {
      const c = buildChoreography(hugeEvents(n), strong);
      expect(c.totalMs).toBeLessThanOrEqual(C.maxTotalMs + extra);
      // 速めても収まらない長さでは、速め・一気に進める（50 tick は加速だけで上限内に収まる）
      if (n >= 200) expect(c.compressed).toBe(true);
    }
    // 短い連鎖に長い演出を付けない
    expect(total(small.events)).toBeLessThan(2500);
  });

  it('長い連鎖では倍率の数字を間引く（上限あり）', () => {
    const c = buildChoreography(hugeEvents(500), strong);
    expect(c.cues.filter((q) => q.kind === 'multiplier').length).toBeLessThanOrEqual(
      C.multiplierPops.max,
    );
  });

  it('盤面の光は1秒に3回まで', () => {
    const events: SimEvent[] = [];
    // 毎 tick 桁が上がる出荷（光を出したい瞬間が続く）
    for (let k = 0; k < 20; k++) {
      const v = scoreOf(10 ** (3 + k));
      events.push({ tick: k, type: 'ship', x: 0, y: 0, value: v, total: v });
    }
    const times = flashTimes(buildChoreography(events, { ...strong, quota: 5000 }).cues);
    expect(times.length).toBeGreaterThan(0);
    for (let i = 0; i < times.length; i++) {
      const within = times.filter((t) => t >= times[i]! && t < times[i]! + 1000);
      expect(within.length).toBeLessThanOrEqual(C.maxFlashesPerSecond);
    }
  });

  it('設定で命令列が変わる: 点滅を減らす → 光なし、弱 → 溜め・止め・倍率の数字なし', () => {
    const base = buildChoreography(medium.events, { ...strong, quota: 10 });
    expect(flashTimes(base.cues).length).toBeGreaterThan(0);
    const calm = buildChoreography(medium.events, { ...strong, quota: 10, reduceFlashes: true });
    expect(flashTimes(calm.cues)).toEqual([]);
    const weak = buildChoreography(medium.events, { ...strong, strength: 'minimal' });
    expect(kinds(weak.cues)).not.toContain('windup');
    expect(kinds(weak.cues)).not.toContain('multiplier');
    expect(weak.cues.find((q) => q.kind === 'peak')).toMatchObject({ hitstopMs: 0 });
    expect(weak.totalMs).toBeLessThan(base.totalMs);
  });

  it('演出は events を読むだけで、sim の結果を変えない', () => {
    const before = JSON.stringify(medium, (_, v) => (typeof v === 'bigint' ? v.toString() : v));
    buildChoreography(medium.events, strong);
    expect(JSON.stringify(medium, (_, v) => (typeof v === 'bigint' ? v.toString() : v))).toBe(
      before,
    );
  });
});
