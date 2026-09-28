/**
 * electron-builder の設定（Windows x64。Steam で配布するのでインストーラーは作らず、フォルダのまま出力する）
 *
 * 使い方（apps/desktop で）:
 *   pnpm package        … 製品版
 *   pnpm package:demo   … 体験版
 * （scripts/build.mjs --package がこの関数で設定を作って electron-builder を呼ぶ。
 *   環境変数の書き方が Windows と Linux で違うので、版はコマンドの引数で渡す）
 *
 * - steamworks-ffi-node と koffi と Steamworks SDK の redistributable は ASAR に入れると動かないので外に出す
 * - Steamworks SDK（steamworks_sdk/redistributable_bin）は人が配置する（docs/ops/desktop.md §1）
 * - exe へのアイコン・バージョン情報の埋め込み（rcedit）は Windows 機でのみ行う。Linux から作るときは
 *   WIN_EDIT_EXECUTABLE を付けない（wine が要るため）
 */
const names = {
  full: { appId: 'com.chainfactory.game', productName: 'Chain Factory' },
  demo: { appId: 'com.chainfactory.demo', productName: 'Chain Factory Demo' },
};

/** @param {'full' | 'demo'} edition */
function builderConfig(edition) {
  return {
    appId: names[edition].appId,
    productName: names[edition].productName,
    directories: { output: `release/${edition}` },
    files: ['dist/**', 'renderer/**', 'package.json', 'steamworks_sdk/redistributable_bin/**'],
    asarUnpack: [
      'node_modules/steamworks-ffi-node/**',
      'node_modules/koffi/**',
      'node_modules/@koromix/**',
      'steamworks_sdk/redistributable_bin/**',
    ],
    win: {
      target: [{ target: 'dir', arch: ['x64'] }],
      signAndEditExecutable: process.env.WIN_EDIT_EXECUTABLE === '1',
    },
  };
}

module.exports = { builderConfig };
