/**
 * はじめの画面: 木版画の建物の中に静止3D肖像を並べる。
 * モデルの描画が失敗したときも従来のSVGの人物がその場に残る。
 */
import { ThreePortrait } from './ThreePortrait';
import { oyakataLook, rikishiLook } from './look';
import { PALETTE } from './palette';

const INK = PALETTE.sumi;

export function TitleArt({ title }: { title: string }) {
  const left = rikishiLook({
    id: 11,
    weight: 150,
    stableId: 3,
    careerBasho: 40,
    sekitori: true,
    yokozuna: false,
    injured: false,
    fatigue: 0,
  });
  const right = rikishiLook({
    id: 23,
    weight: 110,
    stableId: 3,
    careerBasho: 2,
    sekitori: false,
    yokozuna: false,
    injured: false,
    fatigue: 0,
  });
  const master = oyakataLook({ id: 5, age: 48, stableId: 1 });
  return (
    <div className="title-art title-art--scene" role="img" aria-label={title}>
      <svg viewBox="0 0 360 230" className="title-art__background" aria-hidden="true">
        {/* 木の板間、和紙の壁、藍の三つ割りのれん */}
        <rect width={360} height={230} fill={PALETTE.washi2} />
        <path d="M0 171 H360 V230 H0 Z" fill={PALETTE.odoLight} />
        {Array.from({ length: 9 }, (_, i) => (
          <line key={i} x1={i * 45} y1={171} x2={i * 45 - 20} y2={230} stroke={PALETTE.odo} strokeWidth={1.5} />
        ))}
        <path d="M35 13 H325" stroke={INK} strokeWidth={4} strokeLinecap="round" />
        {[0, 1, 2].map((i) => (
          <path key={i} d={`M${44 + i * 92} 15 H${132 + i * 92} V75 H${44 + i * 92} Z`} fill={PALETTE.ai} stroke={INK} strokeWidth={2} />
        ))}
        <circle cx={180} cy={45} r={21} fill="none" stroke={PALETTE.white} strokeWidth={3.5} />
        <path d="M166 45 H194" stroke={PALETTE.white} strokeWidth={5} />
        {/* 背景にも平たい墨線を残し、3D人物だけを際立たせる */}
        <line x1={0} y1={171} x2={360} y2={171} stroke={INK} strokeWidth={2} />
      </svg>
      <span className="title-art__figure title-art__figure--left"><ThreePortrait look={left} size="100%" variant="full" /></span>
      <span className="title-art__figure title-art__figure--master"><ThreePortrait look={master} size="100%" variant="full" /></span>
      <span className="title-art__figure title-art__figure--right"><ThreePortrait look={right} size="100%" variant="full" /></span>
    </div>
  );
}
