import { useState } from 'react';
import type { GameState } from '@ichimon/sim';
import { useI18n } from '../i18n';
import { sprite } from '../art/sprites';
import {
  EXTERIOR_STAGE,
  KEIKOBA_STAGE,
  exteriorLayout,
  keikobaLayout,
  type Placed,
  type Stage,
} from '../art/sprites/keikoba';

/** 絵の最大の幅（px）。稽古場はちょうど2倍、外観は少し小さめに縮める */
const SCENE_MAX_WIDTH = 640;

/** ドット絵を舞台に並べる。先頭の絵（床・建物）がまだ取り込まれていなければ null */
function SpriteStage({ stage, items, label }: { stage: Stage; items: Placed[]; label: string }) {
  const placed = items.map((p) => ({ p, s: sprite(p.sprite) })).filter((x) => x.s !== null);
  if (placed[0]?.p !== items[0]) return null;
  return (
    <div
      className="scene"
      role="img"
      aria-label={label}
      style={{ aspectRatio: `${stage.width} / ${stage.height}`, maxWidth: SCENE_MAX_WIDTH }}
    >
      {placed.map(({ p, s }) => (
        <img
          key={p.sprite}
          className="scene__sprite"
          src={s!.url}
          alt=""
          draggable={false}
          style={{
            left: `${((p.x - s!.anchor[0]) / stage.width) * 100}%`,
            top: `${((p.y - s!.anchor[1]) / stage.height) * 100}%`,
            width: `${(s!.size[0] / stage.width) * 100}%`,
          }}
        />
      ))}
    </div>
  );
}

type View = 'keikoba' | 'exterior';

/** 部屋の絵: 稽古場と外観を切り替える。絵がまだなければ出さない */
export function KeikobaScene({ game }: { game: GameState }) {
  const { t } = useI18n();
  const [view, setView] = useState<View>('keikoba');
  const views: { id: View; stage: Stage; items: Placed[] }[] = [
    { id: 'keikoba', stage: KEIKOBA_STAGE, items: keikobaLayout(game) },
    { id: 'exterior', stage: EXTERIOR_STAGE, items: exteriorLayout(game) },
  ];
  const ready = views.filter((v) => sprite(v.items[0]!.sprite) !== null);
  if (ready.length === 0) return null;
  const current = ready.find((v) => v.id === view) ?? ready[0]!;
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
      <SpriteStage stage={current.stage} items={current.items} label={t(`scene.${current.id}`)} />
    </div>
  );
}
