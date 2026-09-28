/**
 * index.html にビルド時の設定を差し込む Vite プラグイン
 *
 * - OGP（シェアした URL を開いたときのカード）: 画像は絶対 URL が必要なので VITE_SITE_URL から作る
 * - Cloudflare Web Analytics: VITE_CF_ANALYTICS_TOKEN があるときだけ計測スクリプトを入れる
 *   （Cookie を使わない計測。開発時・トークン未設定時は何も入れない）
 * 値はすべて公開値（秘密値ではない）。
 */
import type { HtmlTagDescriptor, Plugin } from 'vite';

export function htmlMetaPlugin(env: Record<string, string>): Plugin {
  return {
    name: 'chain-factory-html-meta',
    transformIndexHtml() {
      const tags: HtmlTagDescriptor[] = [];
      const site = env.VITE_SITE_URL?.replace(/\/$/, '');
      if (site) {
        tags.push(
          { tag: 'meta', attrs: { property: 'og:url', content: `${site}/` }, injectTo: 'head' },
          {
            tag: 'meta',
            attrs: { property: 'og:image', content: `${site}/ogp.png` },
            injectTo: 'head',
          },
          {
            tag: 'meta',
            attrs: { name: 'twitter:image', content: `${site}/ogp.png` },
            injectTo: 'head',
          },
        );
      }
      const token = env.VITE_CF_ANALYTICS_TOKEN;
      if (token) {
        tags.push({
          tag: 'script',
          attrs: {
            defer: true,
            src: 'https://static.cloudflareinsights.com/beacon.min.js',
            'data-cf-beacon': JSON.stringify({ token }),
          },
          injectTo: 'body',
        });
      }
      return tags;
    },
  };
}
