/**
 * 共有カードを Canvas に描いて PNG にする（描画命令の組み立ては share/card.ts）
 *
 * ここは命令をそのまま描くだけの薄い層にする。画像は素材マニフェストから読み、回転させる素材だけ向きに合わせて回す。
 */
import { LOGO_ASSETS, MASCOT_ASSETS, PART_ASSETS } from '../assets/manifest';
import { BOARD_COLORS } from '../assets/palette';
import { FONT_STACK } from '../config/fonts';
import { SHARE_CONFIG, type ShareCardSize } from '../config/share';
import type { CardImage, DrawCommand } from './card';

function imageSource(image: CardImage): { src: string; rotates: boolean } {
  if (image === 'logo') return { src: LOGO_ASSETS.darkBackground, rotates: false };
  if (image === 'bolt') return { src: MASCOT_ASSETS.happy, rotates: false };
  const asset = PART_ASSETS[image.slice(5) as keyof typeof PART_ASSETS];
  return { src: asset.src, rotates: asset.rotates };
}

const cache = new Map<string, Promise<HTMLImageElement>>();
function loadImage(src: string): Promise<HTMLImageElement> {
  let loading = cache.get(src);
  if (!loading) {
    loading = new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });
    cache.set(src, loading);
  }
  return loading;
}

function hazard(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  band: number,
) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  ctx.fillStyle = BOARD_COLORS.hazardBlack;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = BOARD_COLORS.hazardYellow;
  // 斜め45°のしまを band の幅で交互に描く（帯の高さ・幅に関係なく同じ間隔）
  for (let i = -h; i < w + h; i += band * 2) {
    ctx.beginPath();
    ctx.moveTo(x + i, y + h);
    ctx.lineTo(x + i + h, y);
    ctx.lineTo(x + i + h + band, y);
    ctx.lineTo(x + i + band, y + h);
    ctx.fill();
  }
  ctx.restore();
}

/** 描画命令を Canvas に描き、PNG の Blob を返す */
export async function renderCard(commands: DrawCommand[], size: ShareCardSize): Promise<Blob> {
  const { width, height } = SHARE_CONFIG.sizes[size];
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas');
  await document.fonts?.ready;
  const images = new Map<CardImage, HTMLImageElement>();
  await Promise.all(
    commands.flatMap((c) =>
      c.kind === 'image'
        ? [loadImage(imageSource(c.image).src).then((img) => void images.set(c.image, img))]
        : [],
    ),
  );

  for (const c of commands) {
    switch (c.kind) {
      case 'rect':
        ctx.fillStyle = c.color;
        ctx.beginPath();
        ctx.roundRect(c.x, c.y, c.w, c.h, c.radius ?? 0);
        ctx.fill();
        break;
      case 'hazard':
        hazard(ctx, c.x, c.y, c.w, c.h, c.band);
        break;
      case 'text':
        ctx.fillStyle = c.color;
        ctx.font = `${c.weight} ${c.size}px ${FONT_STACK}`;
        ctx.textAlign = c.align;
        ctx.textBaseline = 'top';
        ctx.fillText(c.text, c.x, c.y);
        break;
      case 'image': {
        const img = images.get(c.image)!;
        const { rotates } = imageSource(c.image);
        ctx.save();
        ctx.translate(c.x + c.w / 2, c.y + c.h / 2);
        if (rotates && c.dir) ctx.rotate((c.dir * Math.PI) / 2);
        ctx.drawImage(img, -c.w / 2, -c.h / 2, c.w, c.h);
        ctx.restore();
        break;
      }
    }
  }
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('toBlob'))), 'image/png'),
  );
}
