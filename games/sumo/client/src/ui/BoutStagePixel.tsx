import { useEffect, useRef, useState } from 'react';
import type { Look } from '../art/look';
import { PALETTE } from '../art/palette';
import { sprite } from '../art/sprites';
import { FOOT, personPixels, type PersonLook } from '../art/hakoniwa/people';
import type { Pose as ScriptPose, Side } from '../playback/boutScript';
import { BOUT_STAGE, boutSprites, stageShake } from '../playback/boutStage';

/** 見た目（顔の絵と共通）→ 土俵の上の小さな絵の見た目 */
export function stageLook(look: Look): Omit<PersonLook, 'pose' | 'frame' | 'flip'> {
  const skin = Math.max(0, (PALETTE.skin as readonly string[]).indexOf(look.skin)) as 0 | 1 | 2;
  return {
    skin,
    mawashi: 'black',
    cloth: look.sagari ? look.cloth : undefined,
    hair: look.hair === 'zanbara' ? 'zanbara' : 'mage',
    build: look.width < 31 ? 0 : look.width < 39 ? 1 : 2,
  };
}

const people = new Map<string, HTMLCanvasElement>();
function personCanvas(look: PersonLook): HTMLCanvasElement {
  const key = JSON.stringify(look);
  const hit = people.get(key);
  if (hit) return hit;
  const px = personPixels(look);
  const c = document.createElement('canvas');
  c.width = px.width;
  c.height = px.height;
  const img = new ImageData(px.width, px.height);
  img.data.set(px.data);
  c.getContext('2d')?.putImageData(img, 0, 0);
  people.set(key, c);
  return c;
}

function loadImage(name: string): Promise<HTMLImageElement | null> {
  const s = sprite(name);
  if (!s) return Promise.resolve(null);
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = s.url;
  });
}

/** 決まったばらつき（0〜1。乱数を使わない） */
function hash(a: number, b: number): number {
  return ((Math.imul(a + 3, 2654435761) ^ Math.imul(b + 11, 40503)) >>> 0) / 4294967296;
}

/** 客席: 暗い館内に、ます席の客の頭と着物が並ぶ */
function drawHall(ctx: CanvasRenderingContext2D): void {
  const { width: W, height: H } = BOUT_STAGE;
  ctx.fillStyle = PALETTE.sumi;
  ctx.fillRect(0, 0, W, H);
  const cloths = [PALETTE.ai, PALETTE.murasaki, PALETTE.kincha, PALETTE.wakatake, PALETTE.beni];
  for (let row = 0; row * 7 < H; row++) {
    const y = 4 + row * 7;
    // 段ごとの手すり
    if (row % 4 === 3) {
      ctx.globalAlpha = 0.5;
      ctx.fillStyle = PALETTE.sumi2;
      ctx.fillRect(0, y + 5, W, 1);
    }
    for (let i = -1; i * 8 < W; i++) {
      const k = hash(row, i);
      // ところどころ空いた席。少し左右にずれて座る
      if (k < 0.22) continue;
      const x = i * 8 + (row % 2) * 4 + Math.round(hash(i, row + 40) * 2 - 1);
      // 奥（上）の席ほど暗い
      ctx.globalAlpha = 0.1 + (y / H) * 0.14 + hash(i, row) * 0.08;
      ctx.fillStyle = cloths[Math.floor(k * 97) % cloths.length]!;
      ctx.fillRect(x, y + 3, 5, 3);
      ctx.fillStyle = PALETTE.skin[Math.floor(k * 31) % 3]!;
      ctx.fillRect(x + 1, y, 3, 3);
    }
  }
  ctx.globalAlpha = 1;
}

/**
 * 取組の舞台（ドット絵）: 客席・土俵・吊り屋根と、台本の姿勢どおりに動く2人の力士と行司。
 * 箱庭と同じく、1枚のキャンバスに描いてから拡大する
 */
export function BoutStagePixel({
  east,
  west,
  pose,
  time,
  clash,
  finishAt,
  winner,
  title,
  still = false,
  onReady,
}: {
  east: Look;
  west: Look;
  pose: { east: ScriptPose; west: ScriptPose; contact: boolean };
  time: number;
  clash: number;
  finishAt: number;
  winner: Side | null;
  title: string;
  /** 動きを減らす: 揺れと光を出さない */
  still?: boolean;
  onReady?: () => void;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [art, setArt] = useState<{
    hall: HTMLCanvasElement;
    dohyo: HTMLImageElement | null;
    roof: HTMLImageElement | null;
  } | null>(null);
  useEffect(() => {
    let live = true;
    Promise.all([loadImage('dohyo'), loadImage('tsuriyane')]).then(([dohyo, roof]) => {
      if (!live) return;
      const hall = document.createElement('canvas');
      hall.width = BOUT_STAGE.width;
      hall.height = BOUT_STAGE.height;
      const h = hall.getContext('2d');
      if (h) drawHall(h);
      setArt({ hall, dohyo, roof });
      onReady?.();
    });
    return () => {
      live = false;
    };
  }, [onReady]);

  useEffect(() => {
    const c = canvas.current;
    const ctx = c?.getContext('2d');
    if (!c || !ctx || !art) return;
    const { width: W, height: H, dohyo, roof, ring } = BOUT_STAGE;
    ctx.imageSmoothingEnabled = false;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(art.hall, 0, 0);
    ctx.translate(still ? 0 : stageShake(time, clash, finishAt), 0);
    if (art.dohyo) ctx.drawImage(art.dohyo, dohyo.x, dohyo.y);
    const looks = { E: stageLook(east), W: stageLook(west) };
    for (const s of boutSprites({ pose, time, clash, winner })) {
      const look: PersonLook =
        s.who === 'gyoji'
          ? {
              pose: 'gyoji',
              frame: s.frame,
              skin: 1,
              mawashi: 'black',
              hair: 'zanbara',
              build: 0,
              flip: s.flip,
            }
          : { ...looks[s.who], pose: s.pose, frame: s.frame, flip: s.flip };
      // 足元の影
      ctx.globalAlpha = 0.25;
      ctx.fillStyle = PALETTE.sumi;
      ctx.fillRect(s.x - 8, s.y - 1, 17, 3);
      ctx.fillRect(s.x - 6, s.y - 2, 13, 5);
      ctx.globalAlpha = 1;
      ctx.save();
      ctx.translate(s.x, s.y);
      if (s.rot !== 0) ctx.rotate((s.rot * Math.PI) / 180);
      ctx.drawImage(personCanvas(look), -FOOT.x, -FOOT.y);
      ctx.restore();
    }
    // 当たった瞬間の光（十字の火花）
    const d = time - clash;
    if (!still && d >= 0 && d < 0.2) {
      const x = Math.round(ring.cx + ((pose.east.x + pose.west.x) / 2) * ring.rx);
      const y = ring.cy - 18;
      const r = 3 + Math.floor(d / 0.05) * 2;
      ctx.fillStyle = PALETTE.white;
      ctx.fillRect(x - r, y, r * 2 + 1, 1);
      ctx.fillRect(x, y - r, 1, r * 2 + 1);
      ctx.fillRect(x - 1, y - 1, 3, 3);
    }
    // 倒れた・出た瞬間の土けむり
    const f = time - finishAt;
    if (!still && winner && f >= 0 && f < 0.5) {
      const loser = winner === 'E' ? pose.west : pose.east;
      const x = Math.round(ring.cx + loser.x * ring.rx);
      const y = Math.round(ring.cy + loser.y * 28);
      ctx.fillStyle = PALETTE.odoLight;
      ctx.globalAlpha = 0.9 * (1 - f / 0.5);
      for (let i = 0; i < 7; i++) {
        const a = hash(i, 5) * Math.PI;
        const dist = 4 + f * 26 * (0.5 + hash(i, 9));
        ctx.fillRect(
          Math.round(x + Math.cos(a) * dist),
          Math.round(y - Math.sin(a) * dist * 0.5),
          2,
          2,
        );
      }
      ctx.globalAlpha = 1;
    }
    if (art.roof) ctx.drawImage(art.roof, roof.x, roof.y);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    // 揺れで空いた端を塗る
    ctx.fillStyle = PALETTE.sumi;
    ctx.fillRect(0, 0, 2, H);
    ctx.fillRect(W - 2, 0, 2, H);
  }, [art, east, west, pose, time, clash, finishAt, winner, still]);

  return (
    <div className="bout-stage" role="img" aria-label={title}>
      <canvas ref={canvas} width={BOUT_STAGE.width} height={BOUT_STAGE.height} />
    </div>
  );
}
