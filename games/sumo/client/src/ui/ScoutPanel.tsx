import {
  canScout,
  SCOUT_TRIP_IDS,
  SCOUT_TRIPS,
  scoutTrip,
  type GameState,
  type ScoutTripId,
} from '@ichimon/sim';
import { useI18n, type MessageKey } from '../i18n';
import { money } from '../format';

/** 新弟子を探しに行く（1つの場所に1回。時期の決まった大会もある） */
export function ScoutPanel({
  game,
  setGame,
}: {
  game: GameState;
  setGame: (g: GameState) => void;
}) {
  const { t, lang } = useI18n();
  const done = game.player.scoutedAt === game.bashoIndex;
  const reason = (id: ScoutTripId): string | null => {
    if (canScout(game, id)) return null;
    const def = SCOUT_TRIPS[id];
    if (done) return t('scout.done');
    if (def.months && !def.months.includes(game.bashoIndex % 6))
      return t(`scout.${id}.when` as MessageKey);
    if (game.player.stableMoney < def.cost) return t('scout.noMoney');
    return t('scout.foreignLimit');
  };
  return (
    <section className="panel">
      <h2>{t('scout.title')}</h2>
      <p className="note">{done ? t('scout.doneNote') : t('scout.note')}</p>
      <ul className="plain-list">
        {SCOUT_TRIP_IDS.map((id) => {
          const why = reason(id);
          return (
            <li key={id} className="row">
              <div className="row__main">
                <strong>{t(`scout.${id}.name` as MessageKey)}</strong>
                <span className="muted">{t(`scout.${id}.desc` as MessageKey)}</span>
                {why && <span className="muted">{why}</span>}
              </div>
              <div className="row__actions">
                <button
                  className="button"
                  disabled={why !== null}
                  onClick={() => setGame(scoutTrip(game, id))}
                >
                  {t('scout.go', { cost: money(t, SCOUT_TRIPS[id].cost, lang) })}
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
