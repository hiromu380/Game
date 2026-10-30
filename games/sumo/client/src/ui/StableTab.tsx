import {
  acceptCandidate,
  answerRetirement,
  declineCandidate,
  setPlayHurt,
  setPolicy,
  stableCapacity,
  styleOf,
  tokuiWaza,
  traitsOf,
  TRAITS,
  type TraitId,
  type Candidate,
  type GameState,
  type Policy,
  type Rank,
  type Rikishi,
} from '@ichimon/sim';
import { useI18n, type MessageKey } from '../i18n';
import { CandidatePortrait, lookOfRikishi, RikishiPortrait } from '../art/Portraits';
import { RikishiDetail } from './RikishiDetail';
import { useState } from 'react';
import { IndependencePanel } from './IndependencePanel';
import { HappeningPanel } from './HappeningPanel';
import { ElectionPanel } from './ElectionPanel';
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
  const [detail, setDetail] = useState<number | null>(null);
  const detailRikishi = detail === null ? undefined : game.rikishi.find((r) => r.id === detail);
  const order = new Map(game.banzuke.map((id, i) => [id, i]));
  const mine = game.rikishi
    .filter((r) => r.stableId === game.player.stableId)
    .sort((a, b) => (order.get(a.id) ?? 1e9) - (order.get(b.id) ?? 1e9));
  const cap = stableCapacity(game);
  const full = mine.length >= cap;
  const requests = game.pending.retireRequests
    .map((id) => game.rikishi.find((r) => r.id === id))
    .filter((r): r is Rikishi => !!r);

  return (
    <div className="stack">
      {detailRikishi && (
        <RikishiDetail
          subject={{
            name: detailRikishi.name,
            look: lookOfRikishi(detailRikishi, ranks.get(detailRikishi.id) ?? null),
            rank: ranks.get(detailRikishi.id) ?? null,
            age: detailRikishi.age,
            height: detailRikishi.height,
            weight: detailRikishi.weight,
            abilities: detailRikishi.abilities,
            foreign: detailRikishi.foreign,
            career: detailRikishi.career,
            track: detailRikishi.track,
            traits: knownTraits(detailRikishi),
          }}
          onClose={() => setDetail(null)}
        />
      )}
      {requests.length > 0 && (
        <section className="panel panel--alert" aria-labelledby="retire-title">
          <h2 id="retire-title">{t('retire.title')}</h2>
          {requests.map((r) => (
            <div key={r.id} className="row">
              <RikishiPortrait r={r} rank={ranks.get(r.id) ?? null} size={56} />
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

      <HappeningPanel game={game} setGame={setGame} />

      <ElectionPanel game={game} setGame={setGame} />

      {game.pending.independence !== null && (
        <IndependencePanel game={game} ranks={ranks} setGame={setGame} />
      )}

      {game.pending.candidates.length > 0 && (
        <section className="panel candidates" aria-labelledby="cand-title">
          <h2 id="cand-title">{t('candidates.title')}</h2>
          <p className="note">{full ? t('candidates.full', { cap }) : t('candidates.note')}</p>
          <div className="candidates__list">
            {game.pending.candidates.map((c) => (
              <CandidateRow
                rivalName={game.stables.find((s) => s.id === game.rival?.stableId)?.name}
                key={c.id}
                c={c}
                disabled={full || (c.foreign && mine.some((r) => r.foreign))}
                onAccept={() => setGame(acceptCandidate(game, c.id))}
                onDecline={() => setGame(declineCandidate(game, c.id))}
              />
            ))}
          </div>
        </section>
      )}

      <section className="panel" aria-labelledby="mine-title">
        <h2 id="mine-title">{t('stable.title', { count: mine.length, cap })}</h2>
        {mine.length === 0 && <p className="note">{t('stable.empty')}</p>}
        <ul className="rikishi-list">
          {mine.map((r) => (
            <RikishiCard
              key={r.id}
              r={r}
              rank={ranks.get(r.id) ?? null}
              onPolicy={(p) => setGame(setPolicy(game, r.id, p))}
              onPlayHurt={(play) => setGame(setPlayHurt(game, r.id, play))}
              onDetail={() => setDetail(r.id)}
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
  rivalName,
  onAccept,
  onDecline,
}: {
  c: Candidate;
  disabled: boolean;
  /** ライバルの部屋の名前（取り合いの札に出す） */
  rivalName: string | undefined;
  onAccept: () => void;
  onDecline: () => void;
}) {
  const { t } = useI18n();
  return (
    <div className="row">
      <CandidatePortrait c={c} />
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
          {c.contested && rivalName && (
            <span className="tag tag--warn">{t('candidates.contested', { rival: rivalName })}</span>
          )}
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
  onPlayHurt,
  onDetail,
}: {
  r: Rikishi;
  rank: Rank | null;
  onPolicy: (p: Policy) => void;
  onPlayHurt: (play: boolean) => void;
  onDetail: () => void;
}) {
  const { t } = useI18n();
  const last = r.recent[0];
  return (
    <li className="card">
      <button
        className="card__portrait"
        onClick={onDetail}
        aria-label={t('detail.open', { name: r.name })}
      >
        <RikishiPortrait r={r} rank={rank} size={88} />
      </button>
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
          {(knownTraits(r) ?? []).map((tr) => (
            <span key={tr} className="tag tag--trait" title={t(`trait.${tr}.desc` as MessageKey)}>
              ◆{t(`trait.${tr}.name` as MessageKey)}
            </span>
          ))}
          {tokuiWaza(r.career) && (
            <span>
              {t('rikishi.tokui', { kimarite: t(`kimarite.${tokuiWaza(r.career)}` as MessageKey) })}
            </span>
          )}
        </div>
      </div>
      {r.injury > 0 && (
        <div className="hurt" role="group" aria-label={t('hurt.label')}>
          <span className="hurt__note">{t('hurt.note')}</span>
          <button
            className={`policy__btn ${!r.playHurt ? 'is-selected' : ''}`}
            aria-pressed={!r.playHurt}
            onClick={() => onPlayHurt(false)}
          >
            {t('hurt.rest')}
          </button>
          <button
            className={`policy__btn ${r.playHurt ? 'is-selected' : ''}`}
            aria-pressed={r.playHurt}
            onClick={() => onPlayHurt(true)}
          >
            {t('hurt.play')}
          </button>
        </div>
      )}
      <div className="policy" role="group" aria-label={t('policy.label')}>
        <span className="policy__label">{t('policy.label')}</span>
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

/** 自分の弟子の個性（番付に載って何場所かたつと分かってくる。それまでは null） */
function knownTraits(r: Rikishi): readonly TraitId[] | null {
  return r.career.basho >= TRAITS.knownAfterBasho ? traitsOf(r) : null;
}
