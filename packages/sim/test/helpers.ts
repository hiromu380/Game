/**
 * テスト用ヘルパー: 文字列から盤面を作る
 *
 * 1マス = 2文字（パーツ記号 + 向き）、マス同士は空白区切り。空マスは "..".
 *   パーツ記号: S=スイッチ C=コンベア Y=分岐器 G=ギア P=プレス B=ドラム缶 J=ポンコツ R=再起動 D=出荷口
 *             M=合流炉 K=連鎖メーター E=散布機 X=コピー機 F=反射板 U=回転台 O=潤滑油タンク
 *             L=共鳴コイル A=ソーラーパネル I=検品台 $=貯金箱
 *   向き: ^=上 >=右 v=下 <=左
 * 例:
 *   board(['S> G> D>'])  // スイッチ → ギア → 出荷口
 */
import {
  DEFAULT_RULES,
  scoreToString,
  simulate,
  type Board,
  type Dir4,
  type FloorLayer,
  type FloorTileId,
  type PartId,
} from '../src';

const PART_CODES: Record<string, PartId> = {
  S: 'switch',
  C: 'conveyor',
  Y: 'splitter',
  G: 'gear',
  P: 'press',
  B: 'barrel',
  J: 'junkbot',
  R: 'rebooter',
  D: 'dock',
  M: 'merger',
  K: 'chainMeter',
  E: 'spreader',
  X: 'copier',
  F: 'reflector',
  U: 'turntable',
  O: 'oiler',
  L: 'coil',
  A: 'solar',
  I: 'inspector',
  $: 'piggyBank',
};
const DIR_CODES: Record<string, Dir4> = { '^': 0, '>': 1, v: 2, '<': 3 };

export function board(rows: string[]): Board {
  const grid = rows.map((row) => row.trim().split(/\s+/));
  const height = grid.length;
  const width = grid[0]?.length ?? 0;
  const cells: Board['cells'] = [];
  for (const row of grid) {
    if (row.length !== width) throw new Error('行ごとのマス数が揃っていません');
    for (const token of row) {
      if (token === '..') {
        cells.push(null);
        continue;
      }
      const id = PART_CODES[token[0]!];
      const dir = DIR_CODES[token[1]!];
      if (!id || dir === undefined) throw new Error(`不明なマス: ${token}`);
      cells.push({ id, dir });
    }
  }
  return { width, height, cells };
}

/** 既定ルールでシミュレーションし、スコアを文字列で返す */
export function run(rows: string[], seed = 1, rules = DEFAULT_RULES) {
  const result = simulate({ board: board(rows), seed, rules });
  return { ...result, scoreText: scoreToString(result.score) };
}

const FLOOR_CODES: Record<string, FloorTileId> = {
  '2': 'double',
  '+': 'add',
  '3': 'triple',
  '#': 'blocked',
};

/**
 * テスト用ヘルパー: 文字列から床を作る（1マス = 1文字、空白区切り。'.' は床なし）
 *   2=×2床 +=加算床 3=×3床 #=使用不可（source は stage）
 */
export function floorOf(rows: string[]): FloorLayer {
  return rows.flatMap((row) =>
    row
      .trim()
      .split(/\s+/)
      .map((c) => {
        if (c === '.') return null;
        const tile = FLOOR_CODES[c];
        if (!tile) throw new Error(`不明な床: ${c}`);
        return { tile, source: 'stage' as const };
      }),
  );
}

/** 床つきでシミュレーションする */
export function runWithFloor(rows: string[], floorRows: string[], seed = 1, rules = DEFAULT_RULES) {
  const result = simulate({ board: board(rows), floor: floorOf(floorRows), seed, rules });
  return { ...result, scoreText: scoreToString(result.score) };
}
