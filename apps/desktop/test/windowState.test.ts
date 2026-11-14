import { describe, expect, it } from 'vitest';
import {
  isFullscreenToggle,
  keepOnScreen,
  parseWindowState,
  startFullscreen,
} from '../src/main/windowState';

describe('ウィンドウの記憶', () => {
  it('保存した値を読む。壊れた・形の違う値は捨て、小さすぎる大きさは最小に直す', () => {
    expect(
      parseWindowState(
        '{"width":1600,"height":900,"x":10,"y":20,"maximized":true,"fullscreen":false}',
      ),
    ).toEqual({ width: 1600, height: 900, x: 10, y: 20, maximized: true, fullscreen: false });
    expect(parseWindowState('{broken')).toBeNull();
    expect(parseWindowState(null)).toBeNull();
    expect(parseWindowState('{"width":"big","height":900}')).toBeNull();
    expect(parseWindowState('{"width":100,"height":100}')).toEqual({
      width: 800,
      height: 600,
      maximized: false,
      fullscreen: false,
    });
  });

  it('画面の外（外したモニターの上）にあれば、位置を捨てて中央に開く', () => {
    const screen = [{ x: 0, y: 0, width: 1920, height: 1040 }];
    const inside = {
      width: 1280,
      height: 800,
      x: 100,
      y: 100,
      maximized: false,
      fullscreen: false,
    };
    expect(keepOnScreen(inside, screen)).toEqual(inside);
    const outside = { ...inside, x: 2500, y: 100 };
    expect(keepOnScreen(outside, screen)).toEqual({
      width: 1280,
      height: 800,
      maximized: false,
      fullscreen: false,
    });
  });

  it('全画面: 記憶があればそれ、なければ Steam Deck だけ全画面', () => {
    const state = { width: 1280, height: 800, maximized: false, fullscreen: false };
    expect(startFullscreen(null, { SteamDeck: '1' })).toBe(true);
    expect(startFullscreen(null, {})).toBe(false);
    expect(startFullscreen(state, { SteamDeck: '1' })).toBe(false);
    expect(startFullscreen({ ...state, fullscreen: true }, {})).toBe(true);
  });

  it('F11・Alt+Enter で全画面を切り替える（押したときだけ）', () => {
    expect(isFullscreenToggle({ type: 'keyDown', key: 'F11', alt: false })).toBe(true);
    expect(isFullscreenToggle({ type: 'keyDown', key: 'Enter', alt: true })).toBe(true);
    expect(isFullscreenToggle({ type: 'keyDown', key: 'Enter', alt: false })).toBe(false);
    expect(isFullscreenToggle({ type: 'keyUp', key: 'F11', alt: false })).toBe(false);
  });
});
