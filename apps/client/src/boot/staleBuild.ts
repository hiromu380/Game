/**
 * 古い版のまま開いているタブの立て直し（Web 版）
 *
 * 新しい版を公開すると、古い版のファイル（名前にハッシュの付いた分割ファイル）はサーバーから消える。
 * 古い版のタブが、まだ読んでいない画面（コレクション・カットシーンなど）を開こうとすると読み込みに失敗し、
 * 画面が真っ白になる。読み込みに失敗したら、ページを読み込み直して新しい版にする（ランは保存済みなので続きから遊べる）。
 * 続けて失敗する（オフラインなど）ときは読み込み直さない（くり返し再読み込みしないように）。
 */

const LAST_RELOAD_KEY = 'chain-factory:staleReloadAt';
/** この時間（ミリ秒）のうちに読み込み直したばかりなら、もう読み込み直さない */
const RELOAD_COOLDOWN_MS = 60_000;

/** 読み込み直してよいか（前回の読み込み直しの時刻から決める） */
export function shouldReload(now: number, lastReloadAt: number | null): boolean {
  return lastReloadAt === null || now - lastReloadAt >= RELOAD_COOLDOWN_MS;
}

export function installStaleBuildRecovery(): void {
  if (typeof window === 'undefined') return;
  window.addEventListener('vite:preloadError', (event) => {
    let last: number | null;
    try {
      const value = sessionStorage.getItem(LAST_RELOAD_KEY);
      last = value === null ? null : Number(value);
    } catch {
      // 使えなければ毎回判断できないので、読み込み直さない
      return;
    }
    if (!shouldReload(Date.now(), last)) return;
    try {
      sessionStorage.setItem(LAST_RELOAD_KEY, String(Date.now()));
    } catch {
      return;
    }
    event.preventDefault();
    window.location.reload();
  });
}
