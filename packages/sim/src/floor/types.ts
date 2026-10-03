/**
 * 床（盤面の下層）の型
 *
 * 床タイルはマスごとに1枚まで。パーツの配置とは独立で、パーツを置いても撤去しても残る。
 * 床タイル1種 = 1ファイル（floor/tiles/）で FloorBehavior を実装し、tiles/index.ts の一覧に登録する。
 */
import type { FloorParams } from '../balance';
import type { Score } from '../core/score';

/** 床タイルの種類 */
export const FLOOR_TILE_IDS = ['double', 'add', 'triple', 'blocked'] as const;
export type FloorTileId = (typeof FLOOR_TILE_IDS)[number];

/**
 * 床タイルがどこから来たか（見た目の区別と、日・シフトの切り替えで消すときに使う）
 * - stage: その日のステージ
 * - boss: ボス・特殊ルール（床の補修工事）
 * - event: 今日の出来事
 * - bonus: シフト開始時のボーナス床
 */
export type FloorSource = 'stage' | 'boss' | 'event' | 'bonus';

export interface FloorCell {
  tile: FloorTileId;
  source: FloorSource;
}

/** 床。行優先（index = y * width + x）、床のないマスは null */
export type FloorLayer = (FloorCell | null)[];

export interface FloorBehavior {
  /**
   * 信号がこのマスのパーツを発動させる直前に、値へ掛ける効果。
   * 発動しない（空マス・発動回数切れ・取り込まれただけ）の信号には適用しない
   */
  apply?: (value: Score, params: FloorParams) => Score;
  /** パーツを置けず、入った信号は消滅する（使用不可マス） */
  blocked?: boolean;
}
