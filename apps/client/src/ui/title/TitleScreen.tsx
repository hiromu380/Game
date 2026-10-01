/**
 * タイトル画面（最初に表示する軽い画面。ゲーム本体は裏で読み込む）
 *
 * - 通常ラン: 保存済みのランがあれば「続きから」
 * - デイリー: メニューを開く（デイリーのランはここからゲーム画面へ渡す）
 * - 遊び方・コレクション（実績・パーツ図鑑・解放の目標）
 * - 設定
 * ゲーム本体の読み込みが終わる前に押された場合は、進捗を見せながら待つ。
 */
import { EDITION } from '../../config/edition';
import { useI18n } from '../../i18n';
import { LOGO_ASSETS } from '../../assets/manifest';
import { TitleBackdrop } from './TitleBackdrop';
import type { MetaProgress } from '@chain-factory/sim';

interface Props {
  /** ゲーム本体の読み込み進捗（0〜1） */
  progress: number;
  /** 押されたが読み込み待ちの状態 */
  waiting: boolean;
  hasSavedRun: boolean;
  meta: MetaProgress | null;
  onPlay: () => void;
  onDaily: () => void;
  onCollection: () => void;
  onHowTo: () => void;
  onSettings: () => void;
}

export function TitleScreen({
  progress,
  waiting,
  hasSavedRun,
  meta,
  onPlay,
  onDaily,
  onCollection,
  onHowTo,
  onSettings,
}: Props) {
  const { t } = useI18n();
  const percent = Math.round(progress * 100);
  return (
    <main className="title">
      <TitleBackdrop meta={meta} />
      <img className="title__logo" src={LOGO_ASSETS.darkBackground} alt="Chain Factory" />
      <h1 className="title__name">{t('app.title')}</h1>
      {EDITION === 'demo' && <span className="mode-badge">{t('title.demoBadge')}</span>}
      <p className="title__tagline">{t('title.tagline')}</p>
      {meta && meta.records.runsPlayed > 0 && (
        <div className="title__factory-record">
          <span>{t('world.factoryId')}</span>
          <strong>
            {t('title.factoryRecord', {
              runs: meta.records.runsPlayed,
              clears: meta.records.clears,
            })}
          </strong>
        </div>
      )}

      <div className="title__actions">
        <button className="button--primary" disabled={waiting} onClick={onPlay}>
          {hasSavedRun ? t('title.continue') : t('title.play')}
        </button>
        <button onClick={onDaily}>{t('title.daily')}</button>
        <button className="button--ghost" onClick={onHowTo}>
          {t('title.howTo')}
        </button>
        <button className="button--ghost" onClick={onCollection}>
          {t('title.collection')}
        </button>
        <button className="button--ghost" onClick={onSettings}>
          {t('settings.open')}
        </button>
      </div>

      {/* 読み込みの進捗（終わったら消える） */}
      {progress < 1 && (
        <div
          className="title__loading"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent}
        >
          <div className="title__loading-bar" style={{ width: `${percent}%` }} />
          <span className="title__loading-label">{t('title.loading', { percent })}</span>
        </div>
      )}
    </main>
  );
}
