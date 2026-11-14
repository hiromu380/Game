/**
 * ウィンドウの大きさ・位置・全画面の記憶（次に起動したとき同じ状態で開く）
 *
 * - `<userData>/local/window.json` に置く（端末ごとの値なので Steam Cloud では同期しない）
 * - 読めない・画面の外にあるときは既定（1280×800 の中央）に戻す（外付けモニターを外した後など）
 * - 全画面の記憶がなければ、Steam Deck（Proton が SteamDeck=1 を渡す）では全画面で始める
 *
 * 判断はここの純粋関数で行い、Electron への反映は window.ts で行う。
 */

export interface WindowState {
  width: number;
  height: number;
  /** 位置（なければ画面の中央） */
  x?: number;
  y?: number;
  maximized: boolean;
  fullscreen: boolean;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export const WINDOW_DEFAULTS = { width: 1280, height: 800, minWidth: 800, minHeight: 600 } as const;

const isInt = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v);

/** 保存した文字列を読む。形の合わない値は捨てる（壊れていれば null） */
export function parseWindowState(text: string | null): WindowState | null {
  if (!text) return null;
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return null;
  }
  if (typeof raw !== 'object' || raw === null) return null;
  const v = raw as Record<string, unknown>;
  if (!isInt(v.width) || !isInt(v.height)) return null;
  return {
    width: Math.max(WINDOW_DEFAULTS.minWidth, v.width),
    height: Math.max(WINDOW_DEFAULTS.minHeight, v.height),
    ...(isInt(v.x) && isInt(v.y) ? { x: v.x, y: v.y } : {}),
    maximized: v.maximized === true,
    fullscreen: v.fullscreen === true,
  };
}

/**
 * 画面の外に出ていれば位置を捨てる（中央に開く）。
 * ウィンドウの上の端（つかんで動かせる帯）がどれかの画面に一定以上入っていれば、そのまま使う
 */
export function keepOnScreen(state: WindowState, workAreas: Rect[]): WindowState {
  if (state.x === undefined || state.y === undefined) return state;
  const grip = { x: state.x, y: state.y, width: state.width, height: 40 };
  const visible = workAreas.some((a) => {
    const w = Math.min(grip.x + grip.width, a.x + a.width) - Math.max(grip.x, a.x);
    const h = Math.min(grip.y + grip.height, a.y + a.height) - Math.max(grip.y, a.y);
    return w >= 100 && h >= 20;
  });
  if (visible) return state;
  return {
    width: state.width,
    height: state.height,
    maximized: state.maximized,
    fullscreen: state.fullscreen,
  };
}

/** 起動時に全画面にするか（記憶があればそれ、なければ Steam Deck だけ全画面） */
export function startFullscreen(
  state: WindowState | null,
  env: Record<string, string | undefined>,
): boolean {
  return state ? state.fullscreen : env.SteamDeck === '1';
}

/** 全画面の切り替えキー（F11・Alt+Enter） */
export function isFullscreenToggle(input: { type: string; key: string; alt: boolean }): boolean {
  if (input.type !== 'keyDown') return false;
  return input.key === 'F11' || (input.alt && input.key === 'Enter');
}
