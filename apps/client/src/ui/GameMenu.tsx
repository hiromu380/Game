/**
 * ゲームのメニュー（ヘッダーの右端）: 操作方法・諦める。盤面で何も選んでいないときの Esc でも開く
 *
 * 「諦める」は、よく使うボタン（週替わり・設定）と並べると押し間違えやすいので、メニューの中に入れ、
 * ゲーム内の確認（ブラウザ標準のダイアログは使わない）を挟む
 */
import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { useI18n } from '../i18n';

const HowToPlay = lazy(() => import('./title/HowToPlay'));

interface Props {
  disabled: boolean;
  /** 増えるたびにメニューを開き、最初の項目にフォーカスする（盤面で何も選んでいないときの Esc） */
  openSignal?: number;
  /** 諦められるか（通常ランの組み立て中だけ） */
  canGiveUp: boolean;
  onGiveUp: () => void;
}

export function GameMenu({ disabled, openSignal = 0, canGiveUp, onGiveUp }: Props) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [howTo, setHowTo] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // 外から開く合図（描画中に前回の合図と比べて開く。React の「前の props を覚える」書き方）
  const [seenSignal, setSeenSignal] = useState(openSignal);
  if (openSignal !== seenSignal) {
    setSeenSignal(openSignal);
    setOpen(true);
  }
  useEffect(() => {
    if (openSignal === 0) return;
    requestAnimationFrame(() =>
      menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus(),
    );
  }, [openSignal]);

  // メニューの外を押す・Esc で閉じる
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('pointerdown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className="game-menu" ref={menuRef}>
      <button
        className="button--ghost"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span aria-hidden>≡</span> {t('menu.open')}
      </button>
      {open && (
        <div className="game-menu__list" role="menu">
          <button
            role="menuitem"
            className="button--ghost"
            onClick={() => {
              setOpen(false);
              setHowTo(true);
            }}
          >
            {t('title.howTo')}
          </button>
          {canGiveUp && (
            <button
              role="menuitem"
              className="button--ghost game-menu__danger"
              disabled={disabled}
              onClick={() => {
                setOpen(false);
                setConfirming(true);
              }}
            >
              {t('giveUp.button')}
            </button>
          )}
        </div>
      )}
      {confirming && (
        <div className="modal" role="dialog" aria-modal="true" onClick={() => setConfirming(false)}>
          <div className="modal__body panel commit-confirm" onClick={(e) => e.stopPropagation()}>
            <h2 className="panel__title">{t('giveUp.title')}</h2>
            <p className="panel__hint">{t('giveUp.body')}</p>
            <div className="button-row">
              <button
                className="button--ghost"
                onClick={() => setConfirming(false)}
                autoFocus
                data-close
              >
                {t('giveUp.cancel')}
              </button>
              <button
                className="button--danger"
                onClick={() => {
                  setConfirming(false);
                  onGiveUp();
                }}
              >
                {t('giveUp.confirm')}
              </button>
            </div>
          </div>
        </div>
      )}
      {howTo && (
        <Suspense fallback={null}>
          <HowToPlay onClose={() => setHowTo(false)} />
        </Suspense>
      )}
    </div>
  );
}
