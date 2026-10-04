/**
 * キャラクターの設定画の一覧（docs/characters/preview.html）
 *
 * 書き出した素材（src/assets/characters/）をそのまま並べる。大きさ（64・128・512px）とシルエット（黒塗り）も確かめる。
 * 体型の3案の比較は docs/characters/roughs.html（段階1）
 */
import type { VIEWS } from './bolt';
import { EXPRESSIONS, POSES } from './bolt';
import { CHIEF_MOODS, CHIEF_POSES } from './chief';

const ASSETS = '../../apps/client/src/assets/characters';
const ROCKET = '../../apps/client/src/assets/rocket';

const CHIEF_MOOD_LABELS: Record<(typeof CHIEF_MOODS)[number], string> = {
  stern: '気難しい（普段）',
  soft: '和らぐ（エンディング）',
  surprised: '驚く',
};

const VIEW_LABELS: Record<keyof typeof VIEWS, string> = {
  front: '正面',
  quarter: '斜め（3/4）',
  side: '横',
  back: '背面',
};

const EXPRESSION_LABELS: Record<(typeof EXPRESSIONS)[number], string> = {
  idle: '待機',
  happy: '喜び',
  surprised: '驚き',
  fail: '失敗',
  sad: 'しょんぼり',
  determined: '決意',
  tired: '疲れた笑顔',
  sparkle: '目を輝かせる',
  sleepy: '眠い',
  lookUp: '見上げる',
};

const figure = (src: string, label: string, cls = '') =>
  `<figure class="${cls}"><img src="${src}" alt="" /><figcaption>${label}</figcaption></figure>`;

/** 追加の節（工場長・ロケットなど。後の段階で足す） */
export interface PreviewSection {
  title: string;
  note?: string;
  html: string;
}

export function characterPreviewHtml(extra: PreviewSection[] = []): string {
  const bolt = `${ASSETS}/bolt`;
  const views = Object.entries(VIEW_LABELS)
    .map(([k, label]) => figure(`${bolt}/views/${k}.svg`, label))
    .join('');
  const expressions = EXPRESSIONS.map((e) =>
    figure(`${bolt}/expressions/${e}.svg`, EXPRESSION_LABELS[e], 'small'),
  ).join('');
  const poses = Object.entries(POSES)
    .map(([k, { label }]) => figure(`${bolt}/poses/${k}.svg`, label))
    .join('');
  const silhouettes = Object.entries(POSES)
    .map(([k, { label }]) => figure(`${bolt}/poses/${k}.svg`, label, 'silhouette'))
    .join('');
  const sizes = [64, 128, 512]
    .map((s) => `<img src="${bolt}/views/front.svg" alt="" style="height:${s}px" />`)
    .join('');
  const sections = [
    {
      title: 'ボルト: 三面図',
      note: '約 2.3 頭身（頭 55・胴 34・脚 28）。顔は既存のアイコンのまま。部品の回転・位置・差し替えだけで組んでいます',
      html: `<div class="row">${views}</div>`,
    },
    { title: 'ボルト: 大きさ（64・128・512px）', html: `<div class="row sizes">${sizes}</div>` },
    { title: 'ボルト: 表情集', html: `<div class="row">${expressions}</div>` },
    { title: 'ボルト: ポーズ集（身振り）', html: `<div class="row">${poses}</div>` },
    {
      title: 'ボルト: シルエット（黒塗りで身振りが読めるか）',
      html: `<div class="row">${silhouettes}</div>`,
    },
    {
      title: '工場長（天井クレーン）: 表情',
      note: '運転席が頭。窓の帯のランプが目で、鉄板のまぶたで機嫌を表す（気難しい・和らぐ・驚く）',
      html: `<div class="row">${CHIEF_MOODS.map((m) =>
        figure(`${ASSETS}/chief/expressions/${m}.svg`, CHIEF_MOOD_LABELS[m], 'small'),
      ).join('')}</div>`,
    },
    {
      title: '工場長: ポーズ集',
      note: 'フックは重さで常に真下へ下がる。腕組みの代わりにジブを体の前に畳む。帽子（ヘルメット）を上げるのはエンディングだけ',
      html: `<div class="row">${Object.entries(CHIEF_POSES)
        .map(([k, { label }]) => figure(`${ASSETS}/chief/poses/${k}.svg`, label, 'wide'))
        .join('')}</div>`,
    },
    {
      title: '工場長: シルエット',
      html: `<div class="row">${Object.entries(CHIEF_POSES)
        .map(([k, { label }]) => figure(`${ASSETS}/chief/poses/${k}.svg`, label, 'silhouette'))
        .join('')}</div>`,
    },
    {
      title: 'ロケット: 完成までの9段階（1日3部品）',
      note: '赤白のロケットに、ガラクタの部品（じょうごのノズル・ドラム缶・洗濯機の扉の窓・バケツの先端・テープの継ぎはぎ）を混ぜる。上部の背景と日ごとの幕間で同じ絵を使う',
      html: `<div class="row">${Array.from({ length: 10 }, (_, i) =>
        figure(`${ROCKET}/rocket-${i}.svg`, `${i}/9`, 'rocket'),
      ).join('')}</div>`,
    },
    {
      title: 'ロケット: 打ち上げの部品（炎・煙）',
      html: `<div class="row">${figure(`${ROCKET}/flame.svg`, '炎', 'small')}${figure(`${ROCKET}/smoke.svg`, '煙', 'small')}</div>`,
    },
    ...extra,
  ];
  return `<!doctype html>
<!-- キャラクターの設定画の一覧（apps/client/art/characters/preview.ts で生成。手で編集しない） -->
<html lang="ja">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>キャラクター設定画</title>
    <style>
      body { margin: 0; padding: 16px; background: #1a1c20; color: #eef0f3; font-family: system-ui, sans-serif; }
      h1 { margin: 0 0 4px; }
      h2 { color: #ffc107; font-size: 1.05rem; margin: 28px 0 4px; }
      p { color: #aab1bc; margin: 0 0 8px; }
      .row { display: flex; flex-wrap: wrap; gap: 8px; align-items: flex-end; }
      figure { margin: 0; background: #262a31; border-radius: 8px; padding: 8px; text-align: center; }
      figure img { width: 180px; height: auto; display: block; }
      figure.small img { width: 110px; }
      figure.wide img { width: 230px; }
      figure.rocket img { width: 80px; }
      figcaption { font-size: 0.85rem; margin-top: 4px; }
      .silhouette { background: #eef0f3; color: #1a1c20; }
      .silhouette img { width: 110px; filter: brightness(0); }
      .sizes { background: #262a31; border-radius: 8px; padding: 8px; }
    </style>
  </head>
  <body>
    <h1>キャラクター設定画</h1>
    <p>体型の3案の比較は <a href="roughs.html" style="color:#4dd0e1">roughs.html</a>（段階1・A を採用）</p>
${sections
  .map(
    (s) => `    <h2>${s.title}</h2>${s.note ? `\n    <p>${s.note}</p>` : ''}
    ${s.html}`,
  )
  .join('\n')}
  </body>
</html>
`;
}
