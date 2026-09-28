/**
 * キーボード・コントローラーの割り当て（操作の設定はこのファイルに集約する: CLAUDE.md「Steam 連携」）
 *
 * - キーは KeyboardEvent.key（小文字にして比べる）
 * - コントローラーは Gamepad API の標準配置（standard mapping）のボタン番号。
 *   Steam Deck・Xbox 系: 0=A 1=B 2=X 3=Y 4=LB 5=RB 8=Back 9=Start 12〜15=十字キー（上下左右）
 *   Steam Input が Deck の操作をこの配置で渡す（要確認: 実機）
 */

/** ゲームの操作（入力の種類によらない） */
export type ControlAction =
  | 'up'
  | 'down'
  | 'left'
  | 'right'
  /** 決定: 盤面では「置く・選ぶ」、メニューでは「押す」 */
  | 'confirm'
  /** 取り消し: 盤面では選択解除、メニューでは閉じる・戻る */
  | 'cancel'
  | 'rotate'
  | 'trial'
  | 'commit'
  /** ショップの一覧へ（L） */
  | 'shop'
  /** 手持ちの一覧へ（R） */
  | 'inventory';

export const KEY_BINDINGS: Record<ControlAction, readonly string[]> = {
  up: ['arrowup', 'w'],
  down: ['arrowdown', 's'],
  left: ['arrowleft', 'a'],
  right: ['arrowright', 'd'],
  confirm: ['enter', ' '],
  cancel: ['escape', 'backspace'],
  rotate: ['r'],
  trial: ['t'],
  commit: ['p'],
  shop: ['q'],
  inventory: ['e'],
};

export const GAMEPAD_BUTTONS: Record<ControlAction, readonly number[]> = {
  up: [12],
  down: [13],
  left: [14],
  right: [15],
  confirm: [0],
  cancel: [1],
  rotate: [2],
  trial: [3],
  commit: [9],
  shop: [4],
  inventory: [5],
};

export const GAMEPAD_CONFIG = {
  /** スティックをこの割合以上倒したら方向の入力にする */
  stickThreshold: 0.5,
  /** 方向の押しっぱなし: 最初のくり返しまで・以後の間隔（ミリ秒） */
  repeatDelayMs: 350,
  repeatIntervalMs: 110,
} as const;

/** 押しっぱなしでくり返す操作（方向だけ） */
export const REPEATABLE: readonly ControlAction[] = ['up', 'down', 'left', 'right'];
