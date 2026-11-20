# グラフィック統合・検証記録

2026-10-30。対象は `hiromu380/Game` の `claude/phase1-work-klveiu`、開始コミットは `27fb0d89c802c967996871860ae81f0331ccfe1b`。push・リモート更新・PR作成は行っていない。

## 適用と修正

引き継ぎZIPのSHA-256は `8b52ec6f6186eeeb7cc8ad28fb5ea0db72567e92956a8c874e5cf0a38484f62a`。アップロードされたZIPと照合済み。

第1〜第5段階を順に `git apply --check` で確認した。第2段階のCSSと第4段階のBoutViewerは実コードと文脈が異なるため手動統合した。完成スナップショットの丸ごと上書きはしていない。

統合後に、大銀杏・袖と裾・個体差・墨線・下がり、対面する向き、実頂点による接地、立つ相手との貫通、画角、反りのある屋根を修正した。異なるインデックス形式の形状が結合時に消える不具合には回帰テストを加えた。

初回3Dロード中に演出が進む問題、読み込み失敗、StrictModeで解放済みCanvasを再利用する問題、未使用コンテキストの常駐、肖像の同期大量描画にも対処した。経営画面とタイトルを同じ紙・墨・朱・藍へ統一し、文字用の緑を濃くした。

`sim/`、`playback/boutScript.ts`、ルートの `CLAUDE.md` は開始コミットから変更していない。

## チェック結果

| チェック                                         | 結果                                               |
| ------------------------------------------------ | -------------------------------------------------- |
| pnpm install                                     | リポジトリ指定のpnpm 10.33.0で成功                 |
| 対象2プロジェクトのVitest                        | 15ファイル・82件成功（開始時51件）                 |
| TypeScript strict                                | 成功                                               |
| ESLint games/sumo                                | 成功                                               |
| Prettier games/sumo                              | 成功                                               |
| クライアント本番ビルド                           | 成功                                               |
| SVGギャラリーのSSR生成                           | 成功                                               |
| 新規開始・部屋・番付・帳簿・一門・場所結果・取組 | 390px / 1280pxで起動・撮影・目視確認               |
| 入金・支出・親方個人の帳簿                       | 1場所を実際に進めたデータで両幅を確認              |
| 長い名前・関取・横綱・けが・疲労・分家・英語     | 表示専用セーブによる両幅の確認                     |
| WebGLなし / コンテキスト喪失 / チャンク取得失敗  | SVGへ切り替わり、同じ取組結果まで進行              |
| モーション軽減                                   | 最終場面を静止表示                                 |
| WebP非対応                                       | PNG出力に差し替える検証で表示成功                  |
| 20回開閉・20回生成解放                           | コンテキストの累積なし。各解放後のGPUジオメトリは0 |

環境はLinux x86_64、Node.js 24.22.1、Chromium 153.0.8010.0、SwiftShaderによるWebGL。390pxはタッチ・DPR3、1280pxはDPR1.5のブラウザエミュレーション。実際のiPhone・Android・外部GPUの測定ではない。

初回のpnpm 11ではビルドスクリプト制御で失敗したため、指定版10.33.0で再実行した。0.0.0.0起動は環境のネットワークインターフェース取得が制限されたため、127.0.0.1で起動した。フォント生成には検証環境へBrotliを追加し、同梱の生成スクリプトを実行した。

## 容量と性能

初期JSは330.69KBから334.94KB（gzip 106.08KB）、フォントは170.58KBから171.44KB。3D共通チャンクは約523.40KB（gzip 133.28KB）、取組チャンク約8.25KB、肖像チャンク約1.64KB。Three.jsは動的インポートだが、タイトルに見える肖像が準備される際には取得する。

描画テストではスマホ約30fps、PC約30fps。上限は30/45fpsだが、速度保証ではない。1回の取組の短時間測定で、描画命令は69回、GPUジオメトリ52、トゥーン用テクスチャ1。CPUの描画命令発行時間とrAFのフレーム間隔、20回生成解放のヒープ値は、報告用スクリーンショット一式の `graphics/results.json` に実測値を残す。CPUの描画時間はGPU完了時間やフレーム全体の処理時間ではない。

## 再検証

リポジトリ直下で実行する。pnpmはpackageManagerに指定された10.33.0を使う。

```sh
pnpm install
pnpm vitest run --project ichimon-sim --project ichimon-client
pnpm exec tsc -p games/sumo/client/tsconfig.json --noEmit
pnpm exec eslint games/sumo
pnpm exec prettier --check games/sumo
pnpm --filter @ichimon/client build
pnpm dev:sumo --host 127.0.0.1
```

ブラウザ検証スクリプトはPlaywrightとChromiumが別途必要。`PLAYWRIGHT_MODULE` で外部にインストールしたPlaywrightのモジュール絶対パスも指定できる。`CHROMIUM_EXECUTABLE_PATH`、`CHROMIUM_ARGS_JSON`、`REVIEW_OUTPUT` は任意。指定しなければPlaywright既定のChromiumと `client/build/.review-output` を使う。

```sh
node games/sumo/client/build/verify-graphics.mjs
# 範囲を絞る場合
node games/sumo/client/build/verify-graphics.mjs screens graphics recovery edgecases
```

Viteの開発・本番プレビューを127.0.0.1:5175 / 5174で立ち上げ、終了時に閉じる。コンテキスト喪失を再現するので、必ず検証用ブラウザで実行する。通常画面は本番ビルド、造形の直接検証と測定は開発モジュールを使う。

## 対象外ファイルと依存ロック

対象を `games/sumo/` に限定する指示に従い、ルートの `pnpm-lock.yaml` は変更していない。Three.js追加で必要になるロック差分は `games/sumo/dependency-lock.patch` として保存し、`git apply --check` で確認済み。

新しい作業環境では通常の `pnpm install` がルートロックを再生成する。CIで `--frozen-lockfile` を使う前には、このロック差分をルートに適用・記録する必要がある。今回のローカルコミットにルート変更は含めていない。

## 残る確認範囲

- 実機のiOS Safari / Android Chrome、外部GPU、低性能端末での速度・長時間安定性は未確認。
- PCの45fpsは上限であり、このソフトウェア描画環境では到達していない。
- 3D共通チャンクは500KBを超えるためViteの警告が残る。初期エントリとは分離済み。
- 手足の接地は表示専用の補正であり、骨格IKや接触物理を導入したものではない。
- 効果音は既存の合成音のまま。今回、音の作り替えは行っていない。

確認した範囲で起動・進行を阻害する既知不具合はない。ただし実機検証・CI用ロック記録を含めた製品リリース判定は別途必要。
