import { useMemo, useState } from 'react';
import { advanceBasho, isBlocked, ranksOf, type GameState } from '@ichimon/sim';
import { useI18n } from '../i18n';
import { OyakataPortrait } from '../art/Portraits';
import { useSettings } from '../settings';
import { bashoName, money } from '../format';
import { StableTab } from './StableTab';
import { BanzukeTab } from './BanzukeTab';
import { LedgerTab } from './LedgerTab';
import { LineageTab } from './LineageTab';
import { AssociationTab } from './AssociationTab';
import { ReportDialog } from './ReportDialog';
import { SuccessorDialog, KakunDialog, TakeOverDialog } from './LineageDialogs';
import { GameOver } from './GameOver';

type Tab = 'stable' | 'banzuke' | 'ledger' | 'lineage' | 'association';
const TABS: Tab[] = ['stable', 'banzuke', 'ledger', 'lineage', 'association'];

/** 早送り（1年）は、判断が要ることが起きたら止まる */
function advanceYear(start: GameState): GameState {
  let s = start;
  for (let i = 0; i < 6; i++) {
    s = advanceBasho(s);
    if (s.gameOver || isBlocked(s) || s.pending.retireRequests.length > 0) break;
  }
  return s;
}

export function GameScreen({
  game,
  setGame,
  onQuit,
  onToggleLang,
}: {
  game: GameState;
  setGame: (g: GameState | null) => void;
  onQuit: () => void;
  onToggleLang: () => void;
}) {
  const { t, lang } = useI18n();
  const { settings, update } = useSettings();
  const [tab, setTab] = useState<Tab>('stable');
  const [showReport, setShowReport] = useState(false);
  const [confirmQuit, setConfirmQuit] = useState(false);
  const ranks = useMemo(() => ranksOf(game.banzuke, game.titles), [game.banzuke, game.titles]);
  const master = game.oyakata.find((o) => o.id === game.player.oyakataId)!;
  const blocked = isBlocked(game);

  if (game.gameOver) return <GameOver game={game} onNewGame={() => setGame(null)} />;

  const go = (next: GameState) => {
    setGame(next);
    setShowReport(true);
  };

  return (
    <div className="game">
      <header className="topbar">
        <div className="topbar__portrait">
          <OyakataPortrait o={master} size={52} />
        </div>
        <div className="topbar__main">
          <div className="topbar__basho">{bashoName(t, game.bashoIndex)}</div>
          <div className="topbar__stable">
            {t('top.stable', {
              name: game.stables.find((s) => s.id === game.player.stableId)!.name,
            })}
            <span className="topbar__sub">
              {t('top.oyakata', {
                name: master.name,
                age: master.age,
                generation: game.player.generation,
              })}
            </span>
          </div>
        </div>
        <dl className="topbar__stats">
          <div>
            <dt>{t('top.stableMoney')}</dt>
            <dd>{money(t, game.player.stableMoney, lang)}</dd>
          </div>
          <div>
            <dt>{t('top.personalMoney')}</dt>
            <dd>{money(t, game.player.personalMoney, lang)}</dd>
          </div>
          <div>
            <dt>{t('top.prestige')}</dt>
            <dd>{Math.round(game.player.prestige)}</dd>
          </div>
        </dl>
        <div className="topbar__tools">
          <button className="button button--ghost" onClick={onToggleLang}>
            {t('lang.toggle')}
          </button>
          <button
            className="button button--ghost"
            aria-pressed={settings.sound}
            onClick={() => update({ sound: !settings.sound })}
          >
            {settings.sound ? t('sound.on') : t('sound.off')}
          </button>
          <button className="button button--ghost" onClick={() => setConfirmQuit(true)}>
            {t('top.quit')}
          </button>
        </div>
      </header>

      <nav className="tabs" role="tablist">
        {TABS.map((k) => (
          <button
            key={k}
            role="tab"
            aria-selected={tab === k}
            className={`tabs__tab ${tab === k ? 'is-active' : ''}`}
            onClick={() => setTab(k)}
          >
            {t(`tab.${k}`)}
          </button>
        ))}
      </nav>

      <main className="content">
        {tab === 'stable' && <StableTab game={game} ranks={ranks} setGame={setGame} />}
        {tab === 'banzuke' && <BanzukeTab game={game} ranks={ranks} />}
        {tab === 'ledger' && <LedgerTab game={game} setGame={setGame} />}
        {tab === 'lineage' && <LineageTab game={game} />}
        {tab === 'association' && <AssociationTab game={game} ranks={ranks} />}
      </main>

      <footer className="actionbar">
        <span className="actionbar__hint">
          {game.pending.retireRequests.length > 0 ? t('action.hintRetire') : t('action.hint')}
        </span>
        {game.lastReport && (
          <button className="button" onClick={() => setShowReport(true)}>
            {t('action.lastReport')}
          </button>
        )}
        <button className="button" disabled={blocked} onClick={() => go(advanceYear(game))}>
          {t('action.year')}
        </button>
        <button
          className="button button--primary"
          disabled={blocked}
          onClick={() => go(advanceBasho(game))}
        >
          {t('action.basho')}
        </button>
      </footer>

      {showReport && game.lastReport && !blocked && (
        <ReportDialog game={game} report={game.lastReport} onClose={() => setShowReport(false)} />
      )}
      {game.pending.successor && <SuccessorDialog game={game} setGame={setGame} />}
      {game.pending.takeOver && <TakeOverDialog game={game} setGame={setGame} />}
      {!game.pending.successor && !game.pending.takeOver && game.pending.kakun && (
        <KakunDialog game={game} setGame={setGame} />
      )}
      {confirmQuit && (
        <div className="modal" role="dialog" aria-modal="true" aria-labelledby="quit-title">
          <div className="modal__box">
            <h2 id="quit-title">{t('quit.title')}</h2>
            <p>{t('quit.body')}</p>
            <div className="modal__actions">
              <button className="button" onClick={() => setConfirmQuit(false)}>
                {t('common.cancel')}
              </button>
              <button className="button button--danger" onClick={onQuit}>
                {t('quit.confirm')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
