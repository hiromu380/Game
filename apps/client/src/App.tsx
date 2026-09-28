/**
 * アプリのルート。ゲーム状態を持ち、盤面（PixiJS）と各 UI パネルをつなぐ
 */
import { getCurrentRules, getRerollCost, scoreToString, type Score } from '@chain-factory/sim';
import { useCallback, useEffect, useMemo, useReducer, useState } from 'react';
import type { BoardLabels, BoardViewState } from './board/BoardRenderer';
import { PixiBoard } from './board/PixiBoard';
import { audio } from './audio/AudioEngine';
import { useI18n } from './i18n';
import { useSettings } from './settings/SettingsContext';
import { SettingsPanel } from './settings/SettingsPanel';
import type { PlaybackSpeed } from './playback/timeline';
import { createGameState, gameReducer, getPersistedRun } from './state/gameReducer';
import { createInitialState, createNewSeed } from './state/newRun';
import { saveGame } from './state/saveStore';
import { BossNotice, findBossToShow } from './ui/BossNotice';
import { ControlsPanel } from './ui/ControlsPanel';
import { DebugPanel } from './ui/DebugPanel';
import { Hud } from './ui/Hud';
import { InventoryPanel } from './ui/InventoryPanel';
import { PlaybackPanel } from './ui/PlaybackPanel';
import { RunEndScreen } from './ui/RunEndScreen';
import { SelectionPanel } from './ui/SelectionPanel';
import { ShopPanel } from './ui/ShopPanel';

export function App() {
  const { t, formatScore, formatCompact } = useI18n();
  const [state, dispatch] = useReducer(gameReducer, undefined, () => {
    const initial = createInitialState();
    return createGameState(initial.run, initial.meta);
  });
  const [speed, setSpeed] = useState<PlaybackSpeed>(1);
  /** 再生中の出荷量の途中経過 */
  const [liveScore, setLiveScore] = useState<string | null>(null);
  /** デバッグ表示の開閉 */
  const [debugOpen, setDebugOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const { settings } = useSettings();
  const { run, selection, playback, error } = state;
  const playing = playback !== null;

  // 状態が変わるたびに進行中のランを保存する
  const persistedRun = getPersistedRun(state);
  useEffect(() => saveGame(persistedRun, state.meta), [persistedRun, state.meta]);

  // 音量の設定を反映する
  useEffect(() => {
    audio.setVolumes(settings);
  }, [settings]);

  // 操作の手応え（配置・購入・エラーなど）の効果音。
  // feedback は操作のたびに新しいオブジェクトになるので、変わったときに1回鳴らす
  const { feedback } = state;
  useEffect(() => {
    if (feedback) audio.play(feedback.kind);
  }, [feedback]);

  // 本番の結果が出たときの効果音（ノルマ達成・全シフトクリア・ラン失敗）。
  // playback は再生終了時に finished: true の新しいオブジェクトになる
  useEffect(() => {
    if (playback?.mode !== 'commit' || !playback.finished) return;
    const next = playback.nextRun.phase;
    audio.play(next === 'failed' ? 'runFailed' : next === 'cleared' ? 'runCleared' : 'quotaMet');
  }, [playback]);

  // BGM（曲はまだないので、今は何も流れない。曲を入れれば組み立て中・結果画面で切り替わる）
  const bgm = run.phase === 'building' ? 'building' : 'result';
  useEffect(() => {
    audio.playBgm(bgm);
  }, [bgm]);

  // 新しい解放があれば結果画面で鳴らす
  const showingUnlocks = !playing && run.phase !== 'building' && state.unlocks.length > 0;
  useEffect(() => {
    if (showingUnlocks) audio.play('unlock');
  }, [showingUnlocks]);

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
      // 今夜の補修工事で使えなくなるマスを、朝・昼のうちから予告表示する
      upcomingBlocked: (() => {
        const boss = findBossToShow(run);
        return boss && !boss.isNow ? boss.entry.blockedCells : [];
      })(),
      highlight: selection?.kind === 'cell' ? { x: selection.x, y: selection.y } : null,
      placing:
        selection?.kind === 'inventory' ? { partId: selection.partId, dir: selection.dir } : null,
    }),
    [run, selection],
  );

  // 盤面に出す文言（言語が変わったら作り直す）
  const boardLabels = useMemo<BoardLabels>(
    () => ({
      getPartName: (partId) => t(`part.${partId}.name`),
      formatIncome: (amount) => t('playback.incomePop', { amount }),
      getBreakLabel: (reason) => t(`break.short.${reason}`),
      formatChain: (count) => t('playback.chainCounter', { count }),
      getCutInTitle: () => t('playback.cutIn'),
      formatScore,
      formatCompact,
    }),
    [t, formatScore, formatCompact],
  );
  const effectSettings = useMemo(
    () => ({ strength: settings.effects, shake: settings.shake }),
    [settings.effects, settings.shake],
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
      <h1 className="app-header__title">
        <img className="app-header__icon" src="./icon.svg" alt="" width={36} height={36} />
        {t('app.title')}
      </h1>
      <div className="button-row">
        <button className="button--ghost" onClick={() => setDebugOpen((v) => !v)}>
          {t('debug.toggle')}
        </button>
        <button className="button--ghost" onClick={() => setSettingsOpen(true)}>
          {t('settings.open')}
        </button>
      </div>
      {settingsOpen && <SettingsPanel onClose={() => setSettingsOpen(false)} />}
    </header>
  );

  // ラン終了（全シフト達成 or ノルマ未達）
  if (!playing && run.phase !== 'building') {
    return (
      <div className="app">
        {header}
        <RunEndScreen run={run} meta={state.meta} unlocks={state.unlocks} onRetry={newRun} />
      </div>
    );
  }

  return (
    <div className="app">
      {header}
      <Hud run={run} liveScore={liveScore} />
      <BossNotice run={run} />
      <main className="layout">
        <div className="layout__board">
          <PixiBoard
            view={boardView}
            labels={boardLabels}
            effectSettings={effectSettings}
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
            rules={boardView.rules}
            offers={run.shop}
            budget={run.budget}
            rerollCost={getRerollCost(run)}
            disabled={playing}
            onBuy={(offerIndex) => dispatch({ type: 'buy', offerIndex })}
            onReroll={() => dispatch({ type: 'reroll' })}
          />
          <InventoryPanel
            rules={boardView.rules}
            inventory={run.inventory}
            selection={selection}
            disabled={playing}
            onSelect={(partId) => dispatch({ type: 'selectInventory', partId })}
          />
          {debugOpen && <DebugPanel run={run} result={state.lastResult} />}
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
