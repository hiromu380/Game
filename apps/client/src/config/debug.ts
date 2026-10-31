/**
 * デバッグ表示（ヘッダーの「デバッグ」ボタン）を出すか
 * 開発サーバー（import.meta.env.DEV）か、URL に ?debug を付けたときだけ。体験版・製品版のビルドでは出さない
 */
export function isDebugAvailable(dev: boolean, search: string): boolean {
  return dev || new URLSearchParams(search).has('debug');
}
