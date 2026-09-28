/**
 * 保存先の抽象化（セーブ・ユーザー設定・オンラインの身元）
 *
 * - Web 版: localStorage
 * - デスクトップ版: メインプロセスがユーザーデータフォルダの JSON ファイルに保存する（Steam Auto-Cloud で同期するため。
 *   Auto-Cloud はファイルを同期する仕組みなので、localStorage では同期されない）
 *
 * 呼び出し側（saveStore・settingsStore・identity）は同期的に読み書きしたいので、デスクトップ版は
 * 起動時にすべてを読み込んでメモリに持ち、書き込みだけを非同期でメインプロセスへ送る（initStorage を先に呼ぶこと）。
 * 画面側から見た形は Storage の一部（getItem / setItem / removeItem）にそろえてある。
 */
import { isStorageKey, type DesktopBridge } from '@chain-factory/shared';
import { getDesktopBridge } from '../platform/bridge';

export type SimpleStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

let current: SimpleStorage | null = null;

function browserStorage(): SimpleStorage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    // プライベートモードなどで使えない場合は保存しない（ゲームは遊べる）
    return null;
  }
}

/**
 * デスクトップ版の保存先。読み込み済みの値をメモリに持ち、書き込みはメインプロセスへ送る。
 * 許可されていないキーは読み書きしない（メインプロセス側でも拒否される）
 */
export function createDesktopStorage(
  bridge: Pick<DesktopBridge, 'write'>,
  initial: Partial<Record<string, string>>,
): SimpleStorage {
  const values = new Map(
    Object.entries(initial).filter((e): e is [string, string] => e[1] !== undefined),
  );
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      if (!isStorageKey(key)) return;
      values.set(key, value);
      // 書き込みの失敗はゲームを止めない（次の保存で上書きされる）
      bridge.write(key, value).catch(() => {});
    },
    removeItem: (key) => {
      if (!isStorageKey(key)) return;
      values.delete(key);
      bridge.write(key, '').catch(() => {});
    },
  };
}

/** 起動時に1回呼ぶ（デスクトップ版はファイルの読み込みを待つ） */
export async function initStorage(): Promise<void> {
  const bridge = getDesktopBridge();
  if (!bridge) {
    current = browserStorage();
    return;
  }
  try {
    current = createDesktopStorage(bridge, await bridge.readAll());
  } catch {
    // 読み込めなかった場合も起動はする（新しいセーブとして始まる）
    current = createDesktopStorage(bridge, {});
  }
}

/** 今の保存先（initStorage の前に呼ばれた場合は localStorage を使う: テストや Web 版の古い呼び出し順のため） */
export function appStorage(): SimpleStorage | null {
  return current ?? browserStorage();
}
