/**
 * アプリのルート。ゲーム状態を持ち、盤面（PixiJS）と各 UI パネルをつなぐ
 */
import { getCurrentRules, getRerollCost, scoreToString, type Score } from '@chain-factory/sim';
import { useCallback, useEffect, useMemo, useReducer, useState } from 'react';
import type { BoardViewState } from './board/BoardRenderer';
import { PixiBoard } from './board/PixiBoard';
import { useI18n } from './i18n';
import type { PlaybackSpeed } from './playback/timeline';
import { createGameState, gameReducer, getPersistedRun } from './state/gameReducer';
import { createInitialRun, createNewSeed } from './state/newRun';
import { saveGame } from './state/saveStore';
import { ControlsPanel } from './ui/ControlsPanel';
import { Hud } from './ui/Hud';
import { InventoryPanel } from './ui/InventoryPanel';
import { PlaybackPanel } from './ui/PlaybackPanel';
import { RunEndScreen } from './ui/RunEndScreen';
import { SelectionPanel } from './ui/SelectionPanel';
import { ShopPanel } from './ui/ShopPanel';

export function App() {
  const { t, lang, setLang } = useI18n();
  const [state, dispatch] = useReducer(gameReducer, undefined, () =>
    createGameState(createInitialRun()),
  );
  const [speed, setSpeed] = useState<PlaybackSpeed>(1);
  /** 再生中の出荷量の途中経過 */
  const [liveScore, setLiveScore] = useState<string | null>(null);

  const { run, selection, playback, error } = state;
  const playing = playback !== null;

  // 状態が変わるたびに進行中のランを保存する
  const persistedRun = getPersistedRun(state);
  useEffect(() => saveGame(persistedRun), [persistedRun]);

  // キーボード: R で回転
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'r' || e.key === 'R') dispatch({ type: 'rotate' });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // 盤面に渡す表示状態（選択中のマス・配置しようとしているパーツ）
  const boardView = useMemo<BoardViewState>(
    () => ({
      board: run.board,
      rules: getCurrentRules(run),
      highlight: selection?.kind === 'cell' ? { x: selection.x, y: selection.y } : null,
      placing:
        selection?.kind === 'inventory' ? { partId: selection.partId, dir: selection.dir } : null,
    }),
    [run, selection],
  );

  const onShip = useCallback((total: Score) => setLiveScore(scoreToString(total)), []);
  const onPlaybackFinish = useCallback(() => dispatch({ type: 'playbackFinished' }), []);
  const onCellClick = useCallback(
    (x: number, y: number) => dispatch({ type: 'clickCell', x, y }),
    [],
  );

  const startPlayback = (type: 'startTrial' | 'startCommit') => {
    setLiveScore('0');
    dispatch({ type });
  };
  const closePlayback = () => {
    setLiveScore(null);
    dispatch({ type: 'closePlayback' });
  };
  const newRun = () => {
    setLiveScore(null);
    dispatch({ type: 'newRun', seed: createNewSeed() });
  };

  const header = (
    <header className="app-header">
      <h1 className="app-header__title">{t('app.title')}</h1>
      <button className="button--ghost" onClick={() => setLang(lang === 'ja' ? 'en' : 'ja')}>
        {t('app.language')}
      </button>
    </header>
  );

  // ラン終了（全シフト達成 or ノルマ未達）
  if (!playing && run.phase !== 'building') {
    return (
      <div className="app">
        {header}
        <RunEndScreen run={run} onRetry={newRun} />
      </div>
    );
  }

  return (
    <div className="app">
      {header}
      <Hud run={run} liveScore={liveScore} />
      <main className="layout">
        <div className="layout__board">
          <PixiBoard
            view={boardView}
            getPartName={(partId) => t(`part.${partId}.name`)}
            playbackResult={playback?.result ?? null}
            speed={speed}
            onCellClick={onCellClick}
            onShip={onShip}
            onPlaybackFinish={onPlaybackFinish}
          />
          {playback && <PlaybackPanel playback={playback} run={run} onClose={closePlayback} />}
          {error && <div className="toast">{t(`error.${error}`)}</div>}
        </div>
        <aside className="layout__side">
          <ControlsPanel
            playing={playing}
            speed={speed}
            onTrial={() => startPlayback('startTrial')}
            onCommit={() => startPlayback('startCommit')}
            onSpeedChange={setSpeed}
          />
          <ShopPanel
            offers={run.shop}
            budget={run.budget}
            rerollCost={getRerollCost(run)}
            disabled={playing}
            onBuy={(offerIndex) => dispatch({ type: 'buy', offerIndex })}
            onReroll={() => dispatch({ type: 'reroll' })}
          />
          <InventoryPanel
            inventory={run.inventory}
            selection={selection}
            disabled={playing}
            onSelect={(partId) => dispatch({ type: 'selectInventory', partId })}
          />
          <SelectionPanel
            run={run}
            selection={selection}
            disabled={playing}
            onRotate={() => dispatch({ type: 'rotate' })}
            onReturn={() => dispatch({ type: 'returnSelected' })}
            onSell={() => dispatch({ type: 'sellSelected' })}
          />
        </aside>
      </main>
    </div>
  );
}
