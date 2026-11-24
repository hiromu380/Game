/**
 * キーの割り当て（1か所に集める）。画面の中のボタンを押すのと同じ動きにする（ロジックを二重に持たない）
 * - main: 下の帯の主ボタン（あと◯週・本場所へ）。ボタンにフォーカスがあるときは、ブラウザ本来の Enter・Space に任せる
 * - prep: 場所前のコマンド・相手を上から順に（1〜9）
 * - back: 場所前の相手選び・確かめから戻る
 * 窓が開いているとき・文字を打っているときは使わない
 */
export const KEYS = {
  main: ['Enter', ' '],
  prep: ['1', '2', '3', '4', '5', '6', '7', '8', '9'],
  back: ['Backspace'],
} as const;

/** 押されたキーで押すボタン（なければ null）。document を読むだけで、状態は持たない */
export function keyTarget(e: KeyboardEvent, doc: Document): HTMLElement | null {
  if (e.ctrlKey || e.metaKey || e.altKey || e.isComposing) return null;
  if (doc.querySelector('.modal')) return null;
  const el = e.target as HTMLElement | null;
  const tag = el?.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el?.isContentEditable)
    return null;
  const focusedControl = el !== null && el !== doc.body && (tag === 'BUTTON' || tag === 'A');
  if ((KEYS.main as readonly string[]).includes(e.key)) {
    if (focusedControl) return null;
    return doc.querySelector<HTMLElement>('.actionbar .button--primary:not(:disabled)');
  }
  const n = (KEYS.prep as readonly string[]).indexOf(e.key);
  if (n >= 0) {
    const cmds = doc.querySelectorAll<HTMLElement>('#prep-panel .prep__cmd');
    return cmds[n] ?? null;
  }
  if ((KEYS.back as readonly string[]).includes(e.key))
    return doc.querySelector<HTMLElement>('#prep-panel [data-key="back"]');
  return null;
}
