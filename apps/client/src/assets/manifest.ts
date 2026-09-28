/**
 * アセットマニフェスト（キー → 画像ファイル）
 *
 * 画面側は必ずここを経由して見た目を決める。本番イラストに差し替えるときは
 * parts/ 以下のファイルを置き換える（または src の import 先を変える）だけでよい。
 * 現在は仮素材として SVG のピクトグラムを使っている（art/ のスクリプトで生成したものを含む）。
 */
import type { PartId } from '@chain-factory/sim';
import boltFailSrc from './mascot/bolt-fail.svg';
import boltHappySrc from './mascot/bolt-happy.svg';
import boltIdleSrc from './mascot/bolt-idle.svg';
import boltSurprisedSrc from './mascot/bolt-surprised.svg';
import { BOARD_COLORS, hex, SIGNAL_TIERS } from './palette';
import barrelSrc from './parts/barrel.svg';
import conveyorSrc from './parts/conveyor.svg';
import dockSrc from './parts/dock.svg';
import gearSrc from './parts/gear.svg';
import junkbotSrc from './parts/junkbot.svg';
import pressSrc from './parts/press.svg';
import rebooterSrc from './parts/rebooter.svg';
import splitterSrc from './parts/splitter.svg';
import switchSrc from './parts/switch.svg';
// フェーズ2で追加
import chainMeterSrc from './parts/chainMeter.svg';
import coilSrc from './parts/coil.svg';
import copierSrc from './parts/copier.svg';
import inspectorSrc from './parts/inspector.svg';
import mergerSrc from './parts/merger.svg';
import oilerSrc from './parts/oiler.svg';
import piggyBankSrc from './parts/piggyBank.svg';
import reflectorSrc from './parts/reflector.svg';
import solarSrc from './parts/solar.svg';
import spreaderSrc from './parts/spreader.svg';
import turntableSrc from './parts/turntable.svg';

export interface PartAsset {
  /** 画像ファイルの URL */
  src: string;
  /** パーツのテーマ色（0xRRGGBB）。発光などの演出に使う */
  color: number;
  /**
   * true: 画像自体が「上向き」に描かれており、パーツの向きに合わせて回転表示する
   * false: 画像は回転させず、向きは盤面側で矢印バッジとして表示する
   */
  rotates: boolean;
}

/** パーツの見た目 */
export const PART_ASSETS: Record<PartId, PartAsset> = {
  switch: { src: switchSrc, color: 0xe53935, rotates: false },
  conveyor: { src: conveyorSrc, color: 0xffca28, rotates: true },
  splitter: { src: splitterSrc, color: 0xab47bc, rotates: true },
  gear: { src: gearSrc, color: 0xfb8c00, rotates: false },
  press: { src: pressSrc, color: 0x90a4ae, rotates: false },
  barrel: { src: barrelSrc, color: 0xff5722, rotates: false },
  junkbot: { src: junkbotSrc, color: 0x7cb342, rotates: false },
  rebooter: { src: rebooterSrc, color: 0x00acc1, rotates: false },
  dock: { src: dockSrc, color: 0x1e88e5, rotates: false },
  merger: { src: mergerSrc, color: 0xff7043, rotates: false },
  chainMeter: { src: chainMeterSrc, color: 0xe53935, rotates: false },
  spreader: { src: spreaderSrc, color: 0x7e57c2, rotates: true },
  copier: { src: copierSrc, color: 0xb0bec5, rotates: false },
  reflector: { src: reflectorSrc, color: 0x42a5f5, rotates: false },
  turntable: { src: turntableSrc, color: 0x26a69a, rotates: false },
  oiler: { src: oilerSrc, color: 0xfbc02d, rotates: false },
  coil: { src: coilSrc, color: 0xe67e22, rotates: false },
  solar: { src: solarSrc, color: 0x42a5f5, rotates: false },
  inspector: { src: inspectorSrc, color: 0x66bb6a, rotates: false },
  piggyBank: { src: piggyBankSrc, color: 0xf48fb1, rotates: false },
};

/** マスコット「ボルト」の表情（art/mascot.ts で生成） */
export const MASCOT_ASSETS = {
  idle: boltIdleSrc,
  happy: boltHappySrc,
  surprised: boltSurprisedSrc,
  fail: boltFailSrc,
} as const;

export type MascotExpression = keyof typeof MASCOT_ASSETS;

/** 盤面・演出の色（PixiJS 用の数値。定義は palette.ts） */
export const BOARD_THEME = {
  ...(Object.fromEntries(
    Object.entries(BOARD_COLORS).map(([key, color]) => [key, hex(color)]),
  ) as Record<keyof typeof BOARD_COLORS, number>),
  signalTiers: SIGNAL_TIERS.map(hex),
};

/** 0xRRGGBB を CSS の色文字列へ */
export function toCssColor(color: number): string {
  return `#${color.toString(16).padStart(6, '0')}`;
}
