/**
 * ストーリー演出（セリフなしのカットシーン）の絵コンテ（段階1）
 *
 * 各シーンの主要なコマを簡易な SVG で描き、時間の表（何秒目に何が動くか・音）と並べて docs/story/storyboard.html に書き出す。
 * キャラクターは設定画の部品とポーズ（art/characters）、背景はキービジュアルの層（art/keyvisual/layers.ts）を使う。
 * 実行: pnpm --filter @chain-factory/client exec tsx art/story/storyboard.ts
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  BOARD_COLORS as BC,
  FAMILY_COLORS as F,
  INK,
  MATERIAL_COLORS as M,
  ROCKET_COLORS as R,
  SIGNAL_TIERS,
  TITLE_COLORS as T,
} from '../../src/assets/palette';
import { POSES } from '../characters/bolt';
import { CHIEF_POSES, composeChief } from '../characters/chief';
import type { Pose } from '../characters/rig';
import { bolt, chainLight, duskSky, embed, factoryRow, filters, stars } from '../keyvisual/layers';
import { lettering } from '../lettering';
import { circle, el, group, line, path, rect, svg } from '../svg';

const W = 320;
const H = 180;
const O = INK.outline;

// =============================================================================
// 背景・小物
// =============================================================================
/** 夜の工場街（遠景）: 空・星・工場のシルエット */
const night = (horizon = 140, factoryScale = 0.55) => [
  ...duskSky(W, H, horizon),
  ...stars(W, horizon, 26),
  ...factoryRow(H + 6, W, factoryScale),
];

/** 失敗の場面の冷たい色（暗い青を重ねる） */
const cold = () => rect(0, 0, W, H, { fill: '#0d1b2a', opacity: 0.45 });

/** 工場の屋根（座る・登る） */
const roof = (y: number) => [
  rect(0, y, W, H - y, { fill: T.factory }),
  rect(0, y, W, 5, { fill: T['factory-edge'] }),
];

/** 作業場の床（工場の中） */
const floor = (y: number) => [
  rect(0, 0, W, H, { fill: BC.background }),
  rect(0, y, W, H - y, { fill: BC.floorA }),
  path(`M0 ${y} H${W}`, line(BC.hazardYellow, 3)),
];

/** 絵の吹き出し（考えていることを絵で）。中身は内側に置く */
const bubble = (x: number, y: number, r: number, inner: string[]) => [
  circle(x - r * 0.9, y + r * 1.1, r * 0.12, { fill: INK.white, stroke: O, 'stroke-width': 1.5 }),
  circle(x - r * 0.65, y + r * 0.85, r * 0.18, { fill: INK.white, stroke: O, 'stroke-width': 1.5 }),
  el('ellipse', {
    cx: x,
    cy: y,
    rx: r * 1.25,
    ry: r,
    fill: INK.white,
    stroke: O,
    'stroke-width': 2,
  }),
  ...inner,
];

/** ガラクタの山（設計図が埋まっている） */
const junk = (x: number, y: number) => [
  path(
    `M${x - 40} ${y} Q${x - 20} ${y - 34} ${x} ${y - 30} Q${x + 24} ${y - 40} ${x + 42} ${y} Z`,
    {
      fill: INK.steelDark,
      stroke: O,
      'stroke-width': 2,
    },
  ),
  circle(x - 14, y - 18, 7, { fill: INK.steel, stroke: O, 'stroke-width': 1.5 }),
  rect(x + 6, y - 26, 14, 9, { fill: R.accent, stroke: O, 'stroke-width': 1.5 }, 2),
  rect(x - 4, y - 12, 18, 6, { fill: R.window, stroke: O, 'stroke-width': 1.5 }, 1),
];

/** ノルマの箱（出荷の段ボール。ゲームのノルマの記号） */
const quotaBox = (x: number, y: number, s = 1) =>
  group(
    { transform: `translate(${x} ${y}) scale(${s})` },
    rect(-14, -24, 28, 24, { fill: M.cardboard, stroke: O, 'stroke-width': 2 }, 2),
    path('M-14 -16 H14', line(M.cardboardDark, 2)),
    path('M-6 -10 h12', line(O, 2)),
  );

/** ロケット（段階 stage/9）。中心 x・下端 y・高さ */
const rocketAt = (stage: number, cx: number, bottom: number, height: number) =>
  embed(
    `rocket/rocket-${stage}.svg`,
    cx - (height * 96) / 104 / 2,
    bottom - height,
    (height * 96) / 104,
    height,
  );

/** 工場長（天井クレーン）を、台車の下を地面 (x, ground) に合わせて高さ height で置く */
const chief = (pose: Pose, x: number, ground: number, height: number) => {
  const s = height / 190;
  return group({ transform: `translate(${x} ${ground}) scale(${s})` }, ...composeChief(pose));
};

/** 数字（カウントダウン） */
const bigDigit = (d: string, cx: number, y: number, scale: number) =>
  lettering(d, {
    x: cx,
    y,
    scale,
    fill: SIGNAL_TIERS[1]!,
    outline: O,
    weight: 6,
    anchor: 'middle',
  });

/** 動きの矢印（絵コンテの注記: どちらへ動くか） */
const arrow = (d: string) => [
  path(d, {
    fill: 'none',
    stroke: '#4dd0e1',
    'stroke-width': 2.5,
    'stroke-dasharray': '5 4',
    'stroke-linecap': 'round',
  }),
];

/** 月面（エンディング） */
const moon = () => [
  rect(0, 0, W, H, { fill: '#0b1026' }),
  ...stars(W, H, 50),
  // 遠くの地球（青い丸）
  circle(40, 34, 14, { fill: '#3d6fb6', stroke: O, 'stroke-width': 2 }),
  path('M30 30 q6 -4 10 2 q4 4 10 0', line('#69f0ae', 2)),
  path(`M0 132 Q80 118 160 128 T${W} 124 V${H} H0 Z`, {
    fill: '#cfd3dc',
    stroke: O,
    'stroke-width': 2,
  }),
  circle(70, 150, 8, { fill: '#b0b5c1' }),
  circle(230, 160, 11, { fill: '#b0b5c1' }),
];

/** 地平線の向こうの、別の工場の明かり（伏線）。lit = 灯った窓の数 */
const farFactory = (x: number, y: number, lit: number) => [
  path(
    `M${x - 34} ${y} V${y - 14} L${x - 24} ${y - 22} V${y - 14} L${x - 14} ${y - 22} V${y - 14} L${x - 4} ${y - 22} V${y - 30} H${x + 4} V${y - 14} H${x + 30} V${y} Z`,
    {
      fill: '#1a1d2e',
      stroke: '#2a3150',
      'stroke-width': 1.5,
    },
  ),
  ...Array.from({ length: 5 }, (_, i) =>
    rect(x - 30 + i * 12, y - 9, 6, 5, { fill: i < lit ? M.sun : '#2a3150' }),
  ),
];

/** 見知らぬロボのアンテナの光（遠くで点滅し返す） */
const strangerLamp = (x: number, y: number) => [
  el('circle', {
    cx: x,
    cy: y,
    r: 9,
    fill: F.retrigger.main,
    opacity: 0.5,
    filter: 'url(#kv-glow)',
  }),
  circle(x, y, 2.6, { fill: F.retrigger.light }),
  path(`M${x} ${y + 3} V${y + 10}`, line('#2a3150', 2)),
];

// =============================================================================
// シーン（コマ・時間の表）
// =============================================================================
interface Frame {
  time: string;
  note: string;
  body: string[];
}
interface Scene {
  id: string;
  title: string;
  /** 何を伝えるシーンか（1行） */
  message: string;
  length: string;
  frames: Frame[];
  /** 時間の表: [時刻, 動き, 音] */
  timeline: [string, string, string][];
}

const bp = (key: keyof typeof POSES) => POSES[key]!.pose;
const cp = (key: keyof typeof CHIEF_POSES) => CHIEF_POSES[key]!.pose;
const withFace = (pose: Pose, head: string): Pose => ({
  ...pose,
  variants: { ...pose.variants, head },
});
/** ヘルメットを脱いだ工場長（ひとりのとき） */
const withHatOff = (pose: Pose): Pose => ({
  ...pose,
  offsets: { ...pose.offsets, hat: [60, 150] },
  angles: { ...pose.angles, hat: 80 },
});

const SCENES: Scene[] = [
  {
    id: 'opening',
    title: 'オープニング（初回起動時のみ自動再生）',
    message: '夢: 小さなロボットが星へ行く夢を見つけ、工場長との取引で、それを叶える道ができる',
    length: '約 40 秒（いつでもスキップ可）',
    frames: [
      {
        time: '0〜6 秒',
        note: '夜の工場。ボルトが最後の荷を片付け、汗をぬぐって伸びをする',
        body: [
          ...floor(140),
          quotaBox(250, 140),
          bolt(withFace(bp('wave'), 'tired'), 130, 140, 92),
        ],
      },
      {
        time: '6〜12 秒',
        note: '屋根に登って腰かけ、星空を見上げる（カメラは引き）',
        body: [...night(120), ...roof(128), bolt(bp('sitStars'), 150, 136, 64)],
      },
      {
        time: '12〜17 秒',
        note: '流れ星。頭の上に絵の吹き出し（ロケットと星）が浮かぶ',
        body: [
          ...night(120),
          ...chainLight(
            [
              [240, 18],
              [300, 6],
            ],
            3,
            1,
          ),
          ...roof(128),
          bolt(bp('sitStars'), 110, 136, 64),
          ...bubble(196, 52, 30, [
            rocketAt(9, 186, 74, 44),
            circle(214, 40, 4, { fill: M.sun, stroke: O, 'stroke-width': 1.5 }),
          ]),
        ],
      },
      {
        time: '17〜25 秒',
        note: 'ガラクタの山から、ロケットの設計図（絵だけ）を見つけて広げ、目を輝かせる',
        body: [...floor(150), ...junk(70, 150), bolt(bp('blueprint'), 170, 150, 110)],
      },
      {
        time: '25〜35 秒',
        note: '工場長（クレーン）がノルマの箱を指し、ロケットの部品を吊って見せる。ボルトはうなずく',
        body: [
          ...floor(160),
          quotaBox(300, 160, 1.2),
          chief(cp('offer'), 200, 160, 150),
          bolt(withFace(bp('nod'), 'determined'), 70, 160, 90),
        ],
      },
      {
        time: '35〜40 秒',
        note: 'ボルトがスイッチの前でガッツポーズ → 盤面へズームして最初のシフトへ',
        body: [
          ...floor(150),
          embed('parts/switch.svg', 180, 110, 44, 44),
          bolt(bp('guts'), 110, 150, 110),
          ...arrow('M230 60 L290 30'),
        ],
      },
    ],
    timeline: [
      [
        '0.0',
        '工場の中。荷を片付ける・汗をぬぐう・伸び',
        '機械の止まる音（低い）→ ボルトの電子音「ピポ」',
      ],
      ['6.0', 'はしごを登る（歩く）→ 屋根に腰かけ・見上げる', '足音（金属）×4・夜の静けさ'],
      ['12.0', '流れ星（左上 → 右下）。吹き出しがふくらむ', 'キラッ（高い音）→ 吹き出しのポン'],
      [
        '17.0',
        '屋根を降り、ガラクタの山を掘る → 設計図を広げる・目を輝かせる',
        'ガラクタの音・紙を広げる音・電子音（上がる音階）',
      ],
      [
        '25.0',
        '工場長が画面右から入る（台車の音）。運転席がボルトを見下ろす → ノルマの箱を指す → 部品を吊って見せる',
        '台車のゴロゴロ・ブザー（低い・工場長の声）',
      ],
      [
        '31.0',
        'ボルトが箱と部品を見比べる（首を振って見比べる）→ 大きくうなずく',
        '電子音「ピ？」→「ピポ！」',
      ],
      [
        '35.0',
        'スイッチの前へ歩く → ガッツポーズ → カメラが盤面へ寄る → フェードしてゲームへ',
        'スイッチのカチ（溜めの音につながる）',
      ],
    ],
  },
  {
    id: 'interlude1',
    title: '日ごとの幕間 1日目（1日をクリアしたとき）',
    message: '前進: ノルマを満たすと部品がもらえ、ロケットが少しずつ組み上がる',
    length: '約 8 秒（スキップ可）',
    frames: [
      {
        time: '0〜3 秒',
        note: '工場長が今日の部品（3つ）を吊って渡す',
        body: [
          ...night(130),
          ...floor(160).slice(1),
          chief(cp('offer'), 210, 160, 150),
          bolt(bp('stand'), 90, 160, 80),
        ],
      },
      {
        time: '3〜6 秒',
        note: 'ボルトがロケットに取り付ける（0/9 → 3/9。上部の背景と同じ絵）',
        body: [
          ...night(130),
          rocketAt(3, 200, 160, 110),
          bolt(withFace(bp('guts'), 'happy'), 120, 160, 80),
        ],
      },
      {
        time: '6〜8 秒',
        note: 'ボルトが手を振り、朝へ',
        body: [...night(130), rocketAt(3, 200, 160, 110), bolt(bp('wave'), 120, 160, 80)],
      },
    ],
    timeline: [
      ['0.0', '工場長が部品を吊って降ろす（毎日同じ型）', 'クレーンの巻き上げ音'],
      [
        '3.0',
        'ボルトが部品を抱えてロケットへ → 取り付け（1部品ずつ光る）',
        'カン・カン・カン（金属・音階が上がる）',
      ],
      ['6.0', '手を振る → 朝の光に切り替え', '電子音「ピポ」→ 次のシフトの音'],
    ],
  },
  {
    id: 'interlude2',
    title: '日ごとの幕間 2日目',
    message: '前進（変化）: 部品が大きく重くなる。それでも運ぶ',
    length: '約 8 秒（スキップ可）',
    frames: [
      {
        time: '0〜3 秒',
        note: '工場長が胴体の部品を渡す。重くてよろける',
        body: [
          ...night(130),
          chief(cp('neutral'), 230, 160, 150),
          bolt(bp('stagger'), 120, 160, 84),
        ],
      },
      {
        time: '3〜6 秒',
        note: '取り付け（3/9 → 6/9）。汗をぬぐって小さく跳ねる',
        body: [
          ...night(130),
          rocketAt(6, 200, 160, 110),
          bolt(withFace(bp('jump'), 'tired'), 120, 160, 80),
        ],
      },
    ],
    timeline: [
      ['0.0', '大きな部品を受け取る → よろけて2歩さがる', 'ドスン・電子音「ピェ」'],
      ['3.0', '取り付け → 汗をぬぐう → 小さく跳ねる', 'カン×3（音階）・ピポ'],
    ],
  },
  {
    id: 'gameOver',
    title: 'ゲームオーバー（ノルマ未達）',
    message: '失敗 → 再挑戦: 組みかけのロケットは崩れるが、設計図を拾い直して顔を上げる',
    length: '約 4 秒',
    frames: [
      {
        time: '0〜1.2 秒',
        note: '工場長が首を振る（冷たい色）',
        body: [
          ...night(130),
          cold(),
          chief(cp('shake'), 220, 160, 150),
          bolt(withFace(bp('stand'), 'surprised'), 100, 160, 80),
        ],
      },
      {
        time: '1.2〜2.6 秒',
        note: '組みかけのロケットが崩れる。ボルトがしょんぼり',
        body: [
          ...night(130),
          cold(),
          rocketAt(0, 220, 160, 110),
          ...arrow('M200 70 L190 140 M235 80 L250 140'),
          bolt(bp('sad'), 110, 160, 80),
        ],
      },
      {
        time: '2.6〜4 秒',
        note: '設計図を拾い直し、顔を上げる（暖かい色に戻る）→「もう1回」へ',
        body: [...night(130), bolt(withFace(bp('blueprint'), 'determined'), 160, 160, 96)],
      },
    ],
    timeline: [
      ['0.0', '画面が冷たい色へ。工場長が首を振る', '低いブザー（2回）'],
      ['1.2', 'ロケットの部品がばらばらに落ちる → しょんぼり', 'ガラガラ（下がる音階）'],
      ['2.6', '足もとの設計図を拾う → 顔を上げる・暖色に戻る', '電子音（上がる2音）→ 結果画面へ'],
    ],
  },
  {
    id: 'ending',
    title: 'エンディング（全シフトクリア・製品版）',
    message:
      '達成 → 伏線: 星に着いたボルトの先に、もう一つの工場と光の連鎖が待っている。工場長はそのことを知っていたらしい',
    length: '約 55 秒（スキップ可。ロゴのあとの短い場面を含む）',
    frames: [
      {
        time: '0〜8 秒',
        note: '最後の部品を取り付け、ロケットが完成（9/9）',
        body: [
          ...night(130),
          rocketAt(9, 210, 160, 120),
          bolt(withFace(bp('guts'), 'sparkle'), 110, 160, 84),
        ],
      },
      {
        time: '8〜14 秒',
        note: '工場長が初めてヘルメットを上げる（目が和らぐ）',
        body: [...night(130), chief(cp('tip'), 180, 160, 150), bolt(bp('wave'), 80, 160, 80)],
      },
      {
        time: '14〜22 秒',
        note: 'ボルトが窓に乗り込む。カウントダウン（数字だけ）',
        body: [...night(130), rocketAt(9, 160, 160, 120), bigDigit('3', 260, 30, 2.2)],
      },
      {
        time: '22〜32 秒',
        note: '打ち上げ。夜の工場街を見下ろしながら上昇（カメラが下へ流れる）',
        body: [
          ...night(150, 0.5),
          ...chainLight(
            [
              [160, 175],
              [160, 95],
            ],
            6,
            2,
          ),
          ...embedRocketLaunch(160, 90, 80),
          ...arrow('M210 140 L210 40'),
        ],
      },
      {
        time: '32〜42 秒',
        note: '月に着く。ボルトが降りて跳ねる。遠くに地球',
        body: [...moon(), rocketAt(9, 220, 130, 90), bolt(bp('jump'), 130, 132, 70)],
      },
      {
        time: '42〜50 秒（伏線）',
        note: 'ボルトの足もとから光の線が地平線へ延び、その先の見知らぬ工場の窓が1つずつ灯る。最後に遠くのアンテナの光が、ボルトに点滅を返す → 暗転・ロゴ',
        body: [
          ...moon(),
          ...chainLight(
            [
              [100, 136],
              [180, 128],
              [262, 120],
            ],
            3,
            3,
          ),
          ...farFactory(280, 122, 3),
          ...strangerLamp(276, 86),
          bolt(withFace(bp('lookUp'), 'surprised'), 80, 140, 60),
        ],
      },
      {
        time: '50〜55 秒（ロゴのあと・伏線）',
        note: '地球の工場。工場長がひとり、柱に貼った古い写真を見る。写っているのは、水色のアンテナのロボと、別の手作りの水色のロケット（工場長の目が和らぐ）',
        body: [
          ...night(130),
          cold(),
          chief(withHatOff({ ...cp('neutral'), variants: { cab: 'soft' } }), 110, 160, 150),
          group(
            { transform: 'translate(200 40) rotate(4)' },
            rect(0, 0, 76, 60, { fill: M.paper, stroke: O, 'stroke-width': 2 }, 2),
            rect(5, 5, 66, 44, { fill: '#2a3150' }),
            circle(22, 22, 7, { fill: F.retrigger.main, stroke: O, 'stroke-width': 1.5 }),
            rect(16, 29, 12, 14, { fill: F.retrigger.main, stroke: O, 'stroke-width': 1.5 }, 2),
            path('M22 15 V8', line(O, 1.5)),
            circle(22, 7, 2, { fill: F.retrigger.light }),
            // 別の手作りのロケット（水色・丸い先端。ボルトのロケットとは違う形）
            path('M52 10 Q60 18 60 30 V42 H44 V30 Q44 18 52 10 Z', {
              fill: F.retrigger.light,
              stroke: O,
              'stroke-width': 1.5,
            }),
            path('M44 36 L38 46 H44 M60 36 L66 46 H60', {
              fill: F.retrigger.main,
              stroke: O,
              'stroke-width': 1.5,
            }),
            circle(52, 26, 3.5, { fill: R.window, stroke: O, 'stroke-width': 1.2 }),
            circle(38, 2, 2.5, { fill: INK.steelLight, stroke: O, 'stroke-width': 1 }),
          ),
        ],
      },
    ],
    timeline: [
      ['0.0', '最後の部品を取り付ける → ロケット全体が一度光る', 'カン×3 → 完成の和音'],
      [
        '8.0',
        '工場長がヘルメットを持ち上げ、まぶたが上がる（初めて和らぐ）',
        '短いブザー（高め・やさしい）',
      ],
      ['14.0', 'ボルトが手を振って窓へ。カウントダウン 3 → 2 → 1', '電子音の秒読み（ピッ×3）'],
      [
        '22.0',
        '点火・煙 → 上昇。工場街・屋根・クレーンが下へ流れ、工場長が見上げる',
        '噴射音（だんだん高く）。光は盤面の範囲・不透明度の上限内',
      ],
      [
        '32.0',
        '月に着地 → ボルトが降りて跳ねる。遠くに地球',
        '着地のドスン → 静けさ・電子音「ピポ！」',
      ],
      [
        '42.0',
        '足もとの地面が小さく光る → 光の線（連鎖の信号）が地平線へ走る → 見知らぬ工場の窓が1つずつ灯る',
        'ゲームの連鎖の音階（ゆっくり・遠く）',
      ],
      [
        '47.0',
        '工場の屋根で、見知らぬアンテナの光が2回点滅を返す。ボルトが驚いて見上げる → 暗転',
        '遠くの電子音（ボルトと違う声色）→ 無音',
      ],
      ['50.0', 'ロゴ（暗い背景）', '―'],
      [
        '52.0',
        '（ロゴのあと）地球の工場。工場長が柱の古い写真を見る → 写真の中のロボのアンテナが、遠くの光と同じ水色 → 暗転 → 延長戦の案内へ',
        'クレーンのきしむ音・遠くの電子音（月の光と同じ声色）',
      ],
    ],
  },
  {
    id: 'demoTeaser',
    title: '体験版の予告（エンディングの代わり）',
    message: '期待: ロケットの完成と、その先がある',
    length: '約 6 秒',
    frames: [
      {
        time: '0〜6 秒',
        note: 'ロケットのシルエットと星。「つづきは製品版で」（i18n の文言）',
        body: [
          ...night(140),
          group({ filter: 'brightness(0)' }, rocketAt(9, 160, 150, 120)),
          rect(70, 152, 180, 22, { fill: '#000', opacity: 0.4 }, 4),
          `<text x="160" y="168" text-anchor="middle" font-size="12" fill="#fff">（つづきは製品版で）</text>`,
        ],
      },
    ],
    timeline: [
      ['0.0', '暗い空にロケットのシルエットが浮かぶ（ゆっくり寄る）', '低い持続音'],
      ['3.0', '文言が出る → ストアへの案内', '電子音「ピポ」'],
    ],
  },
];

/** 打ち上げ中のロケット（炎・煙つき） */
function embedRocketLaunch(cx: number, bottom: number, height: number): string[] {
  const w = (height * 96) / 104;
  return [
    embed('rocket/smoke.svg', cx - 40, bottom + 40, 80, 52),
    embed('rocket/flame.svg', cx - 16, bottom - 6, 32, 26),
    embed('rocket/rocket-9.svg', cx - w / 2, bottom - height, w, height),
  ];
}

// =============================================================================
// 書き出し
// =============================================================================
const frameSvg = (f: Frame) =>
  svg(f.note, [filters(0.5), ...f.body], `0 0 ${W} ${H}`).replace(
    '<svg ',
    `<svg width="${W}" height="${H}" `,
  );

function html(): string {
  const scenes = SCENES.map(
    (s) => `
    <section id="${s.id}">
      <h2>${s.title}</h2>
      <p class="msg">伝えること: ${s.message}<br />長さ: ${s.length}</p>
      <div class="frames">${s.frames
        .map(
          (f) =>
            `<figure>${frameSvg(f)}<figcaption><b>${f.time}</b> ${f.note}</figcaption></figure>`,
        )
        .join('')}</div>
      <table>
        <tr><th>時刻（秒）</th><th>動き</th><th>音</th></tr>
        ${s.timeline.map(([t, a, snd]) => `<tr><td>${t}</td><td>${a}</td><td>${snd}</td></tr>`).join('\n        ')}
      </table>
    </section>`,
  ).join('\n');
  return `<!doctype html>
<!-- ストーリー演出の絵コンテ（apps/client/art/story/storyboard.ts で生成。手で編集しない） -->
<html lang="ja">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>ストーリー絵コンテ</title>
    <style>
      body { margin: 0; padding: 16px; background: #1a1c20; color: #eef0f3; font-family: system-ui, sans-serif; }
      h2 { color: #ffc107; font-size: 1.1rem; margin: 32px 0 4px; }
      .msg { color: #aab1bc; margin: 0 0 10px; }
      .frames { display: flex; flex-wrap: wrap; gap: 10px; }
      figure { margin: 0; width: 320px; }
      figure svg { display: block; border-radius: 6px; border: 1px solid #3a3f48; }
      figcaption { font-size: 0.8rem; color: #cfd3dc; margin-top: 4px; }
      table { border-collapse: collapse; margin-top: 10px; max-width: 1000px; }
      th, td { border: 1px solid #3a3f48; padding: 5px 8px; font-size: 0.85rem; text-align: left; vertical-align: top; }
      th { background: #262a31; }
      nav a { color: #4dd0e1; margin-right: 12px; }
    </style>
  </head>
  <body>
    <h1>ストーリー絵コンテ（セリフなし）</h1>
    <p class="msg">文字はタイトル・ロゴ・数字だけ。水色の点線の矢印は動きの向き（絵コンテの注記で、本番には出ない）。
    日ごとの幕間は「部品を受け取る → 取り付ける」の同じ型で、日ごとに出来事を変える（3日目は幕間を省いてエンディングへ）。</p>
    <nav>${SCENES.map((s) => `<a href="#${s.id}">${s.title.split('（')[0]}</a>`).join('')}</nav>
${scenes}
  </body>
</html>
`;
}

const here = dirname(fileURLToPath(import.meta.url));
const out = resolve(here, '../../../../docs/story');
mkdirSync(out, { recursive: true });
writeFileSync(resolve(out, 'storyboard.html'), html());
console.log(`wrote ${out}/storyboard.html`);
