/**
 * パーツの系統（素材の色の選び方: docs/art-style.md「パーツの系統色」）
 * 素材の生成（art/parts.ts）と、盤面の発光色（manifest.ts）の両方で使う
 */
import type { PartId } from '@chain-factory/sim';
import type { Family } from './palette';

export const PART_FAMILY: Record<PartId, Family> = {
  switch: 'hazard',
  conveyor: 'basic',
  dock: 'basic',
  junkbot: 'basic',
  gear: 'multiplier',
  press: 'multiplier',
  merger: 'multiplier',
  chainMeter: 'multiplier',
  splitter: 'branch',
  spreader: 'branch',
  barrel: 'branch',
  copier: 'branch',
  reflector: 'retrigger',
  turntable: 'retrigger',
  rebooter: 'retrigger',
  oiler: 'retrigger',
  coil: 'placement',
  solar: 'placement',
  inspector: 'placement',
  piggyBank: 'economy',
};
