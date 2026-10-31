import { useEffect, useMemo, useState } from 'react';
import type { GameState } from '@ichimon/sim';
import { I18nContext, makeT } from './i18n';
import { loadGame, loadSettings, saveGame, saveSettings, type Settings } from './save';
import { NewGame } from './ui/NewGame';
import { GameScreen } from './ui/GameScreen';
import { SettingsContext } from './settings';

export function App() {
  const [settings, setSettings] = useState<Settings>(() => loadSettings());
  const [game, setGame] = useState<GameState | null>(() => loadGame());
  const { lang } = settings;
  const i18n = useMemo(() => ({ lang, t: makeT(lang) }), [lang]);
  const settingsValue = useMemo(
    () => ({
      settings,
      update: (patch: Partial<Settings>) => setSettings((s) => ({ ...s, ...patch })),
    }),
    [settings],
  );
  const toggleLang = () => settingsValue.update({ lang: lang === 'ja' ? 'en' : 'ja' });

  useEffect(() => saveGame(game), [game]);
  useEffect(() => saveSettings(settings), [settings]);
  useEffect(() => {
    document.documentElement.lang = lang;
    document.title = i18n.t('app.title');
  }, [lang, i18n]);

  return (
    <SettingsContext.Provider value={settingsValue}>
      <I18nContext.Provider value={i18n}>
        <div className="app">
          {game ? (
            <GameScreen
              game={game}
              setGame={setGame}
              onQuit={() => setGame(null)}
              onToggleLang={toggleLang}
            />
          ) : (
            <NewGame onStart={setGame} onToggleLang={toggleLang} />
          )}
        </div>
      </I18nContext.Provider>
    </SettingsContext.Provider>
  );
}
