import { useMemo, useState } from 'react';
import { ranksOf, type GameState, type MidBasho } from '@ichimon/sim';
import { useI18n } from '../i18n';
import { dayLabel, rankLabel } from '../format';
import { woundName } from '../injury';

/** 中日（8日目）: 前半の星と幕内の先頭。休場している弟子を後半から出すか決める */
export function MidBashoDialog({
  game,
  mid,
  onContinue,
}: {
  game: GameState;
  mid: MidBasho;
  onContinue: (reenter: number[]) => void;
}) {
  const { t } = useI18n();
  const [reenter, setReenter] = useState<Set<number>>(new Set());
  const ranks = useMemo(() => ranksOf(game.banzuke, game.titles), [game.banzuke, game.titles]);
  const byId = new Map(game.rikishi.map((r) => [r.id, r]));
  const name = (id: number) => byId.get(id)?.name ?? '?';
  const toggle = (id: number, on: boolean) => {
    const next = new Set(reenter);
    if (on) next.add(id);
    else next.delete(id);
    setReenter(next);
  };
  return (
    <div className="modal" role="dialog" aria-modal="true" aria-labelledby="mid-title">
      <div className="modal__box mid">
        <h2 id="mid-title">{t('mid.title', { day: dayLabel(t, mid.day) })}</h2>
        <p>{t('mid.lead')}</p>
        <p className="callout">
          {t('mid.leaders', {
            record: t('race.record', { wins: mid.leaders.wins, losses: mid.leaders.losses }),
            names: mid.leaders.ids.map(name).join('・'),
          })}
        </p>
        <h3>{t('mid.mine')}</h3>
        <ul className="mid__list">
          {mid.mine.map((m) => {
            const r = byId.get(m.id);
            const rank = ranks.get(m.id) ?? null;
            const on = reenter.has(m.id);
            return (
              <li key={m.id} className={m.out ? 'mid__row is-out' : 'mid__row'}>
                <span className="mid__rank">{rankLabel(t, rank)}</span>
                <strong>{name(m.id)}</strong>
                <span className="mid__record">
                  {t('race.record', { wins: m.wins, losses: m.losses })}
                </span>
                {m.out && (
                  <span className="tag tag--warn">
                    {m.injuredDay !== null
                      ? t('mid.hurtOn', { day: dayLabel(t, m.injuredDay) })
                      : r?.wound
                        ? t('mid.outWound', { part: woundName(t, r.wound) })
                        : t('mid.outFromStart')}
                  </span>
                )}
                {m.out && (
                  <div
                    className="hurt mid__choice"
                    role="group"
                    aria-label={t('mid.choice', { name: name(m.id) })}
                  >
                    <button
                      className={`policy__btn ${!on ? 'is-selected' : ''}`}
                      aria-pressed={!on}
                      onClick={() => toggle(m.id, false)}
                    >
                      {t('mid.stay')}
                    </button>
                    <button
                      className={`policy__btn ${on ? 'is-selected' : ''}`}
                      aria-pressed={on}
                      onClick={() => toggle(m.id, true)}
                    >
                      {m.injuredDay !== null ? t('mid.reenter') : t('mid.lateEntry')}
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
        {mid.mine.some((m) => m.out) && <p className="note">{t('mid.note')}</p>}
        <div className="modal__actions">
          <button className="button button--primary" onClick={() => onContinue([...reenter])}>
            {t('mid.continue')}
          </button>
        </div>
      </div>
    </div>
  );
}
