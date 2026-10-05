/**
 * アセットマニフェスト（キー → 画像ファイル）
 *
 * 画面側は必ずここを経由して見た目を決める。本番イラストに差し替えるときは
 * parts/ 以下のファイルを置き換える（または src の import 先を変える）だけでよい。
 * 現在は仮素材として SVG のピクトグラムを使っている（art/ のスクリプトで生成したものを含む）。
 */
import { PART_IDS, type AchievementId, type BossModifierId, type PartId } from '@chain-factory/sim';
import logoDarkSrc from './logo/logo-dark-bg.svg';
import logoLightSrc from './logo/logo-light-bg.svg';
import boltFailSrc from './mascot/bolt-fail.svg';
import boltHappySrc from './mascot/bolt-happy.svg';
import boltIdleSrc from './mascot/bolt-idle.svg';
import boltSurprisedSrc from './mascot/bolt-surprised.svg';
import boltGutsSrc from './characters/bolt/poses/guts.svg';
import boltSadSrc from './characters/bolt/poses/sad.svg';
import boltStandSrc from './characters/bolt/poses/stand.svg';
import boltWaveSrc from './characters/bolt/poses/wave.svg';
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

/** フォルダ内の SVG を「ファイル名（拡張子なし） → URL」にする */
function byName(modules: Record<string, string>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(modules).map(([file, url]) => [file.replace(/^.*\/|\.svg$/g, ''), url]),
  );
}

const boardFiles = byName(
  import.meta.glob<string>('./board/*.svg', { eager: true, import: 'default' }),
);
const bossFiles = byName(
  import.meta.glob<string>('./boss/*.svg', { eager: true, import: 'default' }),
);
const uiFiles = byName(import.meta.glob<string>('./ui/*.svg', { eager: true, import: 'default' }));

/** 盤面の素材（床3種・床タイル・使用不可マス・枠の角と辺。art/board.ts で生成） */
export const BOARD_ASSETS = {
  floors: [boardFiles['floor-1']!, boardFiles['floor-2']!, boardFiles['floor-3']!],
  /** 床タイル（×2床・加算床・×3床）。使用不可は blocked */
  floorTiles: {
    double: boardFiles['floor-double']!,
    add: boardFiles['floor-add']!,
    triple: boardFiles['floor-triple']!,
  },
  blocked: boardFiles['floor-blocked']!,
  frameCorner: boardFiles['frame-corner']!,
  frameEdge: boardFiles['frame-edge']!,
  /** ページの背景（CSS で敷き詰める。styles.css） */
  background: boardFiles['background']!,
};

/** ボスのアイコン（art/icons.ts で生成） */
export const BOSS_ICONS = bossFiles as Record<BossModifierId, string>;

/** UI アイコン（24×24。art/icons.ts で生成） */
export const UI_ICON_NAMES = [
  'reroll',
  'sell',
  'return',
  'rotate',
  'trial',
  'commit-switch',
  'settings',
  'volume',
  'mute',
  'ranking',
  'share',
  'debug',
  'daily',
  'back',
  'expand',
  'permit',
  'undo',
] as const;
export type UiIconName = (typeof UI_ICON_NAMES)[number];
export const UI_ICONS = uiFiles as Record<UiIconName, string>;

/** ロゴ（art/logo.ts で生成） */
export const LOGO_ASSETS = { darkBackground: logoDarkSrc, lightBackground: logoLightSrc } as const;

/** 実績アイコン（art/achievements.ts で生成）。未解除は画面側でグレーにして表示する */
export const ACHIEVEMENT_ICONS = byName(
  import.meta.glob<string>('./achievements/*.svg', { eager: true, import: 'default' }),
) as Record<AchievementId, string>;

const rocketFiles = byName(
  import.meta.glob<string>('./rocket/*.svg', { eager: true, import: 'default' }),
);

/**
 * ボルトのロケット（art/rocket.ts で生成）
 * stages[n] = n 個の部品が組み上がった絵（stages[0] は輪郭だけ、最後が完成形）
 */
export const ROCKET_ASSETS = {
  stages: Object.keys(rocketFiles)
    .filter((name) => name.startsWith('rocket-'))
    .sort((a, b) => Number(a.slice(7)) - Number(b.slice(7)))
    .map((name) => rocketFiles[name]!),
  flame: rocketFiles['flame']!,
  /** 発射の煙（カットシーンの打ち上げ用） */
  smoke: rocketFiles['smoke']!,
  /** ナットのロケット（ボルトのものより性能が良さそうな機体。カットシーン・写真用） */
  nut: rocketFiles['nut-rocket']!,
  nutLaunch: rocketFiles['nut-rocket-flame']!,
};

/**
 * キャラクターの全身（切り絵アニメの部品・ポーズ。art/characters/ で生成）
 *
 * 部品は数が多く、使う場面（上部の背景・カットシーン）も限られるので、必要なときに読み込む（URL を返す関数）。
 * 部品のつながり・関節・ポーズは rig.json（docs/characters/preview.html で一覧）
 */
const characterFiles = import.meta.glob<string>('./characters/*/**/*.svg', {
  query: '?url',
  import: 'default',
});

/**
 * ボルトの全身（よく使うポーズだけ最初から読み込む。上部の背景・タイトル画面の情景）。
 * 顔だけのアイコン（MASCOT_ASSETS）は、吹き出し・ガイド・共有カードなどで使い続ける
 */
export const BOLT_BODY_ASSETS = {
  stand: boltStandSrc,
  guts: boltGutsSrc,
  wave: boltWaveSrc,
  sad: boltSadSrc,
} as const;

/** 全身で描くキャラクター（ボルト・工場長・ナット） */
export type CharacterId = 'bolt' | 'chief' | 'nut';

/** キャラクターの素材の URL を読み込む（path は rig.json の files の値・'poses/jump.svg' など） */
export function loadCharacterAsset(character: CharacterId, path: string): Promise<string> {
  const load = characterFiles[`./characters/${character}/${path}`];
  return load ? load() : Promise.reject(new Error(`unknown ${character} asset: ${path}`));
}

/** キャラクターの素材のパスの一覧（テストで参照切れを確かめる） */
export function characterAssetPaths(character: CharacterId): string[] {
  const prefix = `./characters/${character}/`;
  return Object.keys(characterFiles)
    .filter((k) => k.startsWith(prefix))
    .map((k) => k.slice(prefix.length));
}

const titleFiles = byName(
  import.meta.glob<string>('./title/*.svg', { eager: true, import: 'default' }),
);

/** タイトル画面の背景（art/title.ts で生成） */
export const TITLE_ASSETS = {
  factory: titleFiles['factory']!,
  gear: titleFiles['gear']!,
};

const backdropFiles = byName(
  import.meta.glob<string>('./backdrop/*.svg', { eager: true, import: 'default' }),
);

/** ゲーム画面の上部の帯とラン終了画面の背景（art/backdrop.ts で生成）: 窓の外の景色（朝・昼・夜）・組み立て台・警告灯・発射台 */
export const BACKDROP_ASSETS = {
  sky: [backdropFiles['sky-0']!, backdropFiles['sky-1']!, backdropFiles['sky-2']!],
  gantry: backdropFiles['gantry']!,
  beacon: backdropFiles['beacon']!,
  /** ラン終了画面の発射台（夜空・投光器・台） */
  launchpad: backdropFiles['launchpad']!,
  /** シフト達成の印（緑のスタンプ）と、全シフトクリアの記念プレート（真鍮の札に星） */
  approval: backdropFiles['approval']!,
  plaque: backdropFiles['plaque']!,
};

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
