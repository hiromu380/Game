/**
 * 見本の工場（タイトル画面の背景で流す連鎖・チュートリアルの締めの大連鎖）
 *
 * 盤面は文字で書く（1マス = 2文字: パーツ記号 + 向き。空マスは ".."）。
 *   パーツ記号: S=スイッチ G=ギア P=プレス B=ドラム缶 D=出荷口 X=コピー機 K=連鎖メーター
 *             L=共鳴コイル I=検品台 E=散布機 Y=分岐器 M=合流炉（必要なものだけ）
 *   向き: ^=上 >=右 v=下 <=左
 * gold の "*" は金色パーツ、floor の "2" "3" は ×2床・×3床。
 * 結果（出荷量の桁数）はテストで確かめる（sim の数値を変えたら見本も見直す）
 */
import {
  DEFAULT_RULES,
  simulate,
  type Board,
  type Dir4,
  type FloorLayer,
  type PartId,
  type SimResult,
} from '@chain-factory/sim';

export interface ShowcaseBoard {
  rows: string[];
  gold: string[];
  floor: string[];
  /** 本番のシード（ランダムなパーツは使わないが、決めておく） */
  seed: number;
}

const PART_CODES: Record<string, PartId> = {
  S: 'switch',
  G: 'gear',
  P: 'press',
  B: 'barrel',
  D: 'dock',
  X: 'copier',
  K: 'chainMeter',
  L: 'coil',
  I: 'inspector',
  E: 'spreader',
  Y: 'splitter',
  M: 'merger',
};
const DIR_CODES: Record<string, Dir4> = { '^': 0, '>': 1, v: 2, '<': 3 };

/**
 * タイトル画面の背景: 分岐器で2本に分け、別々のギア列で育ててから合流炉で掛け合わせ、
 * ドラム缶で5つの出荷口へ同時に出荷する（13 桁）。一直線ではない組み方を最初に見せる
 */
export const TITLE_SHOWCASE: ShowcaseBoard = {
  rows: [
    '.. .. .. .. .. .. ..',
    '.. .. G> P> Gv .. ..',
    '.. .. G^ .. Gv D^ D^',
    'S> G> Y> .. M> B> D>',
    '.. .. Gv .. G^ D> D>',
    '.. .. G> P> G^ .. ..',
    '.. .. .. .. .. .. ..',
  ],
  gold: ['.......', '..*.*..', '..*.*..', '.*.....', '..*.*..', '..*.*..', '.......'],
  floor: ['.......', '..23...', '..2....', '....3..', '..2....', '..23...', '.......'],
  seed: 1,
};

/** チュートリアルの締め: ボルトの「本気の工場」（ギアとプレス機の列を床で押し上げる） */
export const TUTORIAL_SHOWCASE: ShowcaseBoard = {
  rows: [
    '.. .. .. .. .. .. ..',
    'S> G> G> P> G> X> Gv',
    '.. .. .. Pv .. .. Gv',
    '.. D^ G< G< K< P< G<',
    '.. Dv .. .. .. .. ..',
    '.. Iv .. .. .. .. ..',
    '.. D> .. .. .. .. ..',
  ],
  gold: ['.......', '..*..*.', '.......', '...*...', '.......', '.......', '.......'],
  floor: ['.......', '.2..3..', '......3', '..3..2.', '.......', '.......', '.......'],
  seed: 1,
};

export function buildShowcase(def: ShowcaseBoard): { board: Board; floor: FloorLayer } {
  const height = def.rows.length;
  const cells: Board['cells'] = [];
  const floor: FloorLayer = [];
  def.rows.forEach((row, y) => {
    row
      .trim()
      .split(/\s+/)
      .forEach((token, x) => {
        const id = PART_CODES[token[0]!];
        const dir = DIR_CODES[token[1]!];
        const golden = def.gold[y]?.[x] === '*';
        cells.push(
          token === '..' || !id || dir === undefined
            ? null
            : golden
              ? { id, dir, golden }
              : { id, dir },
        );
        const f = def.floor[y]?.[x];
        floor.push(
          f === '2'
            ? { tile: 'double', source: 'stage' }
            : f === '3'
              ? { tile: 'triple', source: 'stage' }
              : null,
        );
      });
  });
  return { board: { width: cells.length / height, height, cells }, floor };
}

/** 見本の連鎖を既定のルールで動かす */
export function runShowcase(def: ShowcaseBoard): SimResult {
  const { board, floor } = buildShowcase(def);
  return simulate({ board, floor, seed: def.seed, rules: DEFAULT_RULES });
}
