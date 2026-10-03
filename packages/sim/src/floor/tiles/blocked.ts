/** 使用不可: パーツを置けず、入った信号は消滅する（ステージ・ボスの「床の補修工事」） */
import type { FloorBehavior } from '../types';

export const blockedFloor: FloorBehavior = { blocked: true };
