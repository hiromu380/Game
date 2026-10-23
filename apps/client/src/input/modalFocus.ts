/**
 * ダイアログ（.modal）のフォーカス管理（キーボード・読み上げ）
 *
 * - 開いたら: ダイアログそのものにフォーカスを移す（読み上げがダイアログを伝える）。
 *   ボタンには当てない（開いた直後の Enter で、うっかり選択肢を押さないように。
 *   矢印・決定で最初のボタンへ進むのは menuNavigation.ts）
 * - Tab: いちばん手前のダイアログの中だけを巡回する（後ろの画面へ抜けない）
 * - 閉じたら: 開く前にフォーカスのあった要素へ戻す
 *
 * ダイアログの種類ごとに書かず、画面全体で1か所にまとめる（menuNavigation.ts と同じく「いちばん手前の .modal」が対象）
 */
import { focusables, menuScope } from './menuNavigation';

/** Tab（shift なら逆順）で次にフォーカスする要素。巡回するので端から反対の端へ戻る */
export function nextTabTarget<T>(items: T[], active: T | null, shift: boolean): T | null {
  if (items.length === 0) return null;
  const index = active === null ? -1 : items.indexOf(active);
  if (index < 0) return shift ? items[items.length - 1]! : items[0]!;
  const next = (index + (shift ? -1 : 1) + items.length) % items.length;
  return items[next]!;
}

interface Opened {
  modal: HTMLElement;
  opener: HTMLElement | null;
}

/** フォーカス管理を始める。戻り値で止める */
export function installModalFocus(doc: Document = document): () => void {
  const stack: Opened[] = [];
  // ダイアログの外で最後にフォーカスのあった要素（開いた瞬間に中のボタンが autoFocus で奪うダイアログでも、戻り先がわかるように）
  let lastOutside: HTMLElement | null = null;
  const onFocusIn = (e: FocusEvent) => {
    if (e.target instanceof HTMLElement && !e.target.closest('.modal')) lastOutside = e.target;
  };
  // フォーカスが外れて何もない所（盤面の操作など）へ移ったら、戻り先も「なし」にする
  // （盤面から開いたダイアログを閉じたとき、前に触った別のボタンへ戻らないように）
  const onFocusOut = (e: FocusEvent) => {
    if (
      e.relatedTarget === null &&
      e.target instanceof HTMLElement &&
      !e.target.closest('.modal')
    ) {
      lastOutside = null;
    }
  };

  const sync = () => {
    // 閉じたダイアログを外し、開く前の要素へ戻す
    while (stack.length && !stack[stack.length - 1]!.modal.isConnected) {
      const { opener } = stack.pop()!;
      if (opener?.isConnected) opener.focus({ preventScroll: true });
    }
    const top = menuScope(doc);
    if (!(top instanceof HTMLElement) || stack.some((o) => o.modal === top)) return;
    const active = doc.activeElement instanceof HTMLElement ? doc.activeElement : null;
    stack.push({ modal: top, opener: active && !top.contains(active) ? active : lastOutside });
    if (active && top.contains(active)) return;
    if (!top.hasAttribute('tabindex')) top.tabIndex = -1;
    top.focus({ preventScroll: true });
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key !== 'Tab') return;
    const scope = menuScope(doc);
    if (!(scope instanceof HTMLElement)) return;
    e.preventDefault();
    const active = doc.activeElement instanceof HTMLElement ? doc.activeElement : null;
    nextTabTarget(focusables(scope), active, e.shiftKey)?.focus();
  };

  const observer = new MutationObserver(sync);
  observer.observe(doc.body, { childList: true, subtree: true });
  doc.addEventListener('keydown', onKeyDown, true);
  doc.addEventListener('focusin', onFocusIn);
  doc.addEventListener('focusout', onFocusOut);
  sync();
  return () => {
    observer.disconnect();
    doc.removeEventListener('keydown', onKeyDown, true);
    doc.removeEventListener('focusin', onFocusIn);
    doc.removeEventListener('focusout', onFocusOut);
  };
}
