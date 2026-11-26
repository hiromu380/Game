import type { GameState } from '@ichimon/sim';
import { useI18n, type MessageKey } from '../i18n';
import { ACHIEVEMENTS, achievedOf, tierOf } from '../achievements';
import { bashoName } from '../format';
import { loadCheckpoint } from '../save';
import { ShareTree } from './ShareTree';

/** 一門が途絶えた（跡継ぎがいない・お金が尽きた） */
export function GameOver({
  game,
  onNewGame,
  onRetry,
}: {
  game: GameState;
  onNewGame: () => void;
  /** 年の初めの控えから続ける */
  onRetry: (from: GameState) => void;
}) {
  const { t } = useI18n();
  const checkpoint = loadCheckpoint(game);
  const achieved = achievedOf(game).length;
  const lastPlace = game.moneyLog.at(-1)?.place;
  const total = game.player.lineage.reduce(
    (n, l) => ({
      sekitori: n.sekitori + l.sekitori,
      yokozuna: n.yokozuna + l.yokozuna,
      yusho: n.yusho + l.makuuchiYusho,
    }),
    { sekitori: 0, yokozuna: 0, yusho: 0 },
  );
  return (
    <main className="newgame">
      <h1 className="newgame__title">{t(`gameOver.${game.gameOver!}`)}</h1>
      <p>{t('gameOver.when', { basho: bashoName(t, game.bashoIndex) })}</p>
      <p className="callout">
        {t('gameOver.summary', {
          generations: game.player.generation,
          sekitori: total.sekitori,
          yokozuna: total.yokozuna,
          yusho: total.yusho,
        })}
      </p>
      {/* 締めくくり: 部屋の格・実績・最後の部屋の力（言い合える数字で終える） */}
      <dl className="tiles">
        <div className="tile">
          <dt>{t('gameOver.tier')}</dt>
          <dd>{t(`achv.tierName.${tierOf(achieved)}` as MessageKey)}</dd>
        </div>
        <div className="tile">
          <dt>{t('achv.title')}</dt>
          <dd>{t('achv.count', { done: achieved, total: ACHIEVEMENTS.length })}</dd>
        </div>
        {lastPlace !== undefined && (
          <div className="tile">
            <dt>{t('gameOver.place')}</dt>
            <dd>{t('report.tile.place', { place: lastPlace })}</dd>
          </div>
        )}
      </dl>
      <ol className="lineage">
        {game.player.lineage.map((l) => (
          <li key={l.generation} className="lineage__item">
            <span className="lineage__gen">{t('lineage.generation', { n: l.generation })}</span>{' '}
            <strong>{t('lineage.oyakata', { name: l.name, shikona: l.shikona })}</strong>
          </li>
        ))}
      </ol>
      <ShareTree game={game} />
      <div className="gameover__actions">
        {checkpoint && (
          <button
            className="button button--primary button--large"
            onClick={() => onRetry(checkpoint)}
          >
            {t('gameOver.retry', { basho: bashoName(t, checkpoint.bashoIndex) })}
          </button>
        )}
        <button
          className={`button button--large ${checkpoint ? '' : 'button--primary'}`}
          onClick={onNewGame}
        >
          {t('gameOver.newGame')}
        </button>
      </div>
    </main>
  );
}
