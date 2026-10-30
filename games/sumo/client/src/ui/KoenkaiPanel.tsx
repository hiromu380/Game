import {
  canVisit,
  giftOf,
  KOENKAI,
  setParty,
  visitPatron,
  type GameState,
  type PartyLevel,
} from '@ichimon/sim';
import { useI18n, type MessageKey } from '../i18n';
import { money } from '../format';

const PARTIES: PartyLevel[] = ['none', 'small', 'grand'];

/** 後援会: 会員・法人会員・千秋楽パーティー・タニマチ（関係・ひいきの力士・挨拶回り） */
export function KoenkaiPanel({
  game,
  setGame,
}: {
  game: GameState;
  setGame: (g: GameState) => void;
}) {
  const { t, lang } = useI18n();
  const k = game.player.koenkai;
  const nameOf = (id: number | null) =>
    id === null ? '—' : (game.rikishi.find((r) => r.id === id)?.name ?? '—');
  return (
    <section className="panel">
      <h2>{t('koenkai.title')}</h2>
      <dl className="tiles">
        <div className="tile">
          <dt>{t('koenkai.members')}</dt>
          <dd>{t('koenkai.people', { count: k.members })}</dd>
        </div>
        <div className="tile">
          <dt>{t('koenkai.corporate')}</dt>
          <dd>{t('koenkai.companies', { count: k.corporate })}</dd>
        </div>
        <div className="tile">
          <dt>{t('koenkai.patrons')}</dt>
          <dd>{t('koenkai.people', { count: k.patrons.length })}</dd>
        </div>
      </dl>

      <h3 className="panel__sub">{t('koenkai.party')}</h3>
      <div className="segmented" role="group" aria-label={t('koenkai.party')}>
        {PARTIES.map((p) => (
          <button
            key={p}
            className={`segmented__btn ${k.party === p ? 'is-active' : ''}`}
            aria-pressed={k.party === p}
            onClick={() => setGame(setParty(game, p))}
          >
            {t(`koenkai.party.${p}` as MessageKey)}
            {KOENKAI.party[p].cost > 0 && `（${money(t, KOENKAI.party[p].cost, lang)}）`}
          </button>
        ))}
      </div>
      <p className="muted">{t(`koenkai.party.${k.party}.desc` as MessageKey)}</p>

      <h3 className="panel__sub">{t('koenkai.patronList')}</h3>
      {k.patrons.length === 0 && <p className="note">{t('koenkai.noPatrons')}</p>}
      <ul className="plain-list">
        {k.patrons.map((p) => (
          <li key={p.id} className="row">
            <div className="row__main">
              <strong>{t(`patron.kind.${p.kind}` as MessageKey, { surname: p.surname })}</strong>
              <span className="muted">
                {t('koenkai.patronInfo', {
                  favorite: nameOf(p.favoriteId),
                  gift: money(t, giftOf(p), lang),
                })}
              </span>
              <span
                className="favor"
                aria-label={t('koenkai.favorAria', { favor: Math.round(p.favor) })}
              >
                <span className="bar" aria-hidden="true">
                  <span className="bar__fill" style={{ width: `${p.favor}%` }} />
                </span>
                <span>{t(favorWord(p.favor))}</span>
              </span>
            </div>
            <div className="row__actions">
              <button
                className="button"
                disabled={
                  !canVisit(p, game.bashoIndex) || game.player.personalMoney < KOENKAI.visitCost
                }
                onClick={() => setGame(visitPatron(game, p.id))}
              >
                {canVisit(p, game.bashoIndex)
                  ? t('koenkai.visit', { cost: money(t, KOENKAI.visitCost, lang) })
                  : t('koenkai.visited')}
              </button>
            </div>
          </li>
        ))}
      </ul>
      <p className="note">{t('koenkai.note')}</p>
    </section>
  );
}

function favorWord(f: number): MessageKey {
  return f >= 75
    ? 'koenkai.favor.high'
    : f >= 45
      ? 'koenkai.favor.mid'
      : f >= 25
        ? 'koenkai.favor.low'
        : 'koenkai.favor.danger';
}
