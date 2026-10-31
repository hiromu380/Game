import {
  buildFacility,
  FACILITIES,
  FACILITY_IDS,
  facilityUpkeep,
  nextBuildCost,
  setContract,
  type FacilityId,
  type GameState,
} from '@ichimon/sim';
import { useI18n } from '../i18n';
import { money } from '../format';

/** 設備（建物: 一度払えば残る）と契約（場所ごとに払う）。金額は推定 */
export function Facilities({
  game,
  setGame,
}: {
  game: GameState;
  setGame: (g: GameState) => void;
}) {
  const { t, lang } = useI18n();
  const f = game.player.facilities;
  return (
    <section className="panel">
      <h2>{t('facility.title')}</h2>
      <p className="note">{t('facility.note', { upkeep: money(t, facilityUpkeep(f), lang) })}</p>
      <ul className="plain-list">
        {FACILITY_IDS.map((id) => {
          const def = FACILITIES[id];
          const level = f[id];
          const max = def.costs.length;
          return (
            <li key={id} className="row">
              <div className="row__main">
                <strong>
                  {t(`facility.${id}.name`)}
                  <span className="tag">{t('facility.level', { level, max })}</span>
                </strong>
                <span className="muted">{t(`facility.${id}.desc`)}</span>
              </div>
              <div className="row__actions">
                {def.kind === 'build' ? (
                  <BuildButton game={game} setGame={setGame} id={id} />
                ) : (
                  <div className="segmented" role="group" aria-label={t(`facility.${id}.name`)}>
                    {Array.from({ length: max + 1 }, (_, l) => (
                      <button
                        key={l}
                        className={`segmented__btn ${level === l ? 'is-active' : ''}`}
                        aria-pressed={level === l}
                        onClick={() => setGame(setContract(game, id, l))}
                      >
                        {l === 0
                          ? t('facility.none')
                          : t('facility.perBasho', { cost: money(t, def.costs[l - 1]!, lang) })}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function BuildButton({
  game,
  setGame,
  id,
}: {
  game: GameState;
  setGame: (g: GameState) => void;
  id: FacilityId;
}) {
  const { t, lang } = useI18n();
  const cost = nextBuildCost(game.player.facilities, id);
  if (cost === null) return <span className="muted">{t('facility.max')}</span>;
  return (
    <button
      className="button button--primary"
      disabled={game.player.stableMoney < cost}
      onClick={() => setGame(buildFacility(game, id))}
    >
      {t('facility.build', { cost: money(t, cost, lang) })}
    </button>
  );
}
