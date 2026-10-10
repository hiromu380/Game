/**
 * ボスのアイコン（64×64・警告の標識風）と UI アイコン（24×24・線2px）
 *
 * - ボス: 黄色の標識に赤い縁。中のピクトグラムでルールを表す（夜のシフトの予告・今日の特殊ルールに出す）
 * - 今日の出来事: 緑の角丸の札（良い知らせ。ボスの丸い警告の標識と形と色で見分ける）に、出来事のピクトグラム
 * - UI: 暗いボタンの上に置くので、線は文字色（UI_COLORS.text）。アクセントに黄・赤を少しだけ使う
 *   24px で意味がわかるよう、線の数を減らす（docs/art-style.md「読みやすさの基準」）
 */
import type { BossModifierId, DayEventId } from '@chain-factory/sim';
import {
  BOARD_COLORS as B,
  INK,
  MATERIAL_COLORS as M,
  UI_COLORS as U,
} from '../src/assets/palette';
import { circle, el, line, outlined, path, polygon, rect, svg } from './svg';

const O = INK.outline;

// ---- ボス ----

/** 標識の土台（黄色の円・赤い縁） */
const sign = () => [
  circle(32, 32, 28, { fill: U.missed, stroke: O, 'stroke-width': 3 }),
  circle(32, 32, 21, { fill: U.accent, stroke: O, 'stroke-width': 2 }),
];

const BOSS: Record<BossModifierId, string[]> = {
  // 油切れ: 空になりかけた油滴と下向きの矢印
  lowOil: [
    path('M28 16 q-9 13 -9 19 a9 9 0 0 0 18 0 q0 -6 -9 -19 Z', outlined(INK.white, 3)),
    path('M20.5 38 a8 8 0 0 0 15 0 Z', { fill: M.oil }),
    path('M43 22 V40 M38 35 l5 6 l5 -6', line(O, 3)),
  ],
  // 床の補修工事: 工事のコーン
  repairWork: [
    polygon('32,14 42,44 22,44', outlined(M.fire, 3)),
    path('M26.5 32 H37.5', line(INK.white, 4)),
    rect(17, 44, 30, 5, outlined(INK.steelDark, 2.5), 2),
  ],
  // 出荷検査強化: 虫めがねと「½」
  strictInspection: [
    circle(28, 29, 10, outlined(M.glass, 3)),
    path('M35 36 L45 46', line(O, 5)),
    path('M25 25 v7 M23 27 l2 -2 M31 25 l-6 9 M29 30 h4 l-4 4 h4', line(O, 1.8)),
  ],
  // 短縮営業: 時計（針が早く進む）と早送り
  shortShift: [
    circle(28, 32, 12, outlined(INK.white, 3)),
    path('M28 24 V32 L34 35', line(O, 2.5)),
    polygon('41,26 47,32 41,38', { fill: U.missed, stroke: O, 'stroke-width': 1.5 }),
    polygon('46,26 52,32 46,38', { fill: U.missed, stroke: O, 'stroke-width': 1.5 }),
  ],
  // 部品不足: 空っぽの段ボール箱
  partShortage: [
    path('M18 28 L32 22 L46 28 V44 L32 50 L18 44 Z', outlined(M.cardboard, 3)),
    path('M18 28 L32 34 L46 28 M32 34 V50', line(O, 2)),
    path('M18 28 L12 22 M46 28 L52 22', line(O, 3)),
    path('M27 39 h10', line(U.missed, 3.5)),
  ],
};

// ---- 今日の出来事 ----

/** 札の土台（緑の角丸の板・白い縁）。ボスの丸い標識と形で見分ける */
const card = () => [
  rect(5, 5, 54, 54, { fill: B.floorAdd, stroke: O, 'stroke-width': 3 }, 12),
  rect(10, 10, 44, 44, { fill: '#e8f5e9', stroke: O, 'stroke-width': 2 }, 8),
];

/** 硬貨（内側の輪と光。マイナス記号に見えないよう、横線は入れない） */
const coin = (x: number, y: number, r = 7) => [
  circle(x, y, r, outlined(M.coin, 2.5)),
  circle(x, y, r * 0.55, { fill: 'none', stroke: M.cardboardDark, 'stroke-width': 1.5 }),
  path(
    `M${x - r * 0.5} ${y - r * 0.2} a${r * 0.5} ${r * 0.5} 0 0 1 ${r * 0.4} ${-r * 0.35}`,
    line(INK.white, 1.5),
  ),
];

const EVENTS: Record<DayEventId, string[]> = {
  // 差し入れ: 紙袋と、こぼれる硬貨
  supplies: [
    path('M19 26 H41 L39 48 H21 Z', outlined(M.cardboard, 3)),
    path('M25 26 v-4 a5 5 0 0 1 10 0 v4', line(O, 2.5)),
    ...coin(43, 42, 6),
  ],
  // 試供品: リボンのかかった箱
  sample: [
    rect(18, 28, 28, 20, outlined(U.primary, 3), 2),
    rect(16, 23, 32, 7, outlined(U.primary, 2.5), 2),
    path('M32 23 V48', line(M.coin, 4)),
    path('M32 23 q-8 -8 -10 -1 q2 3 10 1 q8 2 10 -1 q-2 -7 -10 1', outlined(M.coin, 2)),
  ],
  // 特売日: 値札と「%」
  sale: [
    path('M16 30 L30 16 H47 V33 L33 47 Z', outlined(U.accent, 3)),
    circle(41, 22, 2.5, { fill: O }),
    path('M25 38 L37 26', line(O, 2.5)),
    circle(26, 29, 2.5, outlined(INK.white, 1.5)),
    circle(36, 35, 2.5, outlined(INK.white, 1.5)),
  ],
  // 在庫整理: 段ボールと、上向きの矢印（高く買い取る）
  clearance: [
    path('M14 32 L27 27 L40 32 V46 L27 51 L14 46 Z', outlined(M.cardboard, 3)),
    path('M14 32 L27 37 L40 32 M27 37 V51', line(O, 2)),
    path('M46 40 V16 M40 22 l6 -6 l6 6', line(B.floorAdd, 4)),
  ],
  // 残業手当: 三日月と硬貨
  overtimePay: [
    path('M30 15 a12 12 0 1 0 12 17 a10 10 0 1 1 -12 -17 Z', outlined(M.sun, 3)),
    ...coin(41, 41, 8),
  ],
  // 腕まくり: 下がるノルマの棒と、下向きの矢印
  rollUpSleeves: [
    rect(16, 20, 9, 26, outlined(U.missed, 2.5), 2),
    rect(28, 30, 9, 16, outlined(U.accent, 2.5), 2),
    path('M45 16 V40 M39 34 l6 6 l6 -6', line(B.floorAdd, 4)),
  ],
  // 床の出来事（真ん中）: 盤面の真ん中に ×2 床
  floorCenter: [
    rect(16, 16, 32, 32, { fill: INK.steelDark, stroke: O, 'stroke-width': 2.5 }, 3),
    path('M26.7 16 V48 M37.3 16 V48 M16 26.7 H48 M16 37.3 H48', line(O, 1.2)),
    rect(27.5, 27.5, 9, 9, { fill: B.floorDouble, stroke: O, 'stroke-width': 1.5 }, 1),
  ],
  // 床の修理: スパナ
  floorRepair: [
    path(
      'M20 44 L36 28 a8 8 0 0 1 10 -10 l-5 5 l1 4 l4 1 l5 -5 a8 8 0 0 1 -10 10 L25 49 a3.5 3.5 0 0 1 -5 -5 Z',
      outlined(INK.steel, 2.5),
    ),
  ],
  // 加算床が湧く: 緑の床と「+」を2枚
  floorAdds: [
    rect(14, 26, 18, 18, outlined(B.floorAdd, 2.5), 2),
    path('M23 30 V40 M18 35 H28', line(INK.white, 2.5)),
    rect(32, 18, 18, 18, outlined(B.floorAdd, 2.5), 2),
    path('M41 22 V32 M36 27 H46', line(INK.white, 2.5)),
  ],
};

// ---- UI ----

const S = U.text;
const ui = (strokeWidth = 2) => line(S, strokeWidth);

const UI: Record<string, string[]> = {
  // リロール: 2本の回る矢印
  reroll: [
    path('M5 11 a7 7 0 0 1 12.5 -3.5', ui()),
    polygon('19,4 19,10 13,9', { fill: S }),
    path('M19 13 a7 7 0 0 1 -12.5 3.5', ui()),
    polygon('5,20 5,14 11,15', { fill: S }),
  ],
  // 売却: 硬貨と上向きの矢印（お金が戻ってくる）
  sell: [
    circle(10, 14, 6, { fill: M.coin, stroke: O, 'stroke-width': 1.5 }),
    path('M8 14 h4', line(O, 1.5)),
    path('M18 20 V5 M14 9 l4 -4 l4 4', ui()),
  ],
  // 手持ちに戻す: 箱へ入る下向きの矢印
  return: [path('M4 13 V20 H20 V13', ui()), path('M12 3 V14 M8 10 l4 4 l4 -4', ui())],
  // 回転: 時計回りの矢印
  rotate: [path('M18 12 a6 6 0 1 1 -2 -4.5', ui()), polygon('20,3 20,10 13,9', { fill: S })],
  // 元に戻す: 左へ戻る曲がった矢印
  undo: [path('M8 9 H15 a5 5 0 0 1 0 10 H9', ui()), polygon('3,9 9,4 9,14', { fill: S })],
  // 試運転: 再生ボタン（輪郭だけ）
  trial: [polygon('7,4 20,12 7,20', { ...ui(), 'stroke-linejoin': 'round' })],
  // 本番: 大きな赤い押しボタン（作り込む）
  'commit-switch': [
    rect(3, 14, 18, 7, { fill: U.accent, stroke: O, 'stroke-width': 1.5 }, 2),
    path('M5 14 l3 7 M10 14 l3 7 M15 14 l3 7', line(U['hazard-black'], 1.5)),
    path('M6 13 a6 5 0 0 1 12 0 v1 H6 Z', { fill: U.primary, stroke: O, 'stroke-width': 1.5 }),
    path('M8.5 10 q2 -2 4 -2', line(INK.white, 1.2)),
  ],
  // 設定: 歯車
  settings: [
    circle(12, 12, 3, ui()),
    path(
      'M12 3 v2.5 M12 18.5 v2.5 M3 12 h2.5 M18.5 12 h2.5 M5.6 5.6 l1.8 1.8 M16.6 16.6 l1.8 1.8 M5.6 18.4 l1.8 -1.8 M16.6 7.4 l1.8 -1.8',
      ui(2.5),
    ),
    circle(12, 12, 6.5, ui()),
  ],
  // 音量: スピーカーと音の波
  volume: [
    polygon('4,9 8,9 13,5 13,19 8,15 4,15', { fill: S }),
    path('M16 9 a4 4 0 0 1 0 6 M18.5 6.5 a7.5 7.5 0 0 1 0 11', ui()),
  ],
  // ミュート: スピーカーと ×
  mute: [
    polygon('4,9 8,9 13,5 13,19 8,15 4,15', { fill: S }),
    path('M16 9 l5 6 M21 9 l-5 6', line(U.missed, 2)),
  ],
  // ランキング: 表彰台
  ranking: [
    rect(9, 7, 6, 14, { fill: U.accent, stroke: O, 'stroke-width': 1 }),
    rect(3, 12, 6, 9, { fill: S }),
    rect(15, 15, 6, 6, { fill: S }),
    path('M2 21 H22', ui()),
  ],
  // シェア: 箱から上へ出る矢印
  share: [path('M8 10 H5 V21 H19 V10 H16', ui()), path('M12 15 V3 M8 7 l4 -4 l4 4', ui())],
  // デバッグ: 虫
  debug: [
    el('ellipse', { cx: 12, cy: 14, rx: 5, ry: 6.5, ...ui() }),
    path('M12 8 V21 M7 12 H3 M17 12 h4 M7 17 H3 M17 17 h4 M9 7 l-2 -3 M15 7 l2 -3', ui(1.5)),
  ],
  // 週替わりチャレンジ: カレンダーと星
  weekly: [
    rect(3, 5, 18, 16, ui(), 2),
    path('M3 10 H21 M8 3 V7 M16 3 V7', ui()),
    polygon('12,12 13.2,14.6 16,15 14,16.8 14.5,19.5 12,18.2 9.5,19.5 10,16.8 8,15 10.8,14.6', {
      fill: U.accent,
    }),
  ],
  // ランダム配置権: 券の中に床の鉄板（×2床の琥珀色）
  permit: [
    path('M3 7 H21 V10 a2 2 0 0 0 0 4 V17 H3 V14 a2 2 0 0 0 0 -4 Z', ui()),
    rect(9, 9, 6, 6, { fill: B.floorDouble, stroke: O, 'stroke-width': 1 }, 1),
  ],
  // 戻る: 左向きの矢印
  back: [path('M20 12 H5 M11 6 l-6 6 l6 6', ui())],
  // 工場拡張: 四隅へ広がる矢印（メタ進行の工場拡張の目標）
  expand: [
    rect(7, 7, 10, 10, ui(), 1),
    path('M3 7 V3 H7 M17 3 H21 V7 M21 17 V21 H17 M7 21 H3 V17', line(U.accent, 2)),
  ],
};

export const UI_ICON_NAMES = Object.keys(UI);

/** ボスのアイコンの中身（64×64。実績アイコンに流用する） */
export const bossBody = (id: BossModifierId): string[] => [...sign(), ...BOSS[id]];
/** UI アイコンの中身（24×24） */
export const uiBody = (name: string): string[] => UI[name]!;

export function iconFiles(): Record<string, string> {
  const files: Record<string, string> = {};
  for (const [id, body] of Object.entries(BOSS)) {
    files[`src/assets/boss/${id}.svg`] = svg(`ボス: ${id}`, [...sign(), ...body]);
  }
  for (const [id, body] of Object.entries(EVENTS)) {
    files[`src/assets/events/${id}.svg`] = svg(`今日の出来事: ${id}`, [...card(), ...body]);
  }
  for (const [name, body] of Object.entries(UI)) {
    files[`src/assets/ui/${name}.svg`] = svg(`UI アイコン: ${name}`, body, '0 0 24 24');
  }
  return files;
}
