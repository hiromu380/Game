/**
 * 最後に使った入力の種類（マウス・タッチ / キー / コントローラー）を React から読む
 */
import { useSyncExternalStore } from 'react';
import { getInputMode, onInputModeChange, type InputMode } from './controls';

export function useInputMode(): InputMode {
  return useSyncExternalStore(onInputModeChange, getInputMode, () => 'pointer');
}
