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
// フェーズ2で追加
import { chainMeterBehavior } from './chainMeter';
import { coilBehavior } from './coil';
import { copierBehavior } from './copier';
import { inspectorBehavior } from './inspector';
import { mergerBehavior } from './merger';
import { oilerBehavior } from './oiler';
import { piggyBankBehavior } from './piggyBank';
import { reflectorBehavior } from './reflector';
import { solarBehavior } from './solar';
import { spreaderBehavior } from './spreader';
import { turntableBehavior } from './turntable';
// パーツ追加（SIM_VERSION 9）
import { bendBehavior } from './bend';
import { boosterBehavior } from './booster';
import { capacitorBehavior } from './capacitor';
import { cashierBehavior } from './cashier';
import { cornerBenchBehavior } from './cornerBench';
import { crossSplitterBehavior } from './crossSplitter';
import { magnetBehavior } from './magnet';
import { teleporterBehavior } from './teleporter';

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
  merger: mergerBehavior,
  chainMeter: chainMeterBehavior,
  spreader: spreaderBehavior,
  copier: copierBehavior,
  reflector: reflectorBehavior,
  turntable: turntableBehavior,
  oiler: oilerBehavior,
  coil: coilBehavior,
  solar: solarBehavior,
  inspector: inspectorBehavior,
  piggyBank: piggyBankBehavior,
  bend: bendBehavior,
  crossSplitter: crossSplitterBehavior,
  magnet: magnetBehavior,
  cornerBench: cornerBenchBehavior,
  capacitor: capacitorBehavior,
  teleporter: teleporterBehavior,
  booster: boosterBehavior,
  cashier: cashierBehavior,
};
