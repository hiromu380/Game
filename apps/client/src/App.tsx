/**
 * ゲーム画面。ゲーム状態を持ち、盤面（PixiJS）と各 UI パネルをつなぐ
 *
 * このファイル以下（PixiJS を含む）は遅延読み込みされる（boot/loadGame.ts）。
 * 画面幅が狭いとき（スマホ縦画面）は、盤面の下にショップ・手持ちをタブで切り替えて出す。
 */
import {
  createRunWithConfig,
  dailyRunSeed,
  getCurrentEconomy,
  drawFloorPermit,
  getCurrentFloor,
  type FloorParams,
  getCurrentRules,
  getCurrentShift,
  getDayAndPeriod,
  getRefund,
  getRerollCost,
  isEventPending,
  scoreToString,
  SIM_VERSION,
  type RunState,
  type Score,
  type PartId,
} from '@chain-factory/sim';
import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type CSSProperties,
} from 'react';
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
import { createInitialState, isTutorialRun, startNewNormalRun } from './state/newRun';
import { trialStatus } from './state/trialStatus';
import { isDebugAvailable } from './config/debug';
import { useMediaQuery } from './state/useMediaQuery';
import { useGameControls } from './input/useGameControls';
import { useInputMode } from './input/useInputMode';
import { useSteamAchievements } from './platform/useSteamAchievements';
import { loadRun, saveGame } from './state/saveStore';
import { BossNotice, findBossToShow } from './ui/BossNotice';
import { CommitConfirm } from './ui/CommitConfirm';
import { SellZone } from './ui/SellZone';
import { DayEventDialog, DayEventNotice } from './ui/DayEventDialog';
import { RocketGoal } from './ui/RocketProgress';
import { TutorialGuide } from './ui/TutorialGuide';
import {
  advanceTutorial,
  gearAvailability,
  startTutorial,
  tutorialCell,
  tutorialPart,
  updateTutorial,
  type TutorialState,
} from './state/tutorial';
import { ControlsPanel } from './ui/ControlsPanel';
import { DebugPanel } from './ui/DebugPanel';
import { Hud } from './ui/Hud';
import { InventoryPanel } from './ui/InventoryPanel';
import { PlaybackPanel } from './ui/PlaybackPanel';
import { RunEndScreen } from './ui/RunEndScreen';
import { SelectionPanel } from './ui/SelectionPanel';
import { CapturePanel, type CaptureUi } from './ui/CapturePanel';
import { RunShare } from './ui/share/RunShare';
import { DragGhost, isInventoryDropZone, isSellDropZone } from './ui/DragGhost';
import { FloorLegend } from './ui/FloorLegend';
import { GameMenu } from './ui/GameMenu';
import { DailyMenu } from './ui/online/DailyMenu';
import { ShopPanel } from './ui/ShopPanel';
import { UiIcon } from './ui/UiIcon';
import { WorkshopBackdrop } from './ui/WorkshopBackdrop';

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

/** 床の効果量（文言に埋め込む） */
const floorAmounts = (params: FloorParams) => ({
  double: params.doubleMultiplier,
  add: params.addAmount,
  triple: params.tripleMultiplier,
});

/** 撮影モード（VITE_CAPTURE=1 のビルドだけ。ui/CapturePanel.tsx） */
const CAPTURE = import.meta.env.VITE_CAPTURE === '1';

/** デバッグ表示のボタンは開発中か ?debug を付けたときだけ出す（体験版・製品版のビルドでは出ない） */
const DEBUG_AVAILABLE = isDebugAvailable(import.meta.env.DEV, window.location.search);

export function App({ start, onTitle }: Props) {
  const { t, formatScore, formatCompact } = useI18n();
  const [state, dispatch] = useReducer(gameReducer, start, (initialStart) => {
    const initial = createInitialState();
    return initialStart
      ? createGameState(initialStart.run, initial.meta, initialStart.mode, initial.achievements)
      : createGameState(initial.run, initial.meta, undefined, initial.achievements);
  });
  const compact = useMediaQuery(`(max-width: ${LAYOUT.compactMaxWidthPx}px)`);
  const fit = useMediaQuery(LAYOUT.fitQuery);
  const short = useMediaQuery(LAYOUT.shortQuery);
  /** ショップ・手持ちをタブで切り替えるか（狭い画面・高さの低い画面） */
  const tabbed = compact || short;
  /** 狭い画面で表示中のタブ */
  const [tab, setTab] = useState<'shop' | 'inventory'>('shop');
  const [speed, setSpeed] = useState<PlaybackSpeed>(1);
  /** 再生中の出荷量の途中経過 */
  const [liveScore, setLiveScore] = useState<string | null>(null);
  /** デバッグ表示の開閉 */
  const [debugOpen, setDebugOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  /** 撮影モードの UI の表示 */
  const [captureUi, setCaptureUi] = useState<CaptureUi>('full');
  const [capturePeakFirst, setCapturePeakFirst] = useState(false);
  /** 撮影モード: 共有カードの確認 */
  const [sharePreview, setSharePreview] = useState(false);
  /** デイリーのメニュー（開いていなければ null） */
  const [dailyMenu, setDailyMenu] = useState<'menu' | 'ranking' | null>(null);

  const { settings, updateSettings } = useSettings();
  const { run, selection, playback, error, mode } = state;
  const previousShift = useRef(run.shiftIndex);
  const playing = playback !== null || state.awaitingServer;

  // 初回ガイド（ガイド用のランの1シフト目。進み方は state/tutorial.ts）。ランを始め直したら最初から
  const [tutorial, setTutorial] = useState<TutorialState>(() => startTutorial(run));
  const tutorialOn =
    mode.kind === 'normal' &&
    !settings.tutorialDone &&
    isTutorialRun(run) &&
    tutorial.step !== 'done' &&
    (run.phase === 'building' || playing);
  const lastTrialScore = state.lastResult ? scoreToString(state.lastResult.score) : null;
  // ゲームの状態に合わせてガイドを進める（描画中に前回の値と比べて更新する。進まなければ同じオブジェクトが返る）
  if (tutorialOn) {
    const next = updateTutorial(tutorial, {
      run,
      lastTrialScore: state.lastResult?.score ?? null,
      playing,
    });
    if (next !== tutorial) setTutorial(next);
  }
  /** ガイドを終える（最後まで進めた・閉じた）。次のランからは出さない */
  const endTutorial = () => {
    setTutorial((current) => ({ ...current, step: 'done' }));
    updateSettings({ tutorialDone: true });
  };
  const guideStep = tutorialOn ? tutorial.step : null;
  // タブ表示では、ガイドの手順が変わったら、その手順で使う一覧（ショップ・手持ち）を開く
  const [tabGuideStep, setTabGuideStep] = useState(guideStep);
  if (guideStep !== tabGuideStep) {
    setTabGuideStep(guideStep);
    if (guideStep === 'buyGear') setTab('shop');
    else if (guideStep && tutorialPart(guideStep)) setTab('inventory');
  }

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

  // 操作卓の奥で鳴る工場音。朝・昼・夜と、夜のトラブル発生中で音色を変える。
  const { period: ambiencePeriod } = getDayAndPeriod(run);
  const bossActive = findBossToShow(run)?.isNow ?? false;
  useEffect(() => {
    audio.playAmbience(ambiencePeriod, bossActive);
    return () => audio.playAmbience(null, false);
  }, [ambiencePeriod, bossActive]);

  // シフトが進んだときだけ構内チャイムを鳴らす。初回表示では鳴らさない。
  useEffect(() => {
    if (previousShift.current === run.shiftIndex) return;
    previousShift.current = run.shiftIndex;
    audio.play(bossActive ? 'bossAlert' : 'shiftStart');
  }, [run.shiftIndex, bossActive]);

  // 新しい解放があれば結果画面で鳴らす
  const showingUnlocks = !playing && run.phase !== 'building' && state.unlocks.length > 0;
  useEffect(() => {
    if (showingUnlocks) audio.play('unlock');
  }, [showingUnlocks]);

  // 盤面に渡す表示状態（選択中のマス・配置しようとしているパーツ）
  const boardView = useMemo<BoardViewState>(
    () => ({
      board: run.board,
      rules: getCurrentRules(run),
      floor: getCurrentFloor(run),
      // 夜シフトの補修工事で使えなくなるマスを、朝・昼のうちから予告表示する
      upcomingBlocked: (() => {
        const boss = findBossToShow(run);
        return boss && !boss.isNow ? boss.entry.blockedCells : [];
      })(),
      highlight: selection?.kind === 'cell' ? { x: selection.x, y: selection.y } : null,
      placing:
        selection?.kind === 'inventory' ? { partId: selection.partId, dir: selection.dir } : null,
      shiftKey: `${run.seed}:${run.shiftIndex}`,
      guideCell: guideStep ? tutorialCell(guideStep) : null,
    }),
    [run, selection, guideStep],
  );

  // 盤面に出す文言（言語が変わったら作り直す）
  const boardLabels = useMemo<BoardLabels>(
    () => ({
      getPartName: (partId) => t(`part.${partId}.name`),
      formatIncome: (amount) => t('playback.incomePop', { amount }),
      getBreakLabel: (reason) => t(`break.short.${reason}`),
      formatChain: (count) => t('playback.chainCounter', { count }),
      getCutInTitle: () => t('playback.cutIn'),
      getQuotaCrossLabel: () => t('playback.quotaCross'),
      getFloorShort: (tile, params) => t(`floor.${tile}.short`, floorAmounts(params)),
      getFloorDescription: (cell, params) =>
        t('floor.tooltip', {
          name: t(`floor.${cell.tile}.name`, floorAmounts(params)),
          desc: t(`floor.${cell.tile}.desc`, floorAmounts(params)),
          period:
            cell.source === 'bonus' || cell.source === 'event' || cell.source === 'item'
              ? t(`floor.period.${cell.source}`)
              : '',
        }),
      formatScore,
      formatCompact,
    }),
    [t, formatScore, formatCompact],
  );
  const effectSettings = useMemo(
    () => ({
      strength: settings.effects,
      shake: settings.shake,
      reduceFlashes: settings.reduceFlashes,
    }),
    [settings.effects, settings.shake, settings.reduceFlashes],
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

  // 置いたパーツのドラッグ: 盤面の空きマスへ落とすと移動、手持ちの一覧（またはタブ）へ落とすと手持ちに戻す、
  // 売却エリアへ落とすと売却
  const [dragging, setDragging] = useState<PartId | null>(null);
  const onCellDragStart = useCallback((_from: { x: number; y: number }, partId: PartId) => {
    setDragging(partId);
    // タブ表示では、落とし先の手持ちを見せる
    setTab('inventory');
  }, []);
  const onCellDragEnd = useCallback(
    (
      from: { x: number; y: number },
      target: { x: number; y: number } | null,
      client: { x: number; y: number },
    ) => {
      setDragging(null);
      if (target) {
        dispatch({ type: 'movePart', from, to: target });
        return;
      }
      const el = document.elementFromPoint(client.x, client.y);
      if (isInventoryDropZone(el)) {
        dispatch({ type: 'longPressCell', x: from.x, y: from.y });
      } else if (isSellDropZone(el)) {
        dispatch({ type: 'sellCell', x: from.x, y: from.y });
      }
    },
    [],
  );

  const startPlayback = (type: 'startTrial' | 'startCommit') => {
    setCommitConfirm(false);
    setLiveScore('0');
    dispatch({ type });
  };
  /** 本番の確認ダイアログ（押し間違い防止） */
  const [commitConfirm, setCommitConfirm] = useState(false);
  const closePlayback = () => {
    setLiveScore(null);
    dispatch({ type: 'closePlayback' });
  };

  // キーボード・コントローラーの操作（盤面のカーソル・一覧・試運転・本番）。ダイアログ中・ラン終了画面はメニューの操作
  const inputMode = useInputMode();
  const gameCursor = useGameControls({
    active:
      !settingsOpen &&
      !isEventPending(run) &&
      !commitConfirm &&
      dailyMenu === null &&
      (playing || run.phase === 'building'),
    width: run.board.width,
    height: run.board.height,
    playing,
    playbackFinished: playback?.finished ?? false,
    onPlace: onCellClick,
    onDeselect: () => dispatch({ type: 'deselect' }),
    onRotate: () => dispatch({ type: 'rotate' }),
    onTrial: () => startPlayback('startTrial'),
    onCommit: () => setCommitConfirm(true),
    onClosePlayback: closePlayback,
    onShowPanel: setTab,
  });
  const cursor = useMemo(
    () => (inputMode === 'pointer' ? null : { x: gameCursor.x, y: gameCursor.y }),
    [inputMode, gameCursor.x, gameCursor.y],
  );
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
    const next = startNewNormalRun(state.meta);
    setTutorial(startTutorial(next));
    dispatch({ type: 'loadRun', run: next, mode });
  };
  const enterRun = (next: RunState, nextMode: PlayMode) => {
    setLiveScore(null);
    setTutorial(startTutorial(next));
    setDailyMenu(null);
    dispatch({ type: 'loadRun', run: next, mode: nextMode });
  };
  /** 通常モードに戻る（保存済みのランがあれば続きから） */
  const backToNormal = () =>
    enterRun(loadRun() ?? startNewNormalRun(state.meta), { kind: 'normal' });

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
          <UiIcon name="daily" />
          {t('online.dailyButton')}
        </button>
        {DEBUG_AVAILABLE && (
          <button className="button--ghost" onClick={() => setDebugOpen((v) => !v)}>
            <UiIcon name="debug" />
            {t('debug.toggle')}
          </button>
        )}
        <button className="button--ghost" onClick={() => setSettingsOpen(true)}>
          <UiIcon name="settings" />
          {t('settings.open')}
        </button>
        {/* 操作方法・諦める（押し間違えないよう、よく使うボタンから離してメニューの中に入れる） */}
        <GameMenu
          disabled={playing}
          canGiveUp={mode.kind !== 'daily' && run.phase === 'building'}
          onGiveUp={() => dispatch({ type: 'giveUp' })}
        />
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

  /** ドラッグ中のパーツを売却エリアへ落としたときの返金額（売れないパーツなら null） */
  const sellRefund =
    dragging && run.config.economy.prices[dragging] > 0 ? getRefund(run, dragging) : null;
  const shopPanel = (
    <ShopPanel
      rules={boardView.rules}
      economy={getCurrentEconomy(run)}
      offers={run.shop}
      budget={run.budget}
      rerollCost={getRerollCost(run)}
      trends={trends}
      disabled={playing}
      guidePartId={guideStep === 'buyGear' ? 'gear' : null}
      guideReroll={guideStep === 'buyGear' && gearAvailability(run) === 'reroll'}
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
      boardHasParts={run.board.cells.some((cell) => cell !== null)}
      guidePartId={guideStep && guideStep !== 'buyGear' ? tutorialPart(guideStep) : null}
      onSelect={(partId) => dispatch({ type: 'selectInventory', partId })}
      onReturnAll={() => dispatch({ type: 'returnAll' })}
      run={run}
      lastShiftOfDay={getDayAndPeriod(run).period === run.config.shiftsPerDay - 1}
      permitHasCell={drawFloorPermit(run) !== null}
      onUseItem={(itemId) => dispatch({ type: 'useItem', itemId })}
    />
  );
  const selectionPanel = (
    <SelectionPanel
      run={run}
      selection={selection}
      hideWhenEmpty={tabbed}
      disabled={playing}
      onRotate={() => dispatch({ type: 'rotate' })}
      onReturn={() => dispatch({ type: 'returnSelected' })}
      onSell={() => dispatch({ type: 'sellSelected' })}
    />
  );

  // シフトの情報・目的の案内（初回ガイド）・夜シフトの予告。
  // 横長の画面では盤面をできるだけ大きくするため、盤面の上ではなく右の列の先頭に置く
  const hud = <Hud run={run} liveScore={liveScore} trial={trialStatus(state.trials, run)} />;
  const notices = (
    <>
      {tutorialOn ? (
        <TutorialGuide
          tutorial={tutorial}
          run={run}
          lastTrialScore={lastTrialScore}
          onNext={() => {
            if (tutorial.step === 'finish') endTutorial();
            else setTutorial(advanceTutorial(tutorial, run));
          }}
          onSkip={endTutorial}
        />
      ) : (
        <RocketGoal run={run} />
      )}
      <DayEventNotice run={run} />
      <BossNotice run={run} />
    </>
  );
  const runInfo = (
    <>
      {hud}
      {notices}
    </>
  );

  // ラン終了（全シフト達成 or ノルマ未達）
  if (!playing && run.phase !== 'building') {
    return (
      <div className="app">
        {header}
        <WorkshopBackdrop run={run} meta={state.meta} playing={false} alert={bossActive} />
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
    <div
      className={`app ${compact ? 'app--compact' : ''} ${fit ? 'app--fit' : ''} ${short ? 'app--short' : ''} capture-ui--${captureUi} ${dragging ? 'is-dragging-part' : ''}`}
      style={{ '--board-max': `${LAYOUT.boardMaxPx}px` } as CSSProperties}
    >
      {dragging && <DragGhost partId={dragging} />}
      {/* .layout は盤面の大きさの基準（container-type）で固定配置の基準にもなるため、ダイアログはその外に置く */}
      {/* 2日目以降の朝: 今日の出来事を選ぶまでは組み立てられない */}
      {isEventPending(run) && !playing && run.phase === 'building' && (
        <DayEventDialog run={run} onChoose={(index) => dispatch({ type: 'chooseEvent', index })} />
      )}
      {commitConfirm && !playing && (
        <CommitConfirm
          onConfirm={() => startPlayback('startCommit')}
          onCancel={() => setCommitConfirm(false)}
        />
      )}
      {CAPTURE && (
        <CapturePanel
          board={run.board}
          ui={captureUi}
          speed={speed}
          onUiChange={setCaptureUi}
          onSpeedChange={setSpeed}
          floor={getCurrentFloor(run)}
          onLoadBoard={(board, floor) => dispatch({ type: 'captureLoadBoard', board, floor })}
          peakFirst={capturePeakFirst}
          onPeakFirstChange={setCapturePeakFirst}
          onCommit={(seed) => {
            setLiveScore(null);
            dispatch({ type: 'captureCommit', seed });
          }}
          onPreviewShare={() => setSharePreview(true)}
          onGivePermit={() => dispatch({ type: 'captureGivePermit' })}
        />
      )}
      {CAPTURE && sharePreview && (
        <div
          className="modal"
          role="dialog"
          aria-modal="true"
          onClick={() => setSharePreview(false)}
        >
          <div className="modal__body panel share-preview" onClick={(e) => e.stopPropagation()}>
            <RunShare run={run} />
            <button className="button--ghost" onClick={() => setSharePreview(false)} data-close>
              {t('catalog.close')}
            </button>
          </div>
        </div>
      )}
      {header}
      <WorkshopBackdrop run={run} meta={state.meta} playing={playing} alert={bossActive} />
      {!fit && runInfo}
      <main className="layout">
        <div className="layout__board">
          <PixiBoard
            view={boardView}
            labels={boardLabels}
            effectSettings={effectSettings}
            playbackResult={playback?.result ?? null}
            quota={getCurrentShift(run).quota}
            peakFirst={CAPTURE && capturePeakFirst}
            speed={speed}
            cursor={cursor}
            onCellClick={onCellClick}
            onCellLongPress={onCellLongPress}
            onCellDragStart={onCellDragStart}
            onCellDragEnd={onCellDragEnd}
            onShip={onShip}
            onPlaybackFinish={onPlaybackFinish}
          />
          {!playing && (
            <FloorLegend
              floor={boardView.floor}
              upcomingBlocked={boardView.upcomingBlocked}
              params={boardView.rules.floorParams}
            />
          )}
          {playback && <PlaybackPanel playback={playback} run={run} onClose={closePlayback} />}
          {error && <div className="toast">{t(`error.${error}`)}</div>}
          {state.awaitingServer && <div className="toast">{t('daily.committing')}</div>}
        </div>
        <aside className="layout__side">
          {/* 目標の計器は右の列の上に固定し（スクロールしても見える）、本番ボタンをそのすぐ下に置く */}
          {fit && <div className="layout__goal">{hud}</div>}
          <ControlsPanel
            playing={playing}
            compact={compact}
            inputMode={inputMode}
            speed={speed}
            onTrial={() => startPlayback('startTrial')}
            onCommit={() => setCommitConfirm(true)}
            onSpeedChange={setSpeed}
            guide={
              guideStep === 'trial' || guideStep === 'trialAgain'
                ? 'trial'
                : guideStep === 'commit'
                  ? 'commit'
                  : null
            }
          />
          {fit && <div className="layout__info">{notices}</div>}
          {/* タブ表示では選択中のパーツの操作をタブの上に出す（何も選んでいなければ出さない） */}
          {tabbed && selectionPanel}
          {tabbed && (
            <div className="tabs" role="tablist">
              {/* 手持ちを盤面に近い側（左）に置く（ドラッグで戻すときの距離を短くする） */}
              {(['inventory', 'shop'] as const).map((key) => (
                <button
                  key={key}
                  role="tab"
                  aria-selected={tab === key}
                  className={`tabs__tab ${tab === key ? 'is-active' : ''} ${
                    tab !== key &&
                    guideStep &&
                    (key === 'shop') === (guideStep === 'buyGear') &&
                    tutorialPart(guideStep)
                      ? 'is-guided'
                      : ''
                  }`}
                  data-drop={key === 'inventory' ? 'inventory' : undefined}
                  onClick={() => setTab(key)}
                >
                  {t(key === 'shop' ? 'shop.title' : 'inventory.title')}
                </button>
              ))}
            </div>
          )}
          {(!tabbed || tab === 'inventory') && inventoryPanel}
          {(!tabbed || tab === 'shop') && shopPanel}
          {debugOpen && <DebugPanel run={run} result={state.lastResult} />}
          {/* 何も選んでいないときは出さない（空の欄で場所をとらない） */}
          {!tabbed && selection && selectionPanel}
          {/* 売却エリア（盤面のパーツをドラッグして売る）。右の列の下端に固定し、スクロールしても見える */}
          <SellZone dragging={dragging !== null} refund={sellRefund} />
        </aside>
      </main>
    </div>
  );
}
