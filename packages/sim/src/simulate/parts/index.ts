/**
 * パーツの挙動一覧（PartId → 挙動）
 */
import type { PartId } from '../../types';
import { barrelBehavior } from './barrel';
import { conveyorBehavior } from './conveyor';
import { dockBehavior } from './dock';
import { gearBehavior } from './gear';
import { junkbotBehavior } from './junkbot';
import { pressBehavior } from './press';
import { rebooterBehavior } from './rebooter';
import { splitterBehavior } from './splitter';
import { switchBehavior } from './switch';
import type { PartBehavior } from './types';

export const PART_BEHAVIORS: Record<PartId, PartBehavior> = {
  switch: switchBehavior,
  conveyor: conveyorBehavior,
  splitter: splitterBehavior,
  gear: gearBehavior,
  press: pressBehavior,
  barrel: barrelBehavior,
  junkbot: junkbotBehavior,
  rebooter: rebooterBehavior,
  dock: dockBehavior,
};
