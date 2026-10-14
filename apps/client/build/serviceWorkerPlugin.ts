/**
 * Service Worker を生成する Vite プラグイン（PWA: 通常ランはオフラインで遊べる）
 *
 * ビルド結果のファイル名（ハッシュ入り）をすべて「事前キャッシュ」の一覧に入れて sw.js を出力する。
 * キャッシュ名に一覧のハッシュを含めるので、新しいビルドを配信すると古いキャッシュは自動で消える。
 *
 * - /api/ はキャッシュしない（週替わり・ランキング・相場は常に最新を取りに行く。オフライン時は失敗させる）
 * - ページ遷移はネット優先（新しい版があればそれを使う）、失敗したらキャッシュの index.html
 * - それ以外（JS・CSS・画像・フォント）はキャッシュ優先（ファイル名にハッシュが入っているので古くならない）
 * - フォントは文字の範囲ごとに数百ファイルに分かれているので事前キャッシュせず、使ったものだけを保存する
 */
import { createHash } from 'node:crypto';
import type { Plugin } from 'vite';

/** public/ に置いてあり、事前キャッシュに含めるファイル */
const PUBLIC_FILES = [
  './',
  './icon.svg',
  './icon-180.png',
  './icon-512.png',
  './manifest.webmanifest',
];

function serviceWorkerSource(cacheName: string, urls: string[]): string {
  return `// このファイルはビルド時に生成される（apps/client/build/serviceWorkerPlugin.ts）。直接編集しない
const CACHE = ${JSON.stringify(cacheName)};
const PRECACHE = ${JSON.stringify(urls)};

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/')) return;

  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(() => caches.match('./', { ignoreSearch: true })));
    return;
  }
  event.respondWith(
    caches.match(request).then(
      (cached) =>
        cached ??
        fetch(request).then((response) => {
          // 事前キャッシュしていないファイル（フォントなど）は、取得できたら保存してオフラインでも使えるようにする
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        }),
    ),
  );
});
`;
}

export function serviceWorkerPlugin(): Plugin {
  return {
    name: 'chain-factory-service-worker',
    apply: 'build',
    generateBundle(_options, bundle) {
      const built = Object.keys(bundle)
        .filter((file) => file !== 'index.html' && !file.endsWith('.map'))
        .filter((file) => !/\.(woff2?|ttf)$/.test(file))
        .map((file) => `./${file}`);
      const urls = [...PUBLIC_FILES, ...built].sort();
      const version = createHash('sha256').update(urls.join('\n')).digest('hex').slice(0, 12);
      this.emitFile({
        type: 'asset',
        fileName: 'sw.js',
        source: serviceWorkerSource(`chain-factory-${version}`, urls),
      });
    },
  };
}
