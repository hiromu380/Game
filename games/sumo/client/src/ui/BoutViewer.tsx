import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { isSekitori, ranksOf, type BoutResult, type GameState, type Rikishi } from '@ichimon/sim';
import { useI18n, type MessageKey } from '../i18n';
import { boutScript, poseAt } from '../playback/boutScript';
import { BoutStage } from '../art/BoutStage';
import type { ComponentProps } from 'react';
import { rikishiLook } from '../art/look';
import { playSound } from '../sound';
import type { MotionClock } from '../art/three/animation';

/** 通信失敗もSVGで受け止め、演出時計を開始する。 */
function SvgStage({
  onReady,
  ...props
}: ComponentProps<typeof BoutStage> & { motion?: MotionClock; onReady: () => void }) {
  useEffect(onReady, [onReady]);
  return <BoutStage {...props} />;
}
const BoutStage3D = lazy(() =>
  import('../art/three/BoutStage3D').catch(() => ({ default: SvgStage })),
);

/** 取組の短い演出（向正面から見た土俵）。動きを減らす設定では最後の場面だけを見せる */
export function BoutViewer({
  game,
  bout,
  sound,
  onClose,
}: {
  game: GameState;
  bout: BoutResult;
  sound: boolean;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const script = useMemo(
    () =>
      boutScript(
        bout.kimarite,
        bout.winnerId === bout.eastId ? 'E' : 'W',
        bout.day * 7919 + bout.eastId * 31 + bout.westId,
      ),
    [bout],
  );
  const reduced =
    typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const [time, setTime] = useState(reduced ? script.duration : 0);
  const [ready, setReady] = useState(false);
  const onReady = useCallback(() => setReady(true), []);
  const played = useRef(new Set<number>());
  const skipped = useRef(false);
  useEffect(() => {
    if (reduced || !ready) return;
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      if (skipped.current) return;
      const s = (now - start) / 1000;
      script.frames.forEach((f, i) => {
        if (f.sound && s >= f.t && !played.current.has(i)) {
          played.current.add(i);
          if (sound) playSound(f.sound);
        }
      });
      setTime(Math.min(s, script.duration));
      if (s < script.duration) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [script, sound, reduced, ready]);

  const pose = poseAt(script, time);
  const byId = new Map(game.rikishi.map((r) => [r.id, r]));
  const ranks = useMemo(() => ranksOf(game.banzuke, game.titles), [game.banzuke, game.titles]);
  const east = byId.get(bout.eastId);
  const west = byId.get(bout.westId);
  const winnerSide = bout.winnerId === bout.eastId ? 'E' : 'W';
  const winner = winnerSide === 'E' ? east : west;
  const done = time >= script.duration;
  // 立ち合いの後は両手を前に出して押し合う
  const clash = script.frames[1]?.t ?? 0.6;
  const lookOf = (r: Rikishi | undefined) => {
    const rank = r ? ranks.get(r.id) : undefined;
    return rikishiLook({
      id: r?.id ?? 0,
      weight: r?.weight ?? 130,
      stableId: r?.stableId ?? 0,
      careerBasho: r?.career.basho ?? 10,
      sekitori: rank ? isSekitori(rank) : false,
      yokozuna: rank?.title === 'Y',
      injured: false,
      fatigue: 0,
    });
  };

  return (
    <div className="modal" role="dialog" aria-modal="true" aria-labelledby="bout-title">
      <div className="modal__box modal__box--bout">
        <h2 id="bout-title">{t('bout.title', { day: bout.day })}</h2>
        <Suspense
          fallback={
            <BoutStage
              east={lookOf(east)}
              west={lookOf(west)}
              pose={pose}
              arms={time >= clash - 0.15 && !done ? 'push' : 'side'}
              winner={done ? winnerSide : null}
              title={t('bout.aria')}
            />
          }
        >
          <BoutStage3D
            east={lookOf(east)}
            west={lookOf(west)}
            pose={pose}
            arms={time >= clash - 0.15 && !done ? 'push' : 'side'}
            winner={done ? winnerSide : null}
            title={t('bout.aria')}
            motion={{ time, clash, duration: script.duration } satisfies MotionClock}
            onReady={onReady}
          />
        </Suspense>
        <p className="bout__names">
          <span>
            {t('rank.side.W')} <strong>{west?.name ?? '?'}</strong>
          </span>
          <span>
            {t('rank.side.E')} <strong>{east?.name ?? '?'}</strong>
          </span>
        </p>
        <p className={`bout__result ${done ? 'is-done' : ''}`} aria-live="polite">
          {done
            ? t('bout.result', {
                winner: winner?.name ?? '',
                kimarite: t(`kimarite.${bout.kimarite}` as MessageKey),
              })
            : t('bout.playing')}
          {done && bout.kensho > 0 ? ` ${t('bout.kensho', { count: bout.kensho })}` : ''}
        </p>
        <div className="modal__actions">
          {!done && (
            <button
              className="button"
              onClick={() => {
                skipped.current = true;
                setTime(script.duration);
              }}
            >
              {t('bout.skip')}
            </button>
          )}
          <button className="button button--primary" onClick={onClose}>
            {t('common.close')}
          </button>
        </div>
      </div>
    </div>
  );
}
