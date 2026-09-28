/**
 * メニューのフォーカス移動（コントローラー・キーボード）
 *
 * ゲーム画面の盤面の操作が受け取らなかった操作は、ここで「画面のボタンを順に選ぶ」操作にする。
 * - 対象: いちばん手前のダイアログ（.modal）があればその中、なければ画面全体のボタン・入力欄
 * - 上下左右: 画面上でその方向にある、いちばん近いボタンへフォーカスを移す（フォーカスがなければ最初のボタン）
 * - 決定: フォーカスのあるボタンを押す
 * - 取り消し: ダイアログの「閉じる」ボタン（data-close）を押す
 */
import type { ControlAction } from '../config/controls';

const FOCUSABLE =
  'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** 操作の範囲（いちばん手前のダイアログ、なければ画面全体） */
export function menuScope(doc: Document = document): ParentNode {
  const modals = doc.querySelectorAll('.modal');
  return modals.length ? modals[modals.length - 1]! : doc;
}

export function focusables(scope: ParentNode): HTMLElement[] {
  return [...scope.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => {
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  });
}

const DIRECTION: Partial<Record<ControlAction, [number, number]>> = {
  up: [0, -1],
  down: [0, 1],
  left: [-1, 0],
  right: [1, 0],
};

/**
 * from から見て (dx, dy) の方向にある、いちばん近い要素
 * 方向の軸の距離を優先し、横ずれは2倍の重みで足す（格子状に並んだボタンで自然に動くように）
 */
export function nearestInDirection(
  from: DOMRect,
  candidates: { el: HTMLElement; rect: DOMRect }[],
  [dx, dy]: [number, number],
): HTMLElement | null {
  const cx = from.left + from.width / 2;
  const cy = from.top + from.height / 2;
  let best: HTMLElement | null = null;
  let bestScore = Infinity;
  for (const { el, rect } of candidates) {
    const ex = rect.left + rect.width / 2 - cx;
    const ey = rect.top + rect.height / 2 - cy;
    const along = ex * dx + ey * dy;
    if (along <= 1) continue;
    const across = Math.abs(ex * dy) + Math.abs(ey * dx);
    const score = along + across * 2;
    if (score < bestScore) {
      bestScore = score;
      best = el;
    }
  }
  return best;
}

export function handleMenuAction(action: ControlAction, doc: Document = document): boolean {
  const scope = menuScope(doc);
  const items = focusables(scope);
  if (items.length === 0) return false;
  const active = doc.activeElement instanceof HTMLElement ? doc.activeElement : null;
  const current = active && items.includes(active) ? active : null;

  const dir = DIRECTION[action];
  if (dir) {
    if (!current) {
      items[0]!.focus();
      return true;
    }
    const next = nearestInDirection(
      current.getBoundingClientRect(),
      items.filter((el) => el !== current).map((el) => ({ el, rect: el.getBoundingClientRect() })),
      dir,
    );
    next?.focus();
    return true;
  }
  if (action === 'confirm') {
    if (!current) {
      items[0]!.focus();
      return true;
    }
    current.click();
    return true;
  }
  if (action === 'cancel') {
    const close = scope.querySelector<HTMLElement>('[data-close]');
    if (close) {
      close.click();
      return true;
    }
  }
  return false;
}
