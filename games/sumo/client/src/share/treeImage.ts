/**
 * 系譜図の画像（SVG の文字列 → PNG）。共有用。絵はなく、家系図のような札と線で描く
 */
import type { FamilyNode, GameState } from '@ichimon/sim';
import { PALETTE } from '../art/palette';
import type { TranslateFn } from '../i18n';
import { bashoName, rankLabel } from '../format';
import { layoutTree } from './treeLayout';

const CARD_W = 220;
const CARD_H = 64;
const GAP_X = 50;
const GAP_Y = 14;
const PAD = 32;
const HEAD = 88;
const MIN_W = 720;

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export function treeSvg(
  game: GameState,
  t: TranslateFn,
): { svg: string; width: number; height: number } {
  const nodes = game.player.family;
  const { placed, rows, depth } = layoutTree(nodes);
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const pos = new Map(placed.map((p) => [p.id, p]));
  // 副題が収まる幅は確保する
  const width = Math.max(MIN_W, PAD * 2 + (depth + 1) * CARD_W + depth * GAP_X);
  const height = HEAD + PAD + Math.max(1, rows) * (CARD_H + GAP_Y);
  const xy = (id: number) => {
    const p = pos.get(id)!;
    return { x: PAD + p.depth * (CARD_W + GAP_X), y: HEAD + p.row * (CARD_H + GAP_Y) };
  };
  const stableName = game.stables.find((s) => s.id === game.player.stableId)?.name ?? '';
  const total = game.player.lineage.reduce(
    (n, l) => ({
      sekitori: n.sekitori + l.sekitori,
      yokozuna: n.yokozuna + l.yokozuna,
      yusho: n.yusho + l.makuuchiYusho,
    }),
    { sekitori: 0, yokozuna: 0, yusho: 0 },
  );
  const lines: string[] = [];
  const cards: string[] = [];
  for (const n of nodes) {
    const { x, y } = xy(n.id);
    if (n.parentId !== null && byId.has(n.parentId)) {
      const p = xy(n.parentId);
      const midX = p.x + CARD_W + GAP_X / 2;
      lines.push(
        `<path d="M${p.x + CARD_W} ${p.y + CARD_H / 2} H${midX} V${y + CARD_H / 2} H${x}" fill="none" stroke="${PALETTE.sumi}" stroke-width="2.5"/>`,
      );
    }
    cards.push(card(n, x, y, t));
  }
  const title = t('share.treeTitle', { stable: stableName });
  const sub = t('share.treeSub', {
    generations: game.player.generation,
    sekitori: total.sekitori,
    yokozuna: total.yokozuna,
    yusho: total.yusho,
    basho: bashoName(t, game.bashoIndex),
  });
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" font-family="'Hiragino Mincho ProN','Yu Mincho','Noto Serif JP',serif">
<rect width="100%" height="100%" fill="${PALETTE.washi}"/>
<rect x="8" y="8" width="${width - 16}" height="${height - 16}" fill="none" stroke="${PALETTE.sumi}" stroke-width="3"/>
<text x="${PAD}" y="${PAD + 18}" font-size="26" font-weight="bold" fill="${PALETTE.sumi}">${esc(title)}</text>
<text x="${PAD}" y="${PAD + 44}" font-size="14" fill="${PALETTE.sumi2}">${esc(sub)}</text>
${lines.join('\n')}
${cards.join('\n')}
</svg>`;
  return { svg, width, height };

  function card(n: FamilyNode, x: number, y: number, tr: TranslateFn): string {
    const color =
      n.kind === 'master'
        ? PALETTE.beni
        : n.kind === 'branch'
          ? PALETTE.ai
          : n.kind === 'gone'
            ? PALETTE.muted
            : PALETTE.sumi2;
    const name =
      n.kind === 'waiting'
        ? tr('lineage.waitingName', { shikona: n.shikona })
        : tr('lineage.oyakata', { name: n.name, shikona: n.shikona });
    const kind = tr(`family.kind.${n.kind}`);
    const stats =
      n.sekitori + n.sanyaku + n.yokozuna + n.makuuchiYusho > 0
        ? tr('share.cardStats', {
            sekitori: n.sekitori,
            yokozuna: n.yokozuna,
            yusho: n.makuuchiYusho,
          })
        : n.highestRank
          ? tr('family.highest', { rank: rankLabel(tr, n.highestRank) })
          : '';
    return `<g>
<rect x="${x}" y="${y}" width="${CARD_W}" height="${CARD_H}" rx="6" fill="${n.kind === 'gone' ? PALETTE.washi2 : PALETTE.card}" stroke="${color}" stroke-width="${n.kind === 'master' ? 3 : 2}"${n.kind === 'branch' ? ' stroke-dasharray="6 4"' : ''}/>
<rect x="${x}" y="${y}" width="8" height="${CARD_H}" fill="${color}"/>
<text x="${x + 16}" y="${y + 22}" font-size="14" font-weight="bold" fill="${PALETTE.sumi}">${esc(name)}</text>
<text x="${x + 16}" y="${y + 40}" font-size="11" fill="${PALETTE.sumi2}">${esc(kind)}</text>
<text x="${x + 16}" y="${y + 56}" font-size="11" fill="${PALETTE.sumi2}">${esc(stats)}</text>
</g>`;
  }
}

/** SVG を PNG に描き直す（ブラウザだけ） */
export async function svgToPng(
  svg: string,
  width: number,
  height: number,
  scale = 2,
): Promise<Blob> {
  const img = new Image();
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  try {
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('svg load failed'));
      img.src = url;
    });
    const canvas = document.createElement('canvas');
    canvas.width = width * scale;
    canvas.height = height * scale;
    const ctx = canvas.getContext('2d')!;
    ctx.scale(scale, scale);
    ctx.drawImage(img, 0, 0);
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('png failed'))), 'image/png'),
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}
