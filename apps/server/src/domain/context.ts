/**
 * ドメインの関数が受け取る依存一式
 *
 * DB・時計・設定をまとめて渡す。テストではメモリのリポジトリと固定の時計を渡せる。
 */
import type { KeyValueCache } from '../adapters/cache';
import type { AppConfig } from '../env';
import type { Repositories } from '../repositories/types';

export interface DomainContext {
  repos: Repositories;
  config: AppConfig;
  /** 現在時刻（UNIX ミリ秒）。開発用の時計が有効なら、進めた分を足した時刻 */
  now: () => number;
  /** 短い間だけ値を覚えておくキャッシュ（暫定ランキング） */
  cache: KeyValueCache;
}

/** ドメインのエラー（API のエラーコードにそのまま対応する） */
export class DomainError extends Error {
  constructor(
    readonly code:
      | 'badRequest'
      | 'unauthorized'
      | 'humanCheckFailed'
      | 'forbidden'
      | 'serviceUnavailable'
      | 'notFound'
      | 'challengeClosed'
      | 'alreadyPlayed'
      | 'notPublished'
      | 'tallying'
      | 'clientOutdated'
      | 'simVersionMismatch'
      | 'invalidSubmission'
      | 'invalidName',
    /** サーバーのログにだけ残す詳細（クライアントには返さない） */
    readonly detail?: string,
  ) {
    super(code);
  }
}
