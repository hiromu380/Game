/**
 * オンラインの身元（匿名のプレイヤー ID とトークン）の保存
 *
 * セーブデータ・ユーザー設定とは別のキーに保存し、バージョンを持たせる。
 * トークンはこの端末だけのもの。消えると別人として扱われる（アカウント機能はフェーズ4以降で検討）。
 */
export const IDENTITY_VERSION = 1;
export const IDENTITY_STORAGE_KEY = 'chain-factory:online';

export interface OnlineIdentity {
  version: 1;
  playerId: string;
  token: string;
  /** 空なら既定の名前（i18n の online.defaultName）を表示する */
  displayName: string;
}

type SimpleStorage = Pick<Storage, 'getItem' | 'setItem'>;

function defaultStorage(): SimpleStorage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

export function loadIdentity(storage = defaultStorage()): OnlineIdentity | null {
  try {
    const raw = JSON.parse(storage?.getItem(IDENTITY_STORAGE_KEY) ?? 'null') as unknown;
    if (typeof raw !== 'object' || raw === null) return null;
    const v = raw as Partial<OnlineIdentity>;
    if (v.version !== 1 || typeof v.playerId !== 'string' || typeof v.token !== 'string') {
      return null;
    }
    return {
      version: 1,
      playerId: v.playerId,
      token: v.token,
      displayName: v.displayName ?? '',
    };
  } catch {
    return null;
  }
}

export function saveIdentity(identity: OnlineIdentity, storage = defaultStorage()): void {
  try {
    storage?.setItem(IDENTITY_STORAGE_KEY, JSON.stringify(identity));
  } catch {
    // 保存できなくても、この起動中はそのまま使える
  }
}
