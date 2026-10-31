import { useCallback, useState } from 'react';
import type { GameState } from '@ichimon/sim';
import { useI18n } from '../i18n';
import { sprite } from '../art/sprites';
import { KEIKOBA_STAGE, keikobaLayout, type Placed } from '../art/sprites/keikoba';
import { depthOrder, frontCorner, toScreen, type SceneAction } from '../art/hakoniwa/grid';
import { compoundPieces, PLOT, seasonOf, STREET } from '../art/hakoniwa/compound';
import { drawGround } from '../art/hakoniwa/ground';
import { Hakoniwa, type Drawn } from './Hakoniwa';

/** 枠の下の中央で置く絵（稽古場・巡業）を、箱庭の描く物にする */
export function boxDrawn(items: Placed[]): Drawn[] {
  return items.map((p) => ({ ...p, anchor: 'box' as const }));
}

/** 外観の見える範囲: 左は左奥の塀の手前まで、右は右手前の縁石まで、下は道まで */
const EXTERIOR_VIEW = {
  x0: toScreen(0, PLOT.d - 1).x - 12,
  x1: toScreen(PLOT.w, 1).x + 12,
  y1: toScreen(PLOT.w - 2, PLOT.d + STREET).y,
};

type View = 'exterior' | 'keikoba';

/** 部屋の絵: 外観（敷地の箱庭）と稽古場を切り替える。押した建物・物の画面へ行ける */
export function KeikobaScene({
  game,
  onAction,
}: {
  game: GameState;
  onAction?: (a: SceneAction) => void;
}) {
  const { t } = useI18n();
  const [view, setView] = useState<View>('exterior');
  const season = seasonOf(game.bashoIndex);
  const drawBase = useCallback(
    (ctx: CanvasRenderingContext2D) => drawGround(ctx, season),
    [season],
  );
  const keikoba = keikobaLayout(game);
  const views: View[] = (['exterior', 'keikoba'] as const).filter((v) =>
    sprite(v === 'exterior' ? 'omoya' : keikoba[0]!.sprite),
  );
  if (views.length === 0) return null;
  const current = views.includes(view) ? view : views[0]!;
  const exterior: Drawn[] = depthOrder(compoundPieces(game)).map((p) => ({
    sprite: p.sprite,
    ...frontCorner(p),
    anchor: 'tip',
    action: p.action,
    label: p.label,
  }));
  const nobori = exterior.flatMap((d) => (d.label ? [d.label] : []));
  return (
    <section className="scene-box" aria-label={t('scene.view')}>
      {views.length > 1 && (
        <div className="segmented scene-box__tabs" role="group" aria-label={t('scene.view')}>
          {views.map((v) => (
            <button
              key={v}
              className={`segmented__btn ${current === v ? 'is-active' : ''}`}
              aria-pressed={current === v}
              onClick={() => setView(v)}
            >
              {t(`scene.tab.${v}`)}
            </button>
          ))}
        </div>
      )}
      {current === 'exterior' ? (
        <Hakoniwa
          items={exterior}
          base="omoya"
          drawBase={drawBase}
          view={EXTERIOR_VIEW}
          label={
            t('scene.exterior') +
            (nobori.length > 0 ? t('scene.nobori', { names: nobori.join('・') }) : '')
          }
          onAction={onAction}
        />
      ) : (
        <Hakoniwa
          items={boxDrawn(keikoba)}
          base={keikoba[0]!.sprite}
          view={{ x0: 0, y0: 0, x1: KEIKOBA_STAGE.width, y1: KEIKOBA_STAGE.height }}
          label={t('scene.keikoba')}
          onAction={onAction}
          maxWidth={KEIKOBA_STAGE.width * 2}
        />
      )}
    </section>
  );
}
