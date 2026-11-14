import { useState } from 'react';
import { answerIndependence, LINEAGE, type GameState, type Rank } from '@ichimon/sim';
import { useI18n } from '../i18n';
import { rankLabel } from '../format';

/** 部屋付きの親方の独立の申し出（認めるなら連れて行く内弟子を選ぶ） */
export function IndependencePanel({
  game,
  ranks,
  setGame,
}: {
  game: GameState;
  ranks: ReadonlyMap<number, Rank>;
  setGame: (g: GameState) => void;
}) {
  const { t } = useI18n();
  const [take, setTake] = useState<number[]>([]);
  const o = game.oyakata.find((x) => x.id === game.pending.independence);
  if (!o) return null;
  const mine = game.rikishi.filter((r) => r.stableId === game.player.stableId);
  const toggle = (id: number) =>
    setTake((cur) =>
      cur.includes(id)
        ? cur.filter((x) => x !== id)
        : cur.length < LINEAGE.maxTakeDisciples
          ? [...cur, id]
          : cur,
    );
  return (
    <section className="panel panel--alert" aria-labelledby="indep-title">
      <h2 id="indep-title">{t('independence.title')}</h2>
      <p>{t('independence.body', { name: o.name, shikona: o.shikona, age: o.age })}</p>
      <p className="note">{t('independence.note', { max: LINEAGE.maxTakeDisciples })}</p>
      <fieldset className="checklist">
        <legend>
          {t('independence.take', { count: take.length, max: LINEAGE.maxTakeDisciples })}
        </legend>
        {mine.map((r) => (
          <label key={r.id} className="checklist__item">
            <input type="checkbox" checked={take.includes(r.id)} onChange={() => toggle(r.id)} />
            <span>{r.name}</span>
            <span className="muted">{rankLabel(t, ranks.get(r.id) ?? null)}</span>
          </label>
        ))}
      </fieldset>
      <div className="row__actions">
        <button className="button" onClick={() => setGame(answerIndependence(game, false))}>
          {t('independence.decline')}
        </button>
        <button
          className="button button--primary"
          onClick={() => setGame(answerIndependence(game, true, take))}
        >
          {t('independence.accept')}
        </button>
      </div>
    </section>
  );
}
