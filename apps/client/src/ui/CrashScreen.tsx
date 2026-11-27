/**
 * 思わぬ不具合で画面が止まったときの表示（真っ白のままにしない）
 *
 * 文言・設定の仕組みそのものが壊れていても出せるよう、Provider の外に置き、言語は保存済みの設定から直接読む。
 * 進行中のランが原因で読み込み直しても止まる場合に備え、ランだけを片付けて読み込み直す道も用意する
 * （メタ進行・実績・見たカットシーンは残す）。
 */
import { Component, type ReactNode } from 'react';
import { translate } from '../i18n';
import { loadSettings } from '../settings/settingsStore';
import { saveGame } from '../state/saveStore';

interface State {
  crashed: boolean;
}

export class CrashBoundary extends Component<{ children: ReactNode }, State> {
  override state: State = { crashed: false };

  static getDerivedStateFromError(): State {
    return { crashed: true };
  }

  override componentDidCatch(error: unknown) {
    console.error(error);
  }

  override render() {
    if (!this.state.crashed) return this.props.children;
    const lang = loadSettings().lang;
    const t = (key: string) => translate(lang, key);
    return (
      <main className="crash" role="alert">
        <div className="panel crash__body">
          <h1 className="panel__title">{t('crash.title')}</h1>
          <p>{t('crash.body')}</p>
          <div className="button-row">
            <button className="button--primary" onClick={() => window.location.reload()}>
              {t('crash.reload')}
            </button>
            <button
              onClick={() => {
                saveGame({ run: null });
                window.location.reload();
              }}
            >
              {t('crash.discardRun')}
            </button>
          </div>
          <p className="panel__hint">{t('crash.discardHint')}</p>
        </div>
      </main>
    );
  }
}
