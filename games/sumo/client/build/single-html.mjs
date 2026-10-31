// mode "single" のビルド（dist-single）を、1つの HTML にまとめる: dist-single/ichimon.html
// script と stylesheet を中に書き込む。claude.ai のページとして載せるときは、文書の骨組み（html・head・body）を外す
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const dir = new URL('../dist-single/', import.meta.url).pathname;
const html = readFileSync(join(dir, 'index.html'), 'utf8');
const assets = join(dir, 'assets');
const files = readdirSync(assets);
const js = files.filter((f) => f.endsWith('.js'));
const css = files.filter((f) => f.endsWith('.css'));
if (js.length !== 1 || css.length > 1 || files.length !== js.length + css.length)
  throw new Error(`1つにまとまっていない: ${files.join(', ')}`);
// </script> が中に出てきたら書き換える（そのまま埋めると、そこでタグが閉じる）
const code = readFileSync(join(assets, js[0]), 'utf8').replaceAll('</script', '<\\/script');
const style = css.length ? readFileSync(join(assets, css[0]), 'utf8') : '';
const title = html.match(/<title>[^<]*<\/title>/)?.[0] ?? '<title>一門</title>';
const page = [
  title,
  '<meta name="description" content="相撲部屋の経営シミュレーション">',
  `<style>${style}</style>`,
  '<div id="root"></div>',
  `<script type="module">${code}</script>`,
  '',
].join('\n');
writeFileSync(join(dir, 'ichimon.html'), page);
console.log(`ichimon.html: ${(page.length / 1024 / 1024).toFixed(2)} MB`);
