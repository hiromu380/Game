import { useCallback, useMemo, useState } from 'react';
import type { GameState, Rank } from '@ichimon/sim';
import { useI18n } from '../i18n';
import { sprite } from '../art/sprites';
import { KEIKOBA_STAGE, keikobaLayout, type Placed } from '../art/sprites/keikoba';
import { depthOrder, frontCorner, toScreen, type SceneAction } from '../art/hakoniwa/grid';
import { compoundPieces, PLOT, seasonOf, STREET } from '../art/hakoniwa/compound';
import { drawGround } from '../art/hakoniwa/ground';
import { amongPieces, compoundCast, keikobaCast, type Actor } from '../art/hakoniwa/actors';
import { Hakoniwa, type Drawn, type Pop, type SceneActor } from './Hakoniwa';
import { signedPoints } from '../points';
import { RikishiTalk } from './RikishiTalk';

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

/** ちゃんこ場の湯気が上がる所（屋根の上） */
const CHANKO_SMOKE = (() => {
  const p = toScreen(20, 13);
  return { x: p.x, y: p.y - 46 };
})();

/** スマホでも人が見分けられる幅（はみ出る分は横に動かして見る） */
const EXTERIOR_MIN_WIDTH = 640;

type View = 'exterior' | 'keikoba';

/** 部屋の絵: 外観（敷地の箱庭）と稽古場を切り替える。押した建物・物の画面へ行ける */
export function KeikobaScene({
  game,
  ranks,
  setGame,
  onAction,
  onDetail,
}: {
  game: GameState;
  ranks?: ReadonlyMap<number, Rank>;
  /** 渡すと、弟子を押して話しかけ、稽古を決められる */
  setGame?: (g: GameState) => void;
  onAction?: (a: SceneAction) => void;
  onDetail?: (id: number) => void;
}) {
  const { t } = useI18n();
  const [view, setView] = useState<View>('exterior');
  const [picked, setPicked] = useState<number | null>(null);
  const names = useMemo(() => new Map(game.rikishi.map((r) => [r.id, r.name])), [game.rikishi]);
  const titled = (cast: Actor[]): SceneActor[] =>
    cast.map((a) => ({
      ...a,
      title: a.rikishiId === null ? t('scene.oyakata') : (names.get(a.rikishiId) ?? ''),
    }));
  // 今週の行動で動いた量を、その弟子の頭の上に浮かべる
  const week = game.prep.log[game.prep.log.length - 1];
  const popKey = week ? `${game.bashoIndex}:${week.week}` : '';
  const pops: Pop[] = week
    ? [
        ...week.gains.flatMap((g): Pop[] => {
          const best = (['oshi', 'yotsu', 'waza'] as const)
            .filter((k) => g[k] > 0)
            .sort((a, b) => g[b] - g[a])[0];
          return best
            ? [
                {
                  rikishiId: g.id,
                  text: `${t(`style.${best}`)}${signedPoints(g[best])}`,
                  tone: 'up',
                },
              ]
            : [];
        }),
        ...week.injured.map((id): Pop => ({ rikishiId: id, text: t('prep.hurt'), tone: 'hurt' })),
      ]
    : [];
  const talkTo = game.rikishi.find((r) => r.id === picked && r.stableId === game.player.stableId);
  const onPick = setGame ? (id: number) => setPicked((now) => (now === id ? null : id)) : undefined;
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
  const ordered = depthOrder(compoundPieces(game));
  const exterior: Drawn[] = ordered.map((p) => ({
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
          actors={titled(amongPieces(compoundCast(game), ordered))}
          onPick={onPick}
          selected={talkTo?.id ?? null}
          season={season}
          smoke={CHANKO_SMOKE}
          minWidth={EXTERIOR_MIN_WIDTH}
          focus={0.42}
          pops={pops}
          popKey={popKey}
        />
      ) : (
        <Hakoniwa
          items={boxDrawn(keikoba)}
          base={keikoba[0]!.sprite}
          view={{ x0: 0, y0: 0, x1: KEIKOBA_STAGE.width, y1: KEIKOBA_STAGE.height }}
          label={t('scene.keikoba')}
          onAction={onAction}
          actors={titled(keikobaCast(game).keikoba)}
          onPick={onPick}
          selected={talkTo?.id ?? null}
          maxWidth={KEIKOBA_STAGE.width * 2}
          pops={pops}
          popKey={popKey}
        />
      )}
      {setGame &&
        (talkTo ? (
          <RikishiTalk
            game={game}
            r={talkTo}
            rank={ranks?.get(talkTo.id) ?? null}
            setGame={setGame}
            onDetail={onDetail}
            onClose={() => setPicked(null)}
          />
        ) : (
          <p className="note scene-box__hint">{t('talk.hint')}</p>
        ))}
    </section>
  );
}
