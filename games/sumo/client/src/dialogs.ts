/**
 * ダイアログの扱い（画面全体で1つ）: 開いたら中へフォーカスを移し、Tab は中だけを回り、
 * Esc は閉じるボタン（data-dismiss）を押す。開いている間は後ろの画面をスクロールさせない。閉じたら元の場所へ戻る。
 * ダイアログは .modal（中に .modal__box）。決めないと進めないダイアログには data-dismiss を付けない（Esc で閉じない）
 */
import { useEffect } from 'react';

const FOCUSABLE =
  'button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])';

/** いちばん上（最後に開いた）ダイアログ */
function topDialog(root: ParentNode = document): HTMLElement | null {
  const all = root.querySelectorAll<HTMLElement>('.modal');
  return all[all.length - 1] ?? null;
}

/** Tab で次に移る先（端で反対の端へ回す）。回さないときは null */
export function wrapFocus(
  items: readonly HTMLElement[],
  active: Element | null,
  backward: boolean,
): HTMLElement | null {
  if (items.length === 0) return null;
  const first = items[0]!;
  const last = items[items.length - 1]!;
  const i = active ? items.indexOf(active as HTMLElement) : -1;
  if (i === -1) return backward ? last : first;
  if (backward && i === 0) return last;
  if (!backward && i === items.length - 1) return first;
  return null;
}

export function useDialogs(): void {
  useEffect(() => {
    let open: HTMLElement | null = null;
    let restore: HTMLElement | null = null;
    const sync = () => {
      const m = topDialog();
      document.body.classList.toggle('has-modal', m !== null);
      if (m && m !== open) {
        if (!open) restore = document.activeElement as HTMLElement | null;
        open = m;
        const box = m.querySelector<HTMLElement>('.modal__box') ?? m;
        if (!box.contains(document.activeElement)) {
          box.tabIndex = -1;
          box.focus({ preventScroll: true });
        }
      } else if (!m && open) {
        open = null;
        if (restore?.isConnected) restore.focus({ preventScroll: true });
        restore = null;
      }
    };
    const observer = new MutationObserver(sync);
    observer.observe(document.body, { childList: true, subtree: true });
    const onKey = (e: KeyboardEvent) => {
      const m = topDialog();
      if (!m) return;
      if (e.key === 'Escape') {
        const close = m.querySelector<HTMLElement>('[data-dismiss]');
        if (close) {
          e.preventDefault();
          close.click();
        }
      } else if (e.key === 'Tab') {
        const items = [...m.querySelectorAll<HTMLElement>(FOCUSABLE)];
        const next = wrapFocus(items, document.activeElement, e.shiftKey);
        if (next) {
          e.preventDefault();
          next.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    sync();
    return () => {
      observer.disconnect();
      document.removeEventListener('keydown', onKey);
      document.body.classList.remove('has-modal');
    };
  }, []);
}
