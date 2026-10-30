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
  // 答えたばかりの出来事の結果（確率で決まったもの）
  const last = game.journal.at(-1);
  if (!h) {
    if (last?.kind !== 'happening' || last.bashoIndex !== game.bashoIndex || last.hit === undefined)
      return null;
    return (
      <section className="panel panel--event" aria-live="polite">
        <h2>{t(`happening.${last.id}.title` as MessageKey)}</h2>
        <p>
          {t('happening.result', {
            text: t(
              `happening.${last.id}.${last.option}.${last.hit ? 'hit' : 'miss'}` as MessageKey,
              { name: last.name ?? '' },
            ),
          })}
        </p>
      </section>
    );
  }
  const def = HAPPENINGS.find((d) => d.id === h.id)!;
  const target = h.target === null ? undefined : game.rikishi.find((r) => r.id === h.target);
  const k = (suffix: string) => `happening.${h.id}.${suffix}` as MessageKey;
  const vars = { name: target?.name ?? '' };
  return (
    <section className="panel panel--event" aria-labelledby="happening-title">
      <h2 id="happening-title">{t(k('title'))}</h2>
      <p>{t(k('body'), vars)}</p>
      <ul className="plain-list">
        {def.options.map((o, i) => (
          <li key={o.key} className="row">
            <div className="row__main">
              <span className="muted">{t(k(`${o.key}.desc`), vars)}</span>
            </div>
            <button
              className={`button ${i === 0 ? 'button--primary' : ''}`}
              onClick={() => setGame(answerHappening(game, i))}
            >
              {t(k(o.key), vars)}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
