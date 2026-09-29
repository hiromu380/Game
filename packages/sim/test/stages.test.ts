/**
 * 日ごとのステージ（床の配置）: テンプレートの妥当性・回転反転・生成の再現性・ランへの組み込み
 */
import { describe, expect, it } from 'vitest';
import {
  BALANCE,
  buildDailyConfig,
  createRun,
  drawBoss,
  generateStage,
  getCurrentFloor,
  isBlockedCell,
  parseTemplate,
  placePart,
  seeds,
  transformFloor,
  validateStage,
  createPrng,
  type FloorLayer,
  type FloorTileId,
} from '../src';

const STAGES = BALANCE.stages;
const tilesOf = (floor: FloorLayer) => new Set(floor.flatMap((c) => (c ? [c.tile] : [])));
const tilesOfTemplate = (id: string) => tilesOf(parseTemplate(STAGES.templates[id]!).floor);

describe('テンプレート', () => {
  it('すべて 7×7 で、8通りの回転・反転と 7×7〜9×9 への埋め込みで検証に通る', () => {
    for (const [id, rows] of Object.entries(STAGES.templates)) {
      const { size, floor } = parseTemplate(rows);
      expect(size, id).toEqual({ width: 7, height: 7 });
      for (let variant = 0; variant < 8; variant++) {
        const turned = transformFloor(floor, 7, variant);
        expect(validateStage(turned, size, STAGES.minFreePercent), `${id}/${variant}`).toBe(true);
      }
    }
    for (const n of [7, 8, 9]) {
      for (const band of [...STAGES.dayBands, STAGES.overtimeBand, STAGES.dailyBand]) {
        for (let seed = 0; seed < 20; seed++) {
          const floor = generateStage({
            seed,
            band,
            board: { width: n, height: n },
            stages: STAGES,
          });
          expect(floor).toHaveLength(n * n);
          expect(validateStage(floor, { width: n, height: n }, STAGES.minFreePercent)).toBe(true);
        }
      }
    }
  });

  it('帯のテンプレートはすべて存在し、日ごとに難易度の方向性に沿う', () => {
    const bands = [...STAGES.dayBands, STAGES.overtimeBand, STAGES.dailyBand];
    for (const id of bands.flat()) expect(STAGES.templates[id], id).toBeDefined();
    const only = (ids: string[], allowed: FloorTileId[]) =>
      ids.every((id) => [...tilesOfTemplate(id)].every((t) => allowed.includes(t)));
    // 1日目: ×2床だけ／2日目: ×3床なし（加算床・使用不可あり）／3日目: ×3床を含む
    expect(only(STAGES.dayBands[0]!, ['double'])).toBe(true);
    expect(only(STAGES.dayBands[1]!, ['double', 'add', 'blocked'])).toBe(true);
    expect(STAGES.dayBands[1]!.some((id) => tilesOfTemplate(id).has('blocked'))).toBe(true);
    expect(STAGES.dayBands[2]!.every((id) => tilesOfTemplate(id).has('triple'))).toBe(true);
    expect(only([STAGES.tutorialTemplate], ['double'])).toBe(true);
  });
});

describe('回転・反転と検証', () => {
  const { floor } = parseTemplate(STAGES.templates.d2Zigzag!);

  it('4回まわすと元に戻り、反転を2回かけても元に戻る', () => {
    let turned = floor;
    for (let i = 0; i < 4; i++) turned = transformFloor(turned, 7, 1);
    expect(turned).toEqual(floor);
    expect(transformFloor(transformFloor(floor, 7, 4), 7, 4)).toEqual(floor);
  });

  it('時計回りに1回まわすと、左上のマスが右上へ移る', () => {
    const marked: FloorLayer = new Array(49).fill(null);
    marked[0] = { tile: 'double', source: 'stage' };
    expect(transformFloor(marked, 7, 1)[6]).toEqual({ tile: 'double', source: 'stage' });
  });

  it('使用不可で空きマスが分断される・空きマスが少ないステージは不合格', () => {
    const wall = parseTemplate([
      '...#...',
      '...#...',
      '...#...',
      '...#...',
      '...#...',
      '...#...',
      '...#...',
    ]);
    expect(validateStage(wall.floor, wall.size, 0)).toBe(false);
    const few = parseTemplate([
      '##.....',
      '##.....',
      '.......',
      '.......',
      '.......',
      '.......',
      '.......',
    ]);
    expect(validateStage(few.floor, few.size, 95)).toBe(false);
    expect(validateStage(few.floor, few.size, 80)).toBe(true);
  });

  it('検証に1度も通らないときは、試行回数の上限で帯の最初のテンプレートにする（無制限に引き直さない）', () => {
    const stages = { ...STAGES, maxAttempts: 0 };
    const floor = generateStage({
      seed: 1,
      band: ['d1Pair', 'd1Steps'],
      board: { width: 7, height: 7 },
      stages,
    });
    expect(floor).toEqual(parseTemplate(STAGES.templates.d1Pair!).floor);
  });
});

describe('生成の再現性', () => {
  const board = { width: 7, height: 7 };
  it('同じシードなら同じ床、シードが違えば（ほぼ）違う床', () => {
    const gen = (seed: number) =>
      generateStage({ seed, band: STAGES.dayBands[2]!, board, stages: STAGES });
    expect(gen(5)).toEqual(gen(5));
    const distinct = new Set(Array.from({ length: 20 }, (_, s) => JSON.stringify(gen(s))));
    expect(distinct.size).toBeGreaterThan(5);
  });

  it('×2床を×3床に置き換える枚数を指定できる（延長戦）', () => {
    const base = generateStage({ seed: 3, band: ['d1Steps'], board, stages: STAGES });
    const up = generateStage({ seed: 3, band: ['d1Steps'], board, stages: STAGES, upgrades: 2 });
    const count = (f: FloorLayer, t: FloorTileId) => f.filter((c) => c?.tile === t).length;
    expect(count(up, 'triple')).toBe(2);
    expect(count(up, 'double')).toBe(count(base, 'double') - 2);
  });
});

describe('ランへの組み込み', () => {
  it('ラン開始時に1〜3日目のステージが決まり、日ごとに床が切り替わる', () => {
    const run = createRun(123);
    const days = run.config.stages!.days;
    expect(days).toHaveLength(3);
    expect(getCurrentFloor(run, 0)).toEqual(days[0]);
    expect(getCurrentFloor(run, 1)).toEqual(days[0]);
    expect(getCurrentFloor(run, 3)).toEqual(days[1]);
    expect(days.flatMap((d) => d.filter((c) => c).map((c) => c!.source))).toSatisfy((s: string[]) =>
      s.every((v) => v === 'stage'),
    );
    // 同じランシードなら同じステージ
    expect(createRun(123).config.stages).toEqual(run.config.stages);
  });

  it('初回ガイドのランは、1日目が固定のテンプレート', () => {
    const run = createRun(7, { tutorial: true });
    expect(run.config.stages!.days[0]).toEqual(parseTemplate(STAGES.templates.tutorial!).floor);
  });

  it('デイリーは、デイリーの ID から全員同じステージ（2日目相当の帯）', () => {
    const a = buildDailyConfig({ dailyId: '2026-10-05' });
    expect(a.stages!.days).toHaveLength(1);
    expect(buildDailyConfig({ dailyId: '2026-10-05' }).stages).toEqual(a.stages);
    expect([...tilesOf(a.stages!.days[0]!)].every((t) => t !== 'triple')).toBe(true);
  });

  it('床の補修工事の使用不可マスは、その日のステージの床がないマスから選ぶ', () => {
    const stage = generateStage({
      seed: 9,
      band: ['d3Gate'],
      board: { width: 7, height: 7 },
      stages: STAGES,
    });
    for (let seed = 0; seed < 50; seed++) {
      const entry = drawBoss(
        createPrng(seed),
        { ...BALANCE.boss, candidates: ['repairWork'] },
        { width: 7, height: 7 },
        null,
        stage,
      );
      expect(entry!.blockedCells).toHaveLength(BALANCE.boss.repairWorkCells);
      for (const cell of entry!.blockedCells) expect(stage[cell]).toBeNull();
    }
  });

  it('使用不可マスが足りなくても、補修工事の抽選は止まる', () => {
    const full: FloorLayer = new Array(49).fill({ tile: 'double', source: 'stage' });
    const entry = drawBoss(
      createPrng(1),
      { ...BALANCE.boss, candidates: ['repairWork'] },
      { width: 7, height: 7 },
      null,
      full,
    );
    expect(entry!.blockedCells).toEqual([]);
  });

  it('ステージの使用不可マスには置けない', () => {
    // 使用不可のあるステージが1日目に出るシードを探す（2日目の帯を1日目に使う）
    const balance = { ...BALANCE, stages: { ...STAGES, dayBands: [STAGES.dayBands[1]!] } };
    const run = createRun(11, { balance });
    const floor = getCurrentFloor(run);
    const blocked = floor.findIndex((_, i) => isBlockedCell(floor, i));
    expect(blocked).toBeGreaterThanOrEqual(0);
    const result = placePart(run, 'switch', blocked % 7, Math.floor(blocked / 7), 1);
    expect(result).toEqual({ ok: false, error: 'cellBlocked' });
  });

  it('ステージのシードは用途別シードのラベル7（既存の用途と重ならない）', () => {
    expect(seeds.stageSeed(1, 0)).not.toBe(seeds.dayEventSeed(1, 0, 0));
    expect(seeds.stageSeed(1, 0)).not.toBe(seeds.stageSeed(1, 1));
  });
});
