/**
 * ストア用の画像の確認ページ（docs/art-preview.html）
 *
 * - Steam で実際に表示される大きさ（capsules.json の previewWidth）で並べる
 * - 明るい背景・暗い背景、白黒＋ぼかし（シルエットで判別できるか）
 * - 他のゲームのカプセルが並ぶ一覧を想定した、混雑した帯（他社の画像は使わず、単純な図形のダミー）
 * - Library Hero には、重要な要素を収める中央の範囲（safeArea）を重ねて表示する
 */
import config from '../../build/store/capsules.json';

const SVG = '../apps/client/build/store/svg';

const img = (id: string, width: number, extra = '') =>
  `<img src="${SVG}/${id}.svg" width="${width}" alt="" ${extra}/>`;

/** ダミーのカプセル（単純な図形と色の帯。他のゲームの絵は使わない） */
function dummy(i: number, w: number, h: number): string {
  const colors = [
    '#3d5a80',
    '#98c1d9',
    '#ee6c4d',
    '#293241',
    '#6d597a',
    '#b56576',
    '#e5989b',
    '#355070',
  ];
  const c = colors[i % colors.length]!;
  const d = colors[(i + 3) % colors.length]!;
  return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><rect width="${w}" height="${h}" fill="${c}"/><circle cx="${w * 0.7}" cy="${h * 0.5}" r="${h * 0.35}" fill="${d}"/><rect x="${w * 0.08}" y="${h * 0.3}" width="${w * 0.4}" height="${h * 0.16}" fill="#fff" opacity="0.8"/></svg>`;
}

export function storePreviewHtml(): string {
  const header = config.capsules.find((c) => c.id === 'header')!;
  const small = config.capsules.find((c) => c.id === 'small')!;
  const hero = config.capsules.find((c) => c.id === 'hero')!;
  const [safeW = 0, safeH = 0] = hero.safeArea ?? [];
  const heroScale = hero.previewWidth / hero.width;
  const displayed = config.capsules
    .map(
      (c) =>
        `<figure>${img(c.id, c.previewWidth, c.transparent ? 'class="checker"' : '')}<figcaption>${c.label}（${c.width}×${c.height} → 表示 ${c.previewWidth}px 幅）</figcaption></figure>`,
    )
    .join('');
  const smalls = [120, 184, 231]
    .map((w) => `<figure>${img('small', w)}<figcaption>Small ${w}px</figcaption></figure>`)
    .join('');
  const sw = header.previewWidth;
  const sh = Math.round((sw * header.height) / header.width);
  const crowd = (light: boolean) =>
    Array.from({ length: 5 }, (_, i) =>
      i === 2
        ? img('header', 230)
        : dummy(i, 230, Math.round((230 * header.height) / header.width)),
    ).join('') + ` <span class="note">${light ? '明るい一覧' : '暗い一覧'}</span>`;
  const crowdSmall = Array.from({ length: 7 }, (_, i) =>
    i === 3 ? img('small', 120) : dummy(i + 2, 120, Math.round((120 * small.height) / small.width)),
  ).join('');
  return `<!doctype html>
<!-- ストア用の画像の確認ページ（apps/client/art/keyvisual/preview.ts で生成。手で編集しない） -->
<html lang="ja">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>ストア用の画像の確認</title>
    <style>
      body { margin: 0; padding: 16px; background: #1a1c20; color: #eef0f3; font-family: system-ui, sans-serif; }
      h2 { color: #ffc107; font-size: 1.05rem; margin: 28px 0 6px; }
      p { color: #aab1bc; margin: 0 0 8px; }
      .row { display: flex; flex-wrap: wrap; gap: 12px; align-items: flex-end; }
      figure { margin: 0; }
      figcaption { font-size: 0.8rem; color: #aab1bc; }
      .light { background: #f2f2f2; padding: 10px; border-radius: 6px; }
      .light figcaption, .light .note { color: #333; }
      .mono img { filter: grayscale(1) blur(1.5px); }
      .strip { display: flex; gap: 6px; align-items: center; padding: 8px; background: #1b2838; border-radius: 6px; overflow: hidden; }
      .strip.light { background: #f2f2f2; }
      .note { font-size: 0.8rem; color: #aab1bc; }
      .checker { background: repeating-conic-gradient(#999 0 25%, #bbb 0 50%) 0 0 / 16px 16px; }
      .hero { position: relative; display: inline-block; }
      .hero .safe { position: absolute; border: 2px dashed #69f0ae; box-sizing: border-box; }
    </style>
  </head>
  <body>
    <h1>ストア用の画像の確認</h1>
    <p>規定は apps/client/build/store/capsules.json（${config.checkedAt} 時点・要確認）。書き出し: <code>node apps/client/build/store/generate.mjs</code></p>

    <h2>Steam で表示される大きさ</h2>
    <div class="row">${displayed}</div>

    <h2>Small Capsule を小さく（120×45 まで）</h2>
    <div class="row">${smalls}</div>

    <h2>明るい背景</h2>
    <div class="row light">${img('header', sw)}${img('small', 231)}${img('vertical', 187)}${img('library', 150)}</div>

    <h2>白黒＋ぼかし（シルエットで判別できるか）</h2>
    <div class="row mono">${img('header', sw)}${img('small', 231)}${img('main', 308)}${img('vertical', 187)}</div>

    <h2>混雑した一覧での目立ち方（周りはダミーの図形）</h2>
    <div class="strip">${crowd(false)}</div>
    <div class="strip light" style="margin-top:8px">${crowd(true)}</div>
    <div class="strip" style="margin-top:8px">${crowdSmall} <span class="note">Small 120px の一覧</span></div>

    <h2>Library Hero と重要な要素の範囲（中央 ${safeW}×${safeH}、緑の点線）</h2>
    <div class="hero">${img('hero', hero.previewWidth)}<span class="safe" style="left:${((hero.width - safeW) / 2) * heroScale}px;top:${((hero.height - safeH) / 2) * heroScale}px;width:${safeW * heroScale}px;height:${safeH * heroScale}px"></span></div>
    <p>表示 ${sw}×${sh}（Header の目安）</p>
  </body>
</html>
`;
}
