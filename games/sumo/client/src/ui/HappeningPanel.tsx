import { answerHappening, HAPPENINGS, type GameState } from '@ichimon/sim';
import { useI18n, type MessageKey } from '../i18n';

/** 場所の間の出来事（選択肢を押すとすぐに効果が出る。返事をしないまま進めると最後の選択肢になる） */
export function HappeningPanel({
  game,
  setGame,
}: {
  game: GameState;
  setGame: (g: GameState) => void;
}) {
  const { t } = useI18n();
  const h = game.pending.happening;
  if (!h) return null;
  const def = HAPPENINGS.find((d) => d.id === h.id)!;
  const target = h.target === null ? undefined : game.rikishi.find((r) => r.id === h.target);
  const k = (suffix: string) => `happening.${h.id}.${suffix}` as MessageKey;
  return (
    <section className="panel panel--event" aria-labelledby="happening-title">
      <h2 id="happening-title">{t(k('title'))}</h2>
      <p>{t(k('body'), { name: target?.name ?? '' })}</p>
      <ul className="plain-list">
        {def.options.map((o, i) => (
          <li key={o.key} className="row">
            <div className="row__main">
              <span className="muted">{t(k(`${o.key}.desc`))}</span>
            </div>
            <button
              className={`button ${i === 0 ? 'button--primary' : ''}`}
              onClick={() => setGame(answerHappening(game, i))}
            >
              {t(k(o.key))}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
