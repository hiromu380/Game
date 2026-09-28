# Steam ストアの画像と撮影（人が行う作業の準備）

ストアページ・ライブラリの画像は、素材（`apps/client/src/assets`）から自動で作れるようにしてある。
**画像の大きさは Steamworks の指定に合わせる（要確認: 提出時に Steamworks の「グラフィックアセット」の最新の指定を確かめる）。**

## 1. カプセル画像など

```sh
node apps/client/build/store/generate.mjs     # → apps/desktop/release/store/（git 管理外）
```

| ファイル               | 大きさ    | 用途                                               |
| ---------------------- | --------- | -------------------------------------------------- |
| `header_capsule.png`   | 920×430   | ストアページの上部・検索結果など                   |
| `small_capsule.png`    | 462×174   | 一覧の小さい表示（ロゴが読めること）               |
| `main_capsule.png`     | 1232×706  | トップページの大きな枠                             |
| `vertical_capsule.png` | 748×896   | 縦長の枠（セールなど）                             |
| `library_capsule.png`  | 600×900   | ライブラリの一覧                                   |
| `library_hero.png`     | 3840×1240 | ライブラリの上部（ロゴなし。Steam がロゴを重ねる） |
| `library_logo.png`     | 1280×720  | ライブラリのロゴ（背景透過）                       |

配置は `apps/client/build/store/capsule.html` で変えられる。今は仮素材（生成AIで作った素材: ai-disclosure.md）なので、
本番イラストに差し替えたら作り直す。

## 2. スクリーンショット（1920×1080）

撮影モード（`VITE_CAPTURE=1` のビルド）で、見栄えの良い盤面と連鎖を再現して撮る。

```sh
pnpm --filter @chain-factory/client dev:capture             # 撮影モードで起動（http://localhost:5173）
# 別のターミナルで
node apps/client/build/store/generate.mjs --screenshots http://localhost:5173/
```

- 撮る盤面は `apps/client/build/store/screenshot-boards.json`（今は仮の盤面が4枚）
- 良い盤面を作るには: 撮影モードで遊ぶ → パネルの「盤面を書き出す」→ JSON を screenshot-boards.json に足す。
  `seed` を入れると本番を再生し、`waitMs` ミリ秒後に撮る（連鎖の途中・結果の画面を撮り分けられる）。`ui` は `full` / `minimal` / `none`
- 撮影モードのパネルは C キーで隠れる。手で撮るときは、パネルの UI の表示を「なし」にして盤面だけにできる

## 3. トレーラー・GIF

撮影モードの再生速度（0.25×・0.5×）でスローにして、画面録画ツールで撮る（OBS など。人の作業）。
1920×1080 で撮る場合は、ブラウザの表示サイズを 1280×720 にして 150% 表示にすると、Steam Deck と同じ配置で大きく写る。
