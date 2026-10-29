import {
  acceptCandidate,
  answerRetirement,
  declineCandidate,
  GAME,
  setPolicy,
  styleOf,
  type Candidate,
  type GameState,
  type Policy,
  type Rank,
  type Rikishi,
} from '@ichimon/sim';
import { useI18n } from '../i18n';
import { rankLabel, recordLabel } from '../format';

const POLICIES: Policy[] = ['oshi', 'yotsu', 'waza', 'body', 'rest'];

/** 自分の部屋: 入門希望者・引退の申し出・弟子の一覧と稽古の方針 */
export function StableTab({
  game,
  ranks,
  setGame,
}: {
  game: GameState;
  ranks: ReadonlyMap<number, Rank>;
  setGame: (g: GameState) => void;
}) {
  const { t } = useI18n();
  const order = new Map(game.banzuke.map((id, i) => [id, i]));
  const mine = game.rikishi
    .filter((r) => r.stableId === game.player.stableId)
    .sort((a, b) => (order.get(a.id) ?? 1e9) - (order.get(b.id) ?? 1e9));
  const full = mine.length >= GAME.stableCapacity;
  const requests = game.pending.retireRequests
    .map((id) => game.rikishi.find((r) => r.id === id))
    .filter((r): r is Rikishi => !!r);

  return (
    <div className="stack">
      {requests.length > 0 && (
        <section className="panel panel--alert" aria-labelledby="retire-title">
          <h2 id="retire-title">{t('retire.title')}</h2>
          {requests.map((r) => (
            <div key={r.id} className="row">
              <div className="row__main">
                <strong>{r.name}</strong>
                <span>
                  {t('retire.body', { age: r.age, rank: rankLabel(t, ranks.get(r.id) ?? null) })}
                </span>
              </div>
              <div className="row__actions">
                <button
                  className="button"
                  onClick={() => setGame(answerRetirement(game, r.id, false))}
                >
                  {t('retire.persuade')}
                </button>
                <button
                  className="button button--primary"
                  onClick={() => setGame(answerRetirement(game, r.id, true))}
                >
                  {t('retire.accept')}
                </button>
              </div>
            </div>
          ))}
        </section>
      )}

      {game.pending.candidates.length > 0 && (
        <section className="panel" aria-labelledby="cand-title">
          <h2 id="cand-title">{t('candidates.title')}</h2>
          <p className="note">
            {full ? t('candidates.full', { cap: GAME.stableCapacity }) : t('candidates.note')}
          </p>
          {game.pending.candidates.map((c) => (
            <CandidateRow
              key={c.id}
              c={c}
              disabled={full || (c.foreign && mine.some((r) => r.foreign))}
              onAccept={() => setGame(acceptCandidate(game, c.id))}
              onDecline={() => setGame(declineCandidate(game, c.id))}
            />
          ))}
        </section>
      )}

      <section className="panel" aria-labelledby="mine-title">
        <h2 id="mine-title">
          {t('stable.title', { count: mine.length, cap: GAME.stableCapacity })}
        </h2>
        {mine.length === 0 && <p className="note">{t('stable.empty')}</p>}
        <ul className="rikishi-list">
          {mine.map((r) => (
            <RikishiCard
              key={r.id}
              r={r}
              rank={ranks.get(r.id) ?? null}
              onPolicy={(p) => setGame(setPolicy(game, r.id, p))}
            />
          ))}
        </ul>
      </section>
    </div>
  );
}

function CandidateRow({
  c,
  disabled,
  onAccept,
  onDecline,
}: {
  c: Candidate;
  disabled: boolean;
  onAccept: () => void;
  onDecline: () => void;
}) {
  const { t } = useI18n();
  return (
    <div className="row">
      <div className="row__main">
        <strong>{c.name}</strong>
        <span>
          {t('candidates.profile', {
            age: c.age,
            height: c.height,
            weight: c.weight,
            background: t(`background.${c.background}`),
          })}
          {c.foreign && <span className="tag">{t('candidates.foreign')}</span>}
        </span>
        <span>
          {t('candidates.grade')}
          <span className="grade" aria-label={t('candidates.gradeAria', { grade: c.scoutGrade })}>
            {'★'.repeat(c.scoutGrade)}
            <span className="grade__off">{'☆'.repeat(5 - c.scoutGrade)}</span>
          </span>
        </span>
      </div>
      <div className="row__actions">
        <button className="button" onClick={onDecline}>
          {t('candidates.decline')}
        </button>
        <button className="button button--primary" disabled={disabled} onClick={onAccept}>
          {t('candidates.accept')}
        </button>
      </div>
    </div>
  );
}

function RikishiCard({
  r,
  rank,
  onPolicy,
}: {
  r: Rikishi;
  rank: Rank | null;
  onPolicy: (p: Policy) => void;
}) {
  const { t } = useI18n();
  const last = r.recent[0];
  return (
    <li className="card">
      <div className="card__head">
        <span className="card__rank">{rankLabel(t, rank)}</span>
        <strong className="card__name">{r.name}</strong>
        <span className="card__meta">
          {t('rikishi.meta', { age: r.age, height: r.height, weight: Math.round(r.weight) })}
        </span>
      </div>
      <div className="card__body">
        <dl className="abilities">
          {(['oshi', 'yotsu', 'waza'] as const).map((k) => (
            <div key={k} className="abilities__item">
              <dt>{t(`style.${k}`)}</dt>
              <dd>
                <span className="bar" aria-hidden="true">
                  <span
                    className="bar__fill"
                    style={{ width: `${Math.min(100, r.abilities[k])}%` }}
                  />
                </span>
                <span className="abilities__num">{Math.round(r.abilities[k])}</span>
              </dd>
            </div>
          ))}
        </dl>
        <div className="card__status">
          <span>{t('rikishi.style', { style: t(`style.${styleOf(r.abilities)}`) })}</span>
          <span>{t('rikishi.fatigue', { value: Math.round(r.fatigue) })}</span>
          {r.injury > 0 && (
            <span className="tag tag--warn">{t('rikishi.injury', { basho: r.injury })}</span>
          )}
          {last && <span>{t('rikishi.last', { record: recordLabel(t, last) })}</span>}
        </div>
      </div>
      <div className="policy" role="group" aria-label={t('policy.label')}>
        {POLICIES.map((p) => (
          <button
            key={p}
            className={`policy__btn ${r.policy === p ? 'is-selected' : ''}`}
            aria-pressed={r.policy === p}
            onClick={() => onPolicy(p)}
          >
            {t(`policy.${p}`)}
          </button>
        ))}
      </div>
    </li>
  );
}
