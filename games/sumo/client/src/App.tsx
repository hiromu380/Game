import { useEffect, useMemo, useState } from 'react';
import type { GameState } from '@ichimon/sim';
import { I18nContext, makeT, type Lang } from './i18n';
import { loadGame, loadSettings, saveGame, saveSettings } from './save';
import { NewGame } from './ui/NewGame';
import { GameScreen } from './ui/GameScreen';

export function App() {
  const [lang, setLang] = useState<Lang>(() => loadSettings().lang);
  const [game, setGame] = useState<GameState | null>(() => loadGame());
  const i18n = useMemo(() => ({ lang, t: makeT(lang) }), [lang]);

  useEffect(() => saveGame(game), [game]);
  useEffect(() => {
    saveSettings({ version: 1, lang });
    document.documentElement.lang = lang;
    document.title = i18n.t('app.title');
  }, [lang, i18n]);

  return (
    <I18nContext.Provider value={i18n}>
      <div className="app">
        {game ? (
          <GameScreen
            game={game}
            setGame={setGame}
            onQuit={() => setGame(null)}
            onToggleLang={() => setLang(lang === 'ja' ? 'en' : 'ja')}
          />
        ) : (
          <NewGame onStart={setGame} onToggleLang={() => setLang(lang === 'ja' ? 'en' : 'ja')} />
        )}
      </div>
    </I18nContext.Provider>
  );
}
