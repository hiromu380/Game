import { useState } from 'react';
import {
  acceptCandidate,
  answerRetirement,
  chooseTreatment,
  declineCandidate,
  headGain,
  stableCapacity,
  type Candidate,
  type GameState,
  type Rank,
} from '@ichimon/sim';
import { useI18n } from '../i18n';
import { money, rankLabel } from '../format';
import { woundName } from '../injury';
import { CandidatePortrait, RikishiPortrait } from '../art/Portraits';
import { HappeningPanel } from './HappeningPanel';
import { ElectionPanel } from './ElectionPanel';
import { IndependencePanel } from './IndependencePanel';

/**
 * 返事が要るものを1件ずつ窓で出す（部屋の画面には並べない）。順に: 引退の申し出 → けがの治療の方針 → 場所の間の出来事 →
 * 理事選挙 → 独立の申し出 → 入門希望者（1人ずつ）。返事をすると次が出る。決めないと閉じない（Esc で閉じない）
 */
export function EventDialogs({
  game,
  ranks,
  setGame,
}: {
  game: GameState;
  ranks: ReadonlyMap<number, Rank>;
  setGame: (g: GameState) => void;
}) {
  const { t } = useI18n();
  // 選挙の返事を見終えた場所・出来事の結果を見終えた日誌の長さ（返事の後も残るものを閉じる）
  const [electionSeen, setElectionSeen] = useState<number | null>(null);
  const [resultSeen, setResultSeen] = useState<number>(-1);
  const box = (label: string, body: React.ReactNode) => (
    <div className="modal" role="dialog" aria-modal="true" aria-label={label}>
      <div className="modal__box event-box">{body}</div>
    </div>
  );
  const byId = (id: number) => game.rikishi.find((r) => r.id === id);

  // 引退の申し出
  const retire = game.pending.retireRequests.map(byId).find((r) => r !== undefined);
  if (retire)
    return box(
      t('retire.title'),
      <>
        <h2>{t('retire.title')}</h2>
        <div className="row">
          <RikishiPortrait r={retire} rank={ranks.get(retire.id) ?? null} size={56} />
          <div className="row__main">
            <strong>{retire.name}</strong>
            <span>
              {t('retire.body', {
                age: retire.age,
                rank: rankLabel(t, ranks.get(retire.id) ?? null),
              })}
            </span>
          </div>
        </div>
        <div className="modal__actions">
          <button
            className="button"
            onClick={() => setGame(answerRetirement(game, retire.id, false))}
          >
            {t('retire.persuade')}
          </button>
          <button
            className="button button--primary"
            onClick={() => setGame(answerRetirement(game, retire.id, true))}
          >
            {t('retire.accept')}
          </button>
        </div>
      </>,
    );

  // けがの治療の方針
  const hurt = game.pending.treatment.map(byId).find((r) => r?.wound !== undefined);
  if (hurt?.wound)
    return box(
      t('treatment.label'),
      <>
        <h2>{t('treatment.label')}</h2>
        <div className="row">
          <RikishiPortrait r={hurt} rank={ranks.get(hurt.id) ?? null} size={56} />
          <div className="row__main">
            <strong>{hurt.name}</strong>
            <span>
              {t('treatment.note', { part: woundName(t, hurt.wound), total: hurt.wound.total })}
            </span>
          </div>
        </div>
        <div className="modal__actions">
          <button
            className="button"
            onClick={() => setGame(chooseTreatment(game, hurt.id, 'rest'))}
          >
            {t('treatment.rest')}
          </button>
          <button
            className="button button--primary"
            onClick={() => setGame(chooseTreatment(game, hurt.id, 'surgery'))}
          >
            {t('treatment.surgery')}
          </button>
        </div>
      </>,
    );

  // 場所の間の出来事（答えた後、確率で決まった結果があれば見せてから閉じる）
  const last = game.journal.at(-1);
  const result =
    !game.pending.happening &&
    last?.kind === 'happening' &&
    last.bashoIndex === game.bashoIndex &&
    last.hit !== undefined &&
    resultSeen !== game.journal.length;
  if (game.pending.happening || result)
    return box(
      t('event.title'),
      <>
        <HappeningPanel game={game} setGame={setGame} />
        {result && (
          <div className="modal__actions">
            <button
              className="button button--primary"
              onClick={() => setResultSeen(game.journal.length)}
            >
              {t('event.ok')}
            </button>
          </div>
        )}
      </>,
    );

  // 理事選挙（返事を選んで「決めた」で閉じる）
  if (game.pending.election && electionSeen !== game.bashoIndex) {
    const panel = <ElectionPanel game={game} setGame={setGame} />;
    return box(
      t('election.title'),
      <>
        {panel}
        <div className="modal__actions">
          <button
            className="button button--primary"
            onClick={() => setElectionSeen(game.bashoIndex)}
          >
            {t('event.ok')}
          </button>
        </div>
      </>,
    );
  }

  // 独立の申し出
  if (game.pending.independence !== null)
    return box(
      t('independence.title'),
      <IndependencePanel game={game} ranks={ranks} setGame={setGame} />,
    );

  // 入門希望者（1人ずつ）
  const c = game.pending.candidates[0];
  if (c) {
    const mine = game.rikishi.filter((r) => r.stableId === game.player.stableId);
    const cap = stableCapacity(game);
    const full = mine.length >= cap;
    return box(
      t('candidates.title'),
      <>
        <h2>
          {t('candidates.title')}
          {game.pending.candidates.length > 1 && (
            <span className="event-box__count">
              {t('event.more', { n: game.pending.candidates.length })}
            </span>
          )}
        </h2>
        <p className="note">{full ? t('candidates.full', { cap }) : t('candidates.note')}</p>
        <CandidateRow
          rivalName={game.stables.find((s) => s.id === game.rival?.stableId)?.name}
          perHead={headGain(game)}
          c={c}
          disabled={full || (c.foreign && mine.some((r) => r.foreign))}
          onAccept={() => setGame(acceptCandidate(game, c.id))}
          onDecline={() => setGame(declineCandidate(game, c.id))}
        />
      </>,
    );
  }
  return null;
}

function CandidateRow({
  c,
  disabled,
  rivalName,
  perHead,
  onAccept,
  onDecline,
}: {
  c: Candidate;
  disabled: boolean;
  /** 入門すると、部屋の口座が1場所あたりいくら動くか */
  perHead: number;
  /** ライバルの部屋の名前（取り合いの札に出す） */
  rivalName: string | undefined;
  onAccept: () => void;
  onDecline: () => void;
}) {
  const { t, lang } = useI18n();
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
          <span className={`candidates__yen ${perHead < 0 ? 'down' : ''}`}>
            {t('candidates.perHead', {
              yen: (perHead >= 0 ? '+' : '−') + money(t, Math.abs(perHead), lang),
            })}
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
