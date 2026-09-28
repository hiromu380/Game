/**
 * セーブ・設定・身元のファイル保存（デスクトップ版）
 *
 * - キーごとに1つの JSON ファイル（中身は Web 版の localStorage の値と同じ文字列）
 * - Steam Auto-Cloud で同期するもの（cloud: true）は `<userData>/save/`、同期しないものは `<userData>/local/` に置く
 *   （Auto-Cloud の設定で save フォルダだけを対象にする: docs/ops/steam-cloud.md）
 * - 書き込みは一時ファイルに書いてから置き換える（書き込みの途中で終了しても元のファイルが壊れないように）
 */
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { STORAGE_ENTRIES, type StorageKey } from '@chain-factory/shared';

export class FileStore {
  constructor(private readonly userDataDir: string) {}

  private pathOf(key: StorageKey): string {
    const entry = STORAGE_ENTRIES[key];
    return join(this.userDataDir, entry.cloud ? 'save' : 'local', entry.file);
  }

  async readAll(): Promise<Partial<Record<StorageKey, string>>> {
    const result: Partial<Record<StorageKey, string>> = {};
    for (const key of Object.keys(STORAGE_ENTRIES) as StorageKey[]) {
      try {
        result[key] = await readFile(this.pathOf(key), 'utf8');
      } catch {
        // まだ保存していない（初回起動）か、読めない。どちらも「なし」として扱う
      }
    }
    return result;
  }

  /** 空文字列は削除（Web 版の removeItem に相当） */
  async write(key: StorageKey, value: string): Promise<void> {
    const path = this.pathOf(key);
    if (value === '') {
      await rm(path, { force: true });
      return;
    }
    await mkdir(join(path, '..'), { recursive: true });
    const temp = `${path}.tmp`;
    await writeFile(temp, value, 'utf8');
    // 同じフォルダ内の rename は置き換えが一度に起きる（途中の状態のファイルが残らない）
    await rename(temp, path);
  }
}
