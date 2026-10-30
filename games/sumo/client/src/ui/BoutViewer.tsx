import { useEffect, useMemo, useRef, useState } from 'react';
import {
  isSekitori,
  KIMARITE_BY_ID,
  ranksOf,
  styleOf,
  type BoutResult,
  type GameState,
  type Rikishi,
} from '@ichimon/sim';
import { useI18n, type MessageKey } from '../i18n';
import { boutFlow, boutScript, linesAt, poseAt, type CallLine } from '../playback/boutScript';
import { BoutStage } from '../art/BoutStage';
import { rikishiLook } from '../art/look';
import { playSound } from '../sound';

/** 取組の演出（向正面から見た土俵と実況）。動きを減らす設定では最後の場面と実況の全文を見せる */
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
  const byId = useMemo(() => new Map(game.rikishi.map((r) => [r.id, r])), [game.rikishi]);
  const east = byId.get(bout.eastId);
  const west = byId.get(bout.westId);
  const winnerSide = bout.winnerId === bout.eastId ? 'E' : 'W';
  const seed = bout.day * 7919 + bout.eastId * 31 + bout.westId;
  const script = useMemo(() => {
    const flow = boutFlow({
      kimarite: bout.kimarite,
      winner: winnerSide,
      eastStyle: east ? styleOf(east.abilities) : 'oshi',
      westStyle: west ? styleOf(west.abilities) : 'oshi',
      seed,
    });
    return boutScript(flow, seed);
  }, [bout.kimarite, winnerSide, east, west, seed]);
  const reduced =
    typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const [time, setTime] = useState(reduced ? script.duration : 0);
  const [run, setRun] = useState(0);
  const skipped = useRef(false);
  useEffect(() => {
    if (reduced) return;
    skipped.current = false;
    const played = new Set<number>();
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      if (skipped.current) return;
      const s = (now - start) / 1000;
      script.frames.forEach((f, i) => {
        if (f.sound && s >= f.t && !played.has(i)) {
          played.add(i);
          if (sound) playSound(f.sound);
        }
      });
      setTime(Math.min(s, script.duration));
      if (s < script.duration) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [script, sound, reduced, run]);

  const ranks = useMemo(() => ranksOf(game.banzuke, game.titles), [game.banzuke, game.titles]);
  const pose = poseAt(script, time);
  const done = time >= script.duration;
  const decided = time >= script.finishAt;
  const name = (s: CallLine['a']) => (s === 'E' ? east?.name : west?.name) ?? '?';
  const lineText = (l: CallLine) => t(l.key as MessageKey, { a: name(l.a), b: name(l.b) });
  const shown = linesAt(script, time);
  const def = KIMARITE_BY_ID.get(bout.kimarite);
  const winner = winnerSide === 'E' ? east : west;
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
      <div className="modal__box modal__box--wide">
        <h2 id="bout-title">{t('bout.title', { day: bout.day })}</h2>
        <div className="bout">
          <div className="bout__stage">
            <BoutStage
              east={lookOf(east)}
              west={lookOf(west)}
              pose={pose}
              arms={pose.contact ? 'push' : 'side'}
              winner={decided ? winnerSide : null}
              title={t('bout.aria')}
            />
            <p className="bout__names">
              <span>
                {t('rank.side.W')} <strong>{west?.name ?? '?'}</strong>
              </span>
              <span>
                {t('rank.side.E')} <strong>{east?.name ?? '?'}</strong>
              </span>
            </p>
            {decided && (
              <div className="bout__kimarite" aria-hidden="true">
                <span className="bout__kimarite-group">
                  {t(`kimarite.group.${def?.group ?? 'kihon'}` as MessageKey)}
                </span>
                <span className="bout__kimarite-name">
                  {t(`kimarite.${bout.kimarite}` as MessageKey)}
                </span>
              </div>
            )}
          </div>
          <div className="bout__call">
            {bout.kensho > 0 && (
              <p className="bout__line">{t('bout.kenshoIntro', { count: bout.kensho })}</p>
            )}
            <ol aria-live="polite">
              {shown.map((l, i) => (
                <li
                  key={i}
                  className={`bout__line ${l.gyoji ? 'is-gyoji' : ''} ${i === shown.length - 1 && !done ? 'is-now' : ''}`}
                >
                  {l.gyoji && <span className="bout__speaker">{t('bout.gyoji')}</span>}
                  {lineText(l)}
                </li>
              ))}
            </ol>
            {done && (
              <p className="bout__result is-done">
                {t('bout.result', {
                  winner: winner?.name ?? '',
                  kimarite: t(`kimarite.${bout.kimarite}` as MessageKey),
                })}
                {def?.group === 'hiwaza' ? ` ${t('bout.hiwazaNote')}` : ''}
              </p>
            )}
          </div>
        </div>
        <div className="modal__actions">
          {done ? (
            <button
              className="button"
              onClick={() => {
                setTime(0);
                setRun((n) => n + 1);
              }}
            >
              {t('bout.replay')}
            </button>
          ) : (
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
