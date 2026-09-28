/**
 * アセットマニフェスト（キー → 画像ファイル）
 *
 * 画面側は必ずここを経由して見た目を決める。本番イラストに差し替えるときは
 * parts/ 以下のファイルを置き換える（または src の import 先を変える）だけでよい。
 * 現在は仮素材として SVG のピクトグラムを使っている（art/ のスクリプトで生成したものを含む）。
 */
import { PART_IDS, type PartId } from '@chain-factory/sim';
import boltFailSrc from './mascot/bolt-fail.svg';
import boltHappySrc from './mascot/bolt-happy.svg';
import boltIdleSrc from './mascot/bolt-idle.svg';
import boltSurprisedSrc from './mascot/bolt-surprised.svg';
import { PART_FAMILY } from './partFamily';
import { BOARD_COLORS, FAMILY_COLORS, hex, SIGNAL_TIERS } from './palette';
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

/** パーツの画像（art/parts.ts で生成） */
const PART_SOURCES: Record<PartId, string> = {
  switch: switchSrc,
  conveyor: conveyorSrc,
  splitter: splitterSrc,
  gear: gearSrc,
  press: pressSrc,
  barrel: barrelSrc,
  junkbot: junkbotSrc,
  rebooter: rebooterSrc,
  dock: dockSrc,
  merger: mergerSrc,
  chainMeter: chainMeterSrc,
  spreader: spreaderSrc,
  copier: copierSrc,
  reflector: reflectorSrc,
  turntable: turntableSrc,
  oiler: oilerSrc,
  coil: coilSrc,
  solar: solarSrc,
  inspector: inspectorSrc,
  piggyBank: piggyBankSrc,
};

/** 画像が上向きに描かれていて、向きに合わせて回転表示するパーツ */
const ROTATING_PARTS: readonly PartId[] = ['conveyor', 'splitter', 'spreader'];

/** パーツの見た目（テーマ色は系統色: docs/art-style.md） */
export const PART_ASSETS: Record<PartId, PartAsset> = Object.fromEntries(
  PART_IDS.map((id) => [
    id,
    {
      src: PART_SOURCES[id],
      color: hex(FAMILY_COLORS[PART_FAMILY[id]].main),
      rotates: ROTATING_PARTS.includes(id),
    },
  ]),
) as Record<PartId, PartAsset>;

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
