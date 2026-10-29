import type { GameState } from '@ichimon/sim';
import { useI18n } from '../i18n';
import { bashoName } from '../format';

/** 一門が途絶えた（跡継ぎがいない・お金が尽きた） */
export function GameOver({ game, onNewGame }: { game: GameState; onNewGame: () => void }) {
  const { t } = useI18n();
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
      <ol className="lineage">
        {game.player.lineage.map((l) => (
          <li key={l.generation} className="lineage__item">
            <span className="lineage__gen">{t('lineage.generation', { n: l.generation })}</span>{' '}
            <strong>{t('lineage.oyakata', { name: l.name, shikona: l.shikona })}</strong>
          </li>
        ))}
      </ol>
      <button className="button button--primary button--large" onClick={onNewGame}>
        {t('gameOver.newGame')}
      </button>
    </main>
  );
}
