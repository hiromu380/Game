/**
 * アセットマニフェスト（キー → 画像ファイル）
 *
 * 画面側は必ずここを経由して見た目を決める。本番イラストに差し替えるときは
 * parts/ 以下のファイルを置き換える（または src の import 先を変える）だけでよい。
 * 現在は仮素材として SVG のピクトグラムを使っている。
 */
import type { PartId } from '@chain-factory/sim';
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

/** 盤面・演出の色（テーマ）。工場の床をイメージした配色 */
export const BOARD_THEME = {
  /** 盤面の外側 */
  background: 0x23272e,
  /** 床タイル（市松模様の2色） */
  floorA: 0x4a4f57,
  floorB: 0x454a52,
  floorLine: 0x363a41,
  /** ハザード柄の枠 */
  hazardYellow: 0xffc107,
  hazardBlack: 0x2b2b2b,
  /** 使用不可マス（補修工事） */
  blocked: 0xc62828,
  /** 選択・配置プレビュー */
  selected: 0xffeb3b,
  ghostOk: 0x69f0ae,
  /** 向きを示す矢印バッジ */
  arrowFill: 0xffeb3b,
  arrowStroke: 0x3e2723,
  /** 倍率バッジ */
  badgeFill: 0x212121,
  badgeText: 0xffeb3b,
  /** 信号の色（値の桁数が増えるほど派手になる） */
  signalTiers: [0xfff176, 0xffb74d, 0xff7043, 0xf06292, 0xba68c8, 0x4dd0e1],
  signalText: 0x1b1f27,
  glow: 0xffffff,
  reset: 0x4dd0e1,
  shipText: 0x69f0ae,
  /** 収入（貯金箱）のポップアップ */
  incomeText: 0xffd54f,
  tooltipBg: 0x111418,
  tooltipText: 0xffffff,
} as const;

/** 0xRRGGBB を CSS の色文字列へ */
export function toCssColor(color: number): string {
  return `#${color.toString(16).padStart(6, '0')}`;
}
