/** 加算床: 値に addAmount を足す（既定 +3） */
import { scoreAdd, scoreOf } from '../../core/score';
import type { FloorBehavior } from '../types';

export const addFloor: FloorBehavior = {
  apply: (value, params) => scoreAdd(value, scoreOf(params.addAmount)),
};
