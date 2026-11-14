import { KACHIKOSHI_SHARE, pledgeKept, type GameState } from '@ichimon/sim';
import { useI18n, type MessageKey } from '../i18n';
import { goalsOf, nextGoal, type Goal } from '../goals';

function Pips({ goals }: { goals: Goal[] }) {
  const { t } = useI18n();
  const done = goals.filter((g) => g.done).length;
  return (
    <span className="goals__pips" aria-label={t('goals.count', { done, total: goals.length })}>
      {goals.map((g) => (
        <span key={g.id} className={`goals__pip ${g.done ? 'is-done' : ''}`} aria-hidden="true" />
      ))}
      <span className="goals__count" aria-hidden="true">
        {t('goals.count', { done, total: goals.length })}
      </span>
    </span>
  );
}

/** 次の目標（部屋の画面のいちばん上に、1枚で） */
export function NextGoalCard({ game }: { game: GameState }) {
  const { t } = useI18n();
  const goals = goalsOf(game);
  const next = nextGoal(goals);
  return (
    <section className="goals-card" aria-labelledby="goal-next">
      <div className="goals-card__head">
        <span id="goal-next" className="goals-card__label">
          {next ? t('goals.next') : t('goals.title')}
        </span>
        <Pips goals={goals} />
      </div>
      {next ? (
        <>
          <strong className="goals-card__name">
            {t(`goals.${next.id}.name`)}
            {next.progress && t('goals.progress', next.progress)}
          </strong>
          <p className="note">{t(`goals.${next.id}.hint`)}</p>
        </>
      ) : (
        <p className="note">{t('goals.allDone')}</p>
      )}
      <PledgeLine game={game} />
    </section>
  );
}

/** 部屋の歩み: 越えた節目とこれからの節目の一覧 */
export function GoalsPanel({ game }: { game: GameState }) {
  const { t } = useI18n();
  const goals = goalsOf(game);
  const next = nextGoal(goals);
  return (
    <section className="panel" aria-labelledby="goals-title">
      <h2 id="goals-title">{t('goals.title')}</h2>
      <Pips goals={goals} />
      <ol className="goals__list">
        {goals.map((g) => (
          <li
            key={g.id}
            className={`goals__item ${g.done ? 'is-done' : ''} ${g === next ? 'is-next' : ''}`}
          >
            <span className="goals__mark" aria-hidden="true">
              {g.done ? '◆' : '◇'}
            </span>
            <span className="goals__name">
              {t(`goals.${g.id}.name`)}
              {g.progress && !g.done && t('goals.progress', g.progress)}
            </span>
            <span className={`tag ${g.done ? '' : 'tag--quiet'}`}>
              {g.done ? t('goals.done') : g === next ? t('goals.next') : t('goals.todo')}
            </span>
            {g === next && <p className="note goals__hint">{t(`goals.${g.id}.hint`)}</p>}
          </li>
        ))}
      </ol>
    </section>
  );
}

/** 後援会との約束の進み具合（約束しているときだけ1行） */
function PledgeLine({ game }: { game: GameState }) {
  const { t } = useI18n();
  const p = game.player.pledge;
  if (!p) return null;
  const share = Math.round(KACHIKOSHI_SHARE * 100);
  const kept = pledgeKept(p);
  const left = 6 - (game.bashoIndex % 6);
  const progress =
    p.kind === 'kachikoshi'
      ? t('pledge.progress.kk', {
          kk: p.kk,
          mk: p.mk,
          pct: p.kk + p.mk > 0 ? Math.round((p.kk / (p.kk + p.mk)) * 100) : 0,
        })
      : t(kept ? 'pledge.progress.done' : 'pledge.progress.notYet');
  return (
    <p className={`pledge-line ${kept ? 'is-on' : 'is-off'}`}>
      <span aria-hidden="true">{kept ? '✓ ' : '… '}</span>
      {t('pledge.line', {
        name: t(`pledge.${p.kind}.name` as MessageKey, { share }),
        progress,
        left,
      })}
    </p>
  );
}
