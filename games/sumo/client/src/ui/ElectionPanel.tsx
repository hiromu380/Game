import { answerElection, OFFICE, type GameState } from '@ichimon/sim';
import { useI18n } from '../i18n';

/** 理事選挙の案内（委員以上のとき）。推薦があれば立候補、なければ見送りが返事のない場合の答え */
export function ElectionPanel({
  game,
  setGame,
}: {
  game: GameState;
  setGame: (g: GameState) => void;
}) {
  const { t } = useI18n();
  const e = game.pending.election;
  if (!e || (e.recommended === null && e.choice === 'stay' && !canAnswer(game))) return null;
  const choice = e.choice ?? (e.recommended ? 'run' : 'stay');
  const seat = e.recommended ? t(`office.${e.recommended}`) : '';
  const p = Math.round(
    Math.min(OFFICE.rebelMax, OFFICE.rebelBase + game.player.prestige * OFFICE.rebelPerPrestige) *
      100,
  );
  return (
    <section className="panel panel--event" aria-labelledby="election-title">
      <h2 id="election-title">{t('election.title')}</h2>
      <p>
        {e.recommended
          ? t('election.recommended', { seat })
          : t('election.notRecommended', { percent: p })}
      </p>
      <div className="row__actions">
        <button
          className={`button ${choice === 'run' ? 'button--primary' : ''}`}
          aria-pressed={choice === 'run'}
          onClick={() => setGame(answerElection(game, 'run'))}
        >
          {e.recommended ? t('election.run') : t('election.rebel')}
        </button>
        <button
          className={`button ${choice === 'stay' ? 'button--primary' : ''}`}
          aria-pressed={choice === 'stay'}
          onClick={() => setGame(answerElection(game, 'stay'))}
        >
          {e.recommended ? t('election.decline') : t('election.stay')}
        </button>
      </div>
      <p className="note">{t('election.note')}</p>
    </section>
  );
}

const canAnswer = (game: GameState) => answerElection(game, 'run') !== game;
