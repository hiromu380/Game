import { Fragment, useState, type CSSProperties } from 'react';
import type { GameState } from '@ichimon/sim';
import { useI18n } from '../i18n';
import { sprite } from '../art/sprites';
import { PALETTE } from '../art/palette';
import {
  EXTERIOR_BASE,
  EXTERIOR_STAGE,
  KEIKOBA_STAGE,
  NOBORI_TAG,
  exteriorLayout,
  keikobaLayout,
  type Placed,
  type Stage,
} from '../art/sprites/keikoba';

/** 絵の最大の幅（px）。稽古場はちょうど2倍、外観は少し小さめに縮める */
const SCENE_MAX_WIDTH = 640;

/** ドット絵を舞台に並べる。土台の絵（床・母屋）がまだ取り込まれていなければ null。取り込んでいない絵は飛ばす */
export function SpriteStage({
  stage,
  items,
  base,
  label,
  maxWidth = SCENE_MAX_WIDTH,
}: {
  stage: Stage;
  items: Placed[];
  base: string;
  label: string;
  maxWidth?: number;
}) {
  if (!sprite(base)) return null;
  const placed = items.map((p) => ({ p, s: sprite(p.sprite) })).filter((x) => x.s !== null);
  return (
    <div
      className="scene"
      role="img"
      aria-label={label}
      style={{ aspectRatio: `${stage.width} / ${stage.height}`, maxWidth }}
    >
      {placed.map(({ p, s }, i) => {
        const box = {
          left: `${((p.x - s!.anchor[0]) / stage.width) * 100}%`,
          top: `${((p.y - s!.anchor[1]) / stage.height) * 100}%`,
          width: `${(s!.size[0] / stage.width) * 100}%`,
        };
        return (
          <Fragment key={`${p.sprite}-${i}`}>
            <img className="scene__sprite" src={s!.url} alt="" draggable={false} style={box} />
            {p.label && <NoboriTag label={p.label} size={s!.size} style={box} />}
          </Fragment>
        );
      })}
    </div>
  );
}

/** 幟に重ねる名前の札（四股名の縦書き）。絵と同じ大きさの SVG で、絵と一緒に伸び縮みする */
function NoboriTag({
  label,
  size,
  style,
}: {
  label: string;
  size: [number, number];
  style: CSSProperties;
}) {
  const t = NOBORI_TAG;
  const chars = [...label];
  const font = Math.min(t.width - 1, (t.height - 2) / chars.length);
  return (
    <svg
      className="scene__sprite"
      style={style}
      viewBox={`0 0 ${size[0]} ${size[1]}`}
      aria-hidden="true"
    >
      <rect
        x={t.x}
        y={t.y}
        width={t.width}
        height={t.height}
        fill={PALETTE.washi}
        stroke={PALETTE.sumi}
        strokeWidth={0.6}
      />
      {chars.map((c, i) => (
        <text
          key={i}
          x={t.x + t.width / 2}
          y={t.y + 1 + font * (i + 0.88)}
          fontSize={font}
          textAnchor="middle"
          fill={PALETTE.sumi}
          className="scene__nobori"
        >
          {c}
        </text>
      ))}
    </svg>
  );
}

type View = 'keikoba' | 'exterior';

/** 部屋の絵: 稽古場と外観を切り替える。絵がまだなければ出さない */
export function KeikobaScene({ game }: { game: GameState }) {
  const { t } = useI18n();
  const [view, setView] = useState<View>('keikoba');
  const keikoba = keikobaLayout(game);
  const views: { id: View; stage: Stage; items: Placed[]; base: string }[] = [
    { id: 'keikoba', stage: KEIKOBA_STAGE, items: keikoba, base: keikoba[0]!.sprite },
    { id: 'exterior', stage: EXTERIOR_STAGE, items: exteriorLayout(game), base: EXTERIOR_BASE },
  ];
  const ready = views.filter((v) => sprite(v.base) !== null);
  if (ready.length === 0) return null;
  const current = ready.find((v) => v.id === view) ?? ready[0]!;
  const nobori = current.items.flatMap((p) => (p.label ? [p.label] : []));
  return (
    <div className="scene-box">
      {ready.length > 1 && (
        <div className="segmented scene-box__tabs" role="group" aria-label={t('scene.view')}>
          {ready.map((v) => (
            <button
              key={v.id}
              className={`segmented__btn ${current.id === v.id ? 'is-active' : ''}`}
              aria-pressed={current.id === v.id}
              onClick={() => setView(v.id)}
            >
              {t(`scene.tab.${v.id}`)}
            </button>
          ))}
        </div>
      )}
      <SpriteStage
        stage={current.stage}
        items={current.items}
        base={current.base}
        label={
          t(`scene.${current.id}`) +
          (nobori.length > 0 ? t('scene.nobori', { names: nobori.join('・') }) : '')
        }
      />
    </div>
  );
}
