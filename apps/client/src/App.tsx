/**
 * ゲーム画面。ゲーム状態を持ち、盤面（PixiJS）と各 UI パネルをつなぐ
 *
 * このファイル以下（PixiJS を含む）は遅延読み込みされる（boot/loadGame.ts）。
 * 画面幅が狭いとき（スマホ縦画面）は、盤面の下にショップ・手持ちをタブで切り替えて出す。
 */
import {
  createRunWithConfig,
  dailyRunSeed,
  getCurrentRules,
  getRerollCost,
  scoreToString,
  SIM_VERSION,
  type RunState,
  type Score,
} from '@chain-factory/sim';
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import type { BoardLabels, BoardViewState } from './board/BoardRenderer';
import { PixiBoard } from './board/PixiBoard';
import { audio } from './audio/AudioEngine';
import { LAYOUT } from './config/layout';
import { useI18n } from './i18n';
import { api, OnlineError } from './online/api';
import { getMarket, priceTrends } from './online/market';
import { useSettings } from './settings/SettingsContext';
import { SettingsPanel } from './settings/SettingsPanel';
import type { PlaybackSpeed } from './playback/timeline';
import { createGameState, gameReducer, getPersistedRun, type PlayMode } from './state/gameReducer';
import { createInitialState, createNewSeed, startNormalRun } from './state/newRun';
import { useMediaQuery } from './state/useMediaQuery';
import { useSteamAchievements } from './platform/useSteamAchievements';
import { loadRun, saveGame } from './state/saveStore';
import { BossNotice, findBossToShow } from './ui/BossNotice';
import { ControlsPanel } from './ui/ControlsPanel';
import { DebugPanel } from './ui/DebugPanel';
import { Hud } from './ui/Hud';
import { InventoryPanel } from './ui/InventoryPanel';
import { PlaybackPanel } from './ui/PlaybackPanel';
import { RunEndScreen } from './ui/RunEndScreen';
import { SelectionPanel } from './ui/SelectionPanel';
import { DailyMenu } from './ui/online/DailyMenu';
import { ShopPanel } from './ui/ShopPanel';

/** ゲーム画面の始め方（デイリー・練習はメニューで組み立てたランを渡す） */
export interface GameStart {
  run: RunState;
  mode: PlayMode;
}

interface Props {
  /** null なら通常ラン（保存済みの続き or 新規） */
  start: GameStart | null;
  /** タイトル画面へ戻る */
  onTitle: () => void;
}

/** デバッグ表示のボタンは開発中か ?debug を付けたときだけ出す */
const DEBUG_AVAILABLE =
  import.meta.env.DEV || new URLSearchParams(window.location.search).has('debug');

export function App({ start, onTitle }: Props) {
  const { t, formatScore, formatCompact } = useI18n();
  const [state, dispatch] = useReducer(gameReducer, start, (initialStart) => {
    const initial = createInitialState();
    return initialStart
      ? createGameState(initialStart.run, initial.meta, initialStart.mode, initial.achievements)
      : createGameState(initial.run, initial.meta, undefined, initial.achievements);
  });
  const compact = useMediaQuery(`(max-width: ${LAYOUT.compactMaxWidthPx}px)`);
  /** 狭い画面で表示中のタブ */
  const [tab, setTab] = useState<'shop' | 'inventory'>('shop');
  const [speed, setSpeed] = useState<PlaybackSpeed>(1);
  /** 再生中の出荷量の途中経過 */
  const [liveScore, setLiveScore] = useState<string | null>(null);
  /** デバッグ表示の開閉 */
  const [debugOpen, setDebugOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  /** デイリーのメニュー（開いていなければ null） */
  const [dailyMenu, setDailyMenu] = useState<'menu' | 'ranking' | null>(null);

  const { settings } = useSettings();
  const { run, selection, playback, error, mode } = state;
  const playing = playback !== null || state.awaitingServer;

  // 状態が変わるたびに保存する。ランは通常モードのみ（デイリーはサーバーから再開する）。
  // デイリー・練習中は保存済みの通常ランを残したまま、メタ進行と実績だけを更新する
  const persistedRun = getPersistedRun(state);
  useEffect(() => {
    saveGame({
      run: persistedRun ?? undefined,
      meta: state.meta,
      achievements: state.achievements,
    });
  }, [persistedRun, state.meta, state.achievements]);

  // 実績と統計を Steam へ送る（起動時・解除や記録が変わったとき）。
  // 解除済みを毎回まとめて送るのは、オフラインで解除した分を後から送り直すため（Steam 側では二重に解除されない）
  useSteamAchievements(state.meta, state.achievements);
  const onRanked = useCallback(
    (topPercent: number) => dispatch({ type: 'dailyRanked', topPercent }),
    [],
  );

  // デイリー本番: 操作ログをサーバーへ送り、検証済みの本番シードを受け取る。
  // 同じシフトを二重に送らないよう、送信中のシフトを覚えておく（開発時の StrictMode の二重実行対策も兼ねる）
  const inflightShift = useRef<number | null>(null);
  useEffect(() => {
    if (!state.awaitingServer || mode.kind !== 'daily') return;
    if (inflightShift.current === run.shiftIndex) return;
    inflightShift.current = run.shiftIndex;
    api
      .commit(mode.dailyId, {
        simVersion: SIM_VERSION,
        shiftIndex: run.shiftIndex,
        ops: state.pendingOps,
      })
      .then((res) => dispatch({ type: 'serverCommitted', seed: res.seed }))
      .catch((e: unknown) =>
        dispatch({
          type: 'serverCommitFailed',
          error: `online.${e instanceof OnlineError ? e.code : 'network'}`,
        }),
      )
      .finally(() => {
        inflightShift.current = null;
      });
  }, [state.awaitingServer, state.pendingOps, mode, run.shiftIndex]);

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

  const onCellLongPress = useCallback(
    (x: number, y: number) => dispatch({ type: 'longPressCell', x, y }),
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
    // 練習は同じ条件で最初から。通常は新しいシードで
    if (mode.kind === 'practice') {
      dispatch({
        type: 'loadRun',
        run: createRunWithConfig(dailyRunSeed(mode.dailyId), run.config),
        mode,
      });
      return;
    }
    dispatch({ type: 'loadRun', run: startNormalRun(createNewSeed(), state.meta), mode });
  };
  const enterRun = (next: RunState, nextMode: PlayMode) => {
    setLiveScore(null);
    setDailyMenu(null);
    dispatch({ type: 'loadRun', run: next, mode: nextMode });
  };
  /** 通常モードに戻る（保存済みのランがあれば続きから） */
  const backToNormal = () =>
    enterRun(loadRun() ?? startNormalRun(createNewSeed(), state.meta), { kind: 'normal' });

  // ショップの前日比（今日の相場で始めたランだけ）
  const trends = useMemo(() => priceTrends(getMarket(), run.config.economy.prices), [run.config]);

  const header = (
    <header className="app-header">
      <h1 className="app-header__title">
        <button
          className="app-header__home"
          disabled={playing}
          onClick={onTitle}
          aria-label={t('title.backToTitle')}
        >
          <img className="app-header__icon" src="./icon.svg" alt="" width={36} height={36} />
          <span className="app-header__name">{t('app.title')}</span>
        </button>
      </h1>
      <div className="button-row app-header__actions">
        {mode.kind !== 'normal' && (
          <>
            <span className="mode-badge">
              {t(mode.kind === 'daily' ? 'mode.daily' : 'mode.practice', { number: mode.number })}
            </span>
            <button className="button--ghost" disabled={playing} onClick={backToNormal}>
              {t('mode.backToNormal')}
            </button>
          </>
        )}
        <button className="button--ghost" disabled={playing} onClick={() => setDailyMenu('menu')}>
          {t('online.dailyButton')}
        </button>
        {DEBUG_AVAILABLE && (
          <button className="button--ghost" onClick={() => setDebugOpen((v) => !v)}>
            {t('debug.toggle')}
          </button>
        )}
        <button className="button--ghost" onClick={() => setSettingsOpen(true)}>
          {t('settings.open')}
        </button>
      </div>
      {settingsOpen && <SettingsPanel onClose={() => setSettingsOpen(false)} />}
      {dailyMenu && (
        <DailyMenu
          initialView={dailyMenu}
          onEnter={enterRun}
          onClose={() => setDailyMenu(null)}
          onRanked={onRanked}
        />
      )}
    </header>
  );

  const shopPanel = (
    <ShopPanel
      rules={boardView.rules}
      offers={run.shop}
      budget={run.budget}
      rerollCost={getRerollCost(run)}
      trends={trends}
      disabled={playing}
      onBuy={(offerIndex) => dispatch({ type: 'buy', offerIndex })}
      onReroll={() => dispatch({ type: 'reroll' })}
    />
  );
  const inventoryPanel = (
    <InventoryPanel
      rules={boardView.rules}
      inventory={run.inventory}
      selection={selection}
      disabled={playing}
      onSelect={(partId) => dispatch({ type: 'selectInventory', partId })}
    />
  );
  const selectionPanel = (
    <SelectionPanel
      run={run}
      selection={selection}
      hideWhenEmpty={compact}
      disabled={playing}
      onRotate={() => dispatch({ type: 'rotate' })}
      onReturn={() => dispatch({ type: 'returnSelected' })}
      onSell={() => dispatch({ type: 'sellSelected' })}
    />
  );

  // ラン終了（全シフト達成 or ノルマ未達）
  if (!playing && run.phase !== 'building') {
    return (
      <div className="app">
        {header}
        <RunEndScreen
          run={run}
          meta={state.meta}
          unlocks={state.unlocks}
          achievements={state.achievements}
          mode={mode}
          onViewRanking={() => setDailyMenu('ranking')}
          onBackToNormal={backToNormal}
          onRetry={newRun}
          onOvertime={() => {
            setLiveScore(null);
            dispatch({ type: 'startOvertime' });
          }}
        />
      </div>
    );
  }

  return (
    <div className={`app ${compact ? 'app--compact' : ''}`}>
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
            onCellLongPress={onCellLongPress}
            onShip={onShip}
            onPlaybackFinish={onPlaybackFinish}
          />
          {playback && <PlaybackPanel playback={playback} run={run} onClose={closePlayback} />}
          {error && <div className="toast">{t(`error.${error}`)}</div>}
          {state.awaitingServer && <div className="toast">{t('daily.committing')}</div>}
        </div>
        <aside className="layout__side">
          <ControlsPanel
            playing={playing}
            compact={compact}
            speed={speed}
            onTrial={() => startPlayback('startTrial')}
            onCommit={() => startPlayback('startCommit')}
            onSpeedChange={setSpeed}
          />
          {/* 狭い画面では選択中のパーツの操作を盤面のすぐ下に出す（何も選んでいなければ出さない） */}
          {compact && selectionPanel}
          {compact && (
            <div className="tabs" role="tablist">
              {(['shop', 'inventory'] as const).map((key) => (
                <button
                  key={key}
                  role="tab"
                  aria-selected={tab === key}
                  className={`tabs__tab ${tab === key ? 'is-active' : ''}`}
                  onClick={() => setTab(key)}
                >
                  {t(key === 'shop' ? 'shop.title' : 'inventory.title')}
                </button>
              ))}
            </div>
          )}
          {(!compact || tab === 'shop') && shopPanel}
          {(!compact || tab === 'inventory') && inventoryPanel}
          {debugOpen && <DebugPanel run={run} result={state.lastResult} />}
          {!compact && selectionPanel}
        </aside>
      </main>
    </div>
  );
}
