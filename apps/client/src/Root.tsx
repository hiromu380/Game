/**
 * 画面の切り替え: タイトル（軽い・すぐ出る）⇄ ゲーム本体（PixiJS を含む。遅延読み込み）
 *
 * タイトルを出したらすぐ、裏でゲーム本体と最新の相場を読み込み始める。
 */
import { useEffect, useState } from 'react';
import type { GameStart } from './App';
import { loadGame, type GameModule } from './boot/loadGame';
import { useI18n } from './i18n';
import { loadMarket } from './online/market';
import { SettingsPanel } from './settings/SettingsPanel';
import type { MetaProgress } from '@chain-factory/sim';
import { recordRankingToSave } from './state/achievements';
import { findDemoSaveToImport } from './state/demoImport';
import { DemoImportDialog } from './ui/title/DemoImportDialog';
import { loadRun } from './state/saveStore';
import { DailyMenu } from './ui/online/DailyMenu';
import { TitleScreen } from './ui/title/TitleScreen';

/** ゲーム画面へ進む要求（start が null なら通常ラン = 保存済みの続き or 新規） */
type Request = { start: GameStart | null };

export function Root() {
  const { t } = useI18n();
  const [progress, setProgress] = useState(0);
  const [game, setGame] = useState<GameModule | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [request, setRequest] = useState<Request | null>(null);
  const [dailyOpen, setDailyOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  /** 引き継げる体験版のデータ（製品版の初回起動時だけ。答えたら null） */
  const [demoMeta, setDemoMeta] = useState<MetaProgress | null>(null);

  useEffect(() => {
    void findDemoSaveToImport().then(setDemoMeta);
  }, []);

  useEffect(() => {
    loadGame(setProgress)
      .then(setGame)
      .catch(() => setLoadFailed(true));
    // 通常ランの価格に使う相場（オフラインなら基準価格のまま）
    void loadMarket();
  }, []);

  // ゲーム本体が読み込めていて、ゲーム画面へ進む要求があればゲーム画面
  if (game && request) {
    const { App } = game;
    return <App start={request.start} onTitle={() => setRequest(null)} />;
  }

  return (
    <>
      <TitleScreen
        progress={game ? 1 : progress}
        waiting={request !== null}
        hasSavedRun={loadRun() !== null}
        onPlay={() => setRequest({ start: null })}
        onDaily={() => setDailyOpen(true)}
        onSettings={() => setSettingsOpen(true)}
      />
      {loadFailed && (
        <p className="title__error" role="alert">
          {t('title.loadFailed')}
        </p>
      )}
      {dailyOpen && (
        <DailyMenu
          onEnter={(run, mode) => {
            setDailyOpen(false);
            setRequest({ start: { run, mode } });
          }}
          onClose={() => setDailyOpen(false)}
          onRanked={recordRankingToSave}
        />
      )}
      {settingsOpen && <SettingsPanel onClose={() => setSettingsOpen(false)} />}
      {demoMeta && <DemoImportDialog meta={demoMeta} onDone={() => setDemoMeta(null)} />}
    </>
  );
}
