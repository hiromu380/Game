/**
 * キーボード・コントローラーの入力 → 操作（ControlAction）
 *
 * - キーボード: keydown を割り当て（config/controls.ts）で操作にする。文字入力欄・スライダーの操作中は奪わない
 * - コントローラー: Gamepad API を毎フレーム読み、押した瞬間だけ操作にする（方向は押しっぱなしでくり返す）
 * - 受け取り手（ハンドラー）は後から登録したものが優先。true を返したら処理済み。
 *   どのハンドラーも処理しなければ、メニューのフォーカス移動（menuNavigation.ts）にまわす
 * - 最後に使った入力の種類（マウス・タッチ / キー / コントローラー）を覚え、画面の案内や盤面のカーソルの表示に使う
 */
import {
  GAMEPAD_BUTTONS,
  GAMEPAD_CONFIG,
  KEY_BINDINGS,
  REPEATABLE,
  type ControlAction,
} from '../config/controls';
import { handleMenuAction } from './menuNavigation';

export type InputMode = 'pointer' | 'keys' | 'gamepad';
export type ControlHandler = (action: ControlAction) => boolean;

const handlers: ControlHandler[] = [];
const modeListeners = new Set<(mode: InputMode) => void>();
let mode: InputMode = 'pointer';

export function getInputMode(): InputMode {
  return mode;
}

export function onInputModeChange(listener: (mode: InputMode) => void): () => void {
  modeListeners.add(listener);
  return () => modeListeners.delete(listener);
}

function setMode(next: InputMode) {
  if (mode === next) return;
  mode = next;
  for (const l of modeListeners) l(next);
}

/** 操作の受け取り手を登録する。戻り値で解除する */
export function addControlHandler(handler: ControlHandler): () => void {
  handlers.push(handler);
  return () => {
    const i = handlers.lastIndexOf(handler);
    if (i >= 0) handlers.splice(i, 1);
  };
}

/** 操作を配る（テストからも呼ぶ） */
export function dispatchControl(action: ControlAction): boolean {
  for (let i = handlers.length - 1; i >= 0; i--) {
    if (handlers[i]!(action)) return true;
  }
  return handleMenuAction(action);
}

/** キーに割り当てた操作。なければ null */
export function actionOfKey(key: string): ControlAction | null {
  const k = key.toLowerCase();
  for (const [action, keys] of Object.entries(KEY_BINDINGS) as [ControlAction, string[]][]) {
    if (keys.includes(k)) return action;
  }
  return null;
}

/** 文字入力・スライダーなど、キーをそのまま使う要素にフォーカスがあるか */
function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable || target instanceof HTMLTextAreaElement) return true;
  return (
    target instanceof HTMLInputElement && target.type !== 'checkbox' && target.type !== 'button'
  );
}

function onKeyDown(e: KeyboardEvent) {
  if (e.ctrlKey || e.metaKey || e.altKey || isTyping(e.target)) return;
  const action = actionOfKey(e.key);
  if (!action) return;
  if (e.repeat && !REPEATABLE.includes(action)) return;
  setMode('keys');
  // フォーカスのあるボタンの Enter・スペースも、ここでまとめて押す（ブラウザの動作と二重に押さないよう止める）。
  // 一覧のボタンを押したあと盤面へ戻す、などの続きの処理を同じ場所で行うため
  if (dispatchControl(action)) e.preventDefault();
}

// ---- コントローラー ----

const held = new Map<ControlAction, number>();

function pressedActions(pad: Gamepad): Set<ControlAction> {
  const pressed = new Set<ControlAction>();
  for (const [action, buttons] of Object.entries(GAMEPAD_BUTTONS) as [ControlAction, number[]][]) {
    if (buttons.some((b) => pad.buttons[b]?.pressed)) pressed.add(action);
  }
  const [x = 0, y = 0] = pad.axes;
  const t = GAMEPAD_CONFIG.stickThreshold;
  if (y < -t) pressed.add('up');
  if (y > t) pressed.add('down');
  if (x < -t) pressed.add('left');
  if (x > t) pressed.add('right');
  return pressed;
}

function pollGamepads(now: number) {
  const pads = navigator.getGamepads?.() ?? [];
  const pressed = new Set<ControlAction>();
  for (const pad of pads) if (pad) for (const a of pressedActions(pad)) pressed.add(a);

  for (const action of pressed) {
    const since = held.get(action);
    if (since === undefined) {
      held.set(action, now);
      setMode('gamepad');
      dispatchControl(action);
    } else if (REPEATABLE.includes(action) && now - since >= GAMEPAD_CONFIG.repeatDelayMs) {
      // くり返し: 最初の待ち時間のあと一定間隔で送る
      held.set(action, now - GAMEPAD_CONFIG.repeatDelayMs + GAMEPAD_CONFIG.repeatIntervalMs);
      dispatchControl(action);
    }
  }
  for (const action of [...held.keys()]) if (!pressed.has(action)) held.delete(action);
  requestAnimationFrame(pollGamepads);
}

let installed = false;

/** 入力の受け付けを始める（main.tsx から1回だけ呼ぶ） */
export function installControls(): void {
  if (installed || typeof window === 'undefined') return;
  installed = true;
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('pointerdown', () => setMode('pointer'), { capture: true });
  window.addEventListener('mousemove', () => setMode('pointer'), { passive: true });
  if ('getGamepads' in navigator) requestAnimationFrame(pollGamepads);
}
