import { useEffect, useMemo, useRef, useState } from 'react';
import type { BoutResult, GameState } from '@ichimon/sim';
import { useI18n, type MessageKey } from '../i18n';
import { boutScript, poseAt, type Pose } from '../playback/boutScript';
import { playSound } from '../sound';

/** 取組の短い演出（土俵を上から見た図）。動きを減らす設定では最後の場面だけを見せる */
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
  const played = useRef(new Set<number>());
  const skipped = useRef(false);
  useEffect(() => {
    if (reduced) return;
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
  }, [script, sound, reduced]);

  const pose = poseAt(script, time);
  const byId = new Map(game.rikishi.map((r) => [r.id, r]));
  const east = byId.get(bout.eastId);
  const west = byId.get(bout.westId);
  const winner = bout.winnerId === bout.eastId ? east : west;
  const done = time >= script.duration;
  const R = 120; // 土俵の半径（px）
  // 名前は体と一緒に傾けない。東は上、西は下に出して、ぶつかったときに重ならないようにする
  const body = (p: Pose, color: string, label: string, labelY: number) => (
    <g>
      <g transform={`translate(${p.x * R} ${p.y * R}) rotate(${p.rot})`}>
        <ellipse rx={26} ry={30} fill={color} stroke="#1f1b16" strokeWidth={2} />
        <rect x={-26} y={4} width={52} height={10} fill="#1f1b16" />
      </g>
      <text
        x={p.x * R}
        y={p.y * R + labelY}
        textAnchor="middle"
        fontSize={15}
        fill="#1f1b16"
        fontWeight="bold"
      >
        {label}
      </text>
    </g>
  );

  return (
    <div className="modal" role="dialog" aria-modal="true" aria-labelledby="bout-title">
      <div className="modal__box">
        <h2 id="bout-title">{t('bout.title', { day: bout.day })}</h2>
        <svg
          className="dohyo"
          viewBox={`${-R * 1.6} ${-R * 1.1} ${R * 3.2} ${R * 2.2}`}
          role="img"
          aria-label={t('bout.aria')}
        >
          <rect x={-R * 1.5} y={-R * 1.05} width={R * 3} height={R * 2.1} fill="#d9c49a" />
          <circle r={R} fill="#e8d5ad" stroke="#7a5a2a" strokeWidth={6} />
          <line x1={-14} y1={-8} x2={-14} y2={8} stroke="#fff" strokeWidth={3} />
          <line x1={14} y1={-8} x2={14} y2={8} stroke="#fff" strokeWidth={3} />
          {body(pose.west, '#f0e6d8', west?.name ?? '', 52)}
          {body(pose.east, '#e9dcc9', east?.name ?? '', -40)}
        </svg>
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
