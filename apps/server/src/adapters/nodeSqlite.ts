/**
 * Node の組み込み SQLite（node:sqlite）で Drizzle を動かすアダプター
 *
 * テストとジョブのローカル実行で使う（Workers には含めない: index.ts からは import しない）。
 * D1 と同じ SQLite なので、同じスキーマ・マイグレーション・リポジトリ実装がそのまま動く。
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { drizzle } from 'drizzle-orm/sqlite-proxy';
import * as schema from '../db/schema';
import type { AsyncSqliteDb } from '../repositories/drizzle';

const MIGRATIONS_DIR = join(import.meta.dirname, '../db/migrations');

/** SQLite ファイル（':memory:' ならメモリ上）を開いて Drizzle を返す */
export function openNodeSqlite(path = ':memory:'): { db: AsyncSqliteDb; raw: DatabaseSync } {
  const raw = new DatabaseSync(path);
  const db = drizzle(
    async (sql, params, method) => {
      const statement = raw.prepare(sql);
      if (method === 'run') {
        statement.run(...(params as never[]));
        return { rows: [] };
      }
      // sqlite-proxy は行を「値の配列」で受け取る（列の順番は SELECT の順。
      // オブジェクトで受けると JOIN で同じ列名が重なったときに潰れるため、配列で受け取る）
      statement.setReturnArrays(true);
      const rows = statement.all(...(params as never[])) as unknown as unknown[][];
      // 'get' で行がないときは undefined を返す（Drizzle がそれを「なし」として扱う）
      return { rows: method === 'get' ? (rows[0] as unknown[]) : rows };
    },
    { schema },
  );
  return { db: db as unknown as AsyncSqliteDb, raw };
}

/** マイグレーション SQL をファイル名順にすべて流す（テスト用の空 DB を作るとき） */
export function applyMigrations(raw: DatabaseSync): void {
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();
  for (const file of files) {
    for (const statement of readFileSync(join(MIGRATIONS_DIR, file), 'utf8').split(
      '--> statement-breakpoint',
    )) {
      if (statement.trim()) raw.exec(statement);
    }
  }
}
