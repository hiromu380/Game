/**
 * ボスシフト（夜）の修正ルール: 抽選対象と効果量
 */
import type { Balance } from './types';

export const BOSS: Balance['boss'] = {
  candidates: ['lowOil', 'repairWork', 'strictInspection', 'shortShift', 'partShortage'],
  lowOilConveyorDelta: -1,
  repairWorkCells: 2,
  strictInspectionDivisor: 2,
  shortShiftTickLimit: 30,
  partShortageOffersDelta: -2,
};
