/**
 * ゲーム画面のキーボード・コントローラー操作（盤面のカーソルと、ショップ・手持ちの一覧）
 *
 * - 盤面: 方向でカーソルを動かす。決定 = 置く・選ぶ（マウスのクリックと同じ）、X = 回転、Back = 元に戻す、RT = 手持ちに戻す、B = 選択解除、
 *   Y = 試運転、Start = 本番
 * - L / R: ショップ・手持ちの一覧へ移る（タブ表示ならタブも切り替える）。一覧の中は上下で選び、決定で押す。
 *   手持ちのパーツを選んだら盤面へ戻る（そのまま置けるように）。B で盤面へ戻る
 * - 再生中: 決定で結果を閉じる（再生が終わっていれば）
 * active が false（ダイアログが開いている・ラン終了画面）のときは何もしない（メニューの操作に任せる）
 */
import { useEffect, useRef, useState } from 'react';
import type { ControlAction } from '../config/controls';
import { addControlHandler } from './controls';
import { focusables, nearestInDirection } from './menuNavigation';

type Panel = 'shop' | 'inventory';

export interface GameControlOptions {
  active: boolean;
  width: number;
  height: number;
  /** 再生中（または結果の表示中） */
  playing: boolean;
  /** 再生が終わって結果を表示している */
  playbackFinished: boolean;
  onPlace: (x: number, y: number) => void;
  onDeselect: () => void;
  onRotate: () => void;
  onUndo: () => void;
  /** 選んでいる盤面のパーツを手持ちに戻す */
  onReturn: () => void;
  onMerge: () => void;
  onTrial: () => void;
  onCommit: () => void;
  onClosePlayback: () => void;
  /** 一覧へ移るとき（タブ表示ならそのタブにする） */
  onShowPanel: (panel: Panel) => void;
}

const MOVES: Partial<Record<ControlAction, [number, number]>> = {
  up: [0, -1],
  down: [0, 1],
  left: [-1, 0],
  right: [1, 0],
};

function panelOf(el: Element | null): Panel | null {
  const panel = el?.closest('[data-panel]')?.getAttribute('data-panel');
  return panel === 'shop' || panel === 'inventory' ? panel : null;
}

/** 一覧の最初のボタンにフォーカスする（タブの切り替えで描き直されるのを待つ） */
function focusPanel(panel: Panel) {
  requestAnimationFrame(() => {
    const scope = document.querySelector(`[data-panel="${panel}"]`);
    if (!scope) return;
    const items = focusables(scope);
    (items.find((el) => el.classList.contains('item-button')) ?? items[0])?.focus();
  });
}

export function useGameControls(options: GameControlOptions): { x: number; y: number } {
  const [cursor, setCursor] = useState({ x: 0, y: 0 });
  // ハンドラーは1回だけ登録し、最新の状態は ref から読む
  const ref = useRef({ options, cursor });
  useEffect(() => {
    ref.current = { options, cursor };
  });

  useEffect(
    () =>
      addControlHandler((action) => {
        const { options: o, cursor: c } = ref.current;
        if (!o.active) return false;
        // ダイアログ（ショップの一覧・確認など）が開いていれば、ダイアログの操作（Esc で閉じる等）にまわす
        if (document.querySelector('.modal')) return false;

        if (o.playing) {
          if (action === 'confirm' && o.playbackFinished) {
            o.onClosePlayback();
            return true;
          }
          // 再生中の操作は受け付けない（メニュー側にも渡さない）
          return action !== 'cancel';
        }

        const active = document.activeElement;
        const panel = panelOf(active);
        if (panel && active instanceof HTMLElement) {
          const dir = MOVES[action];
          if (dir) {
            const scope = document.querySelector(`[data-panel="${panel}"]`)!;
            const next = nearestInDirection(
              active.getBoundingClientRect(),
              focusables(scope)
                .filter((el) => el !== active)
                .map((el) => ({ el, rect: el.getBoundingClientRect() })),
              dir,
            );
            next?.focus();
            return true;
          }
          if (action === 'confirm') {
            active.click();
            // 手持ちのパーツを選んだら盤面へ（続けて置けるように）
            if (panel === 'inventory') active.blur();
            return true;
          }
          if (action === 'cancel') {
            active.blur();
            return true;
          }
        }

        const move = MOVES[action];
        if (move) {
          setCursor({
            x: Math.min(o.width - 1, Math.max(0, c.x + move[0])),
            y: Math.min(o.height - 1, Math.max(0, c.y + move[1])),
          });
          return true;
        }
        switch (action) {
          case 'confirm':
            o.onPlace(c.x, c.y);
            return true;
          case 'cancel':
            o.onDeselect();
            return true;
          case 'rotate':
            o.onRotate();
            return true;
          case 'undo':
            o.onUndo();
            return true;
          case 'returnPart':
            o.onReturn();
            return true;
          case 'merge':
            o.onMerge();
            return true;
          case 'trial':
            o.onTrial();
            return true;
          case 'commit':
            o.onCommit();
            return true;
          case 'shop':
          case 'inventory':
            o.onShowPanel(action);
            focusPanel(action);
            return true;
        }
        return false;
      }),
    [],
  );

  // 盤面が小さくなった（別のランに移った）ときにカーソルをはみ出させない
  const x = Math.min(cursor.x, options.width - 1);
  const y = Math.min(cursor.y, options.height - 1);
  return { x, y };
}
