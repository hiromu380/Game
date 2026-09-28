/**
 * app:// でゲームのページ（apps/client のビルド結果）を配信する
 *
 * file:// を使わない理由: ページごとに CSP を付けられ、オリジンが固定されるため（CLAUDE.md「デスクトップ版」）。
 * パスは配信フォルダの外に出られないようにする（../ などでの読み出しを防ぐ）。
 */
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, sep } from 'node:path';
import { APP_HOST } from './config';

const CONTENT_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.webmanifest': 'application/manifest+json',
};

/** URL → 配信フォルダ内のファイルのパス。フォルダの外を指していれば null */
export function resolveAppFile(rootDir: string, requestUrl: string): string | null {
  let url: URL;
  try {
    url = new URL(requestUrl);
  } catch {
    return null;
  }
  if (url.host !== APP_HOST) return null;
  const relative = decodeURIComponent(url.pathname).replace(/^\/+/, '') || 'index.html';
  const root = normalize(rootDir + sep);
  const file = normalize(join(root, relative));
  return file.startsWith(root) ? file : null;
}

/** プロトコルの処理本体（Electron の protocol.handle に渡す） */
export async function serveAppFile(
  rootDir: string,
  request: Request,
  csp: string,
): Promise<Response> {
  const file = resolveAppFile(rootDir, request.url);
  if (!file) return new Response('Not Found', { status: 404 });
  try {
    const body = await readFile(file);
    const headers: Record<string, string> = {
      'Content-Type': CONTENT_TYPES[extname(file)] ?? 'application/octet-stream',
      'X-Content-Type-Options': 'nosniff',
    };
    if (extname(file) === '.html') headers['Content-Security-Policy'] = csp;
    return new Response(body, { status: 200, headers });
  } catch {
    return new Response('Not Found', { status: 404 });
  }
}
