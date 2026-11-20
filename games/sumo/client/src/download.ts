/**
 * ブラウザでファイルを保存させる。
 * claude.ai の公開ページの中では、ページから直接は保存できないので、閲覧者の確認つきの保存（downloads）を使う
 */
type Downloads = { save: (r: { filename: string; data: Blob }) => Promise<unknown> };
type ClaudeHost = { use?: (name: string) => Promise<unknown> };

export async function downloadBlob(blob: Blob, fileName: string): Promise<void> {
  const host = (globalThis as { claude?: ClaudeHost }).claude;
  if (typeof host?.use === 'function') {
    const downloads = (await host.use('downloads').catch(() => null)) as Downloads | null;
    if (downloads) {
      // 閲覧者が断っても失敗ではない（何もしない）
      await downloads.save({ filename: fileName, data: blob }).catch(() => {});
      return;
    }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = fileName;
  // 文書に入れてから押さないと、ファイル名が付かないブラウザがある
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
}
