# Steam ストアの画像と撮影（人が行う作業の準備）

ストアページ・ライブラリの画像は、素材（`apps/client/src/assets`）から自動で作れるようにしてある。
**画像の大きさは Steamworks の指定に合わせる（要確認: 提出時に Steamworks の「グラフィックアセット」の最新の指定を確かめる）。**

## 1. カプセル画像など（キービジュアル）

キービジュアル（構図 A「押した瞬間」）から、サイズごとの専用構図を SVG で作り、PNG・JPG に書き出す。

```sh
pnpm --filter @chain-factory/client art          # SVG を作り直す（apps/client/build/store/svg/。絵を変えたときだけ）
node apps/client/build/store/generate.mjs        # → apps/desktop/release/store/（git 管理外）。大きさ・形式・容量を検証し、違反なら失敗
```

| ファイル               | 大きさ    | 形式 | 用途                                                         |
| ---------------------- | --------- | ---- | ------------------------------------------------------------ |
| `header_capsule.png`   | 920×430   | PNG  | ストアページの上部・おすすめ・ライブラリ（最も目に触れる）   |
| `small_capsule.png`    | 462×174   | PNG  | 一覧の小さい表示（120×45 まで縮めてもロゴが読めること）      |
| `main_capsule.png`     | 1232×706  | PNG  | トップページの大きな枠                                       |
| `vertical_capsule.png` | 748×896   | PNG  | 縦長の枠（セールなど）                                       |
| `library_capsule.png`  | 600×900   | PNG  | ライブラリの一覧                                             |
| `library_hero.jpg`     | 3840×1240 | JPG  | ライブラリの上部（文字・ロゴなし。重要な要素は中央 860×380） |
| `page_background.jpg`  | 1920×1080 | JPG  | ストアページの背景（控えめ。要確認: 使うかどうか・大きさ）   |
| `library_logo.png`     | 1280×720  | PNG  | ライブラリのロゴ（背景透過。要確認: 大きさ）                 |

- 規定（大きさ・形式・ロゴの有無・容量 2MB）は `apps/client/build/store/capsules.json` に集約してある（2026年9月時点）。
  **提出前に、Steamworks の「グラフィックアセット」の最新の指定を人が確かめ、違えば capsules.json を直してから作り直す**
- 構図を変えるときは `apps/client/art/keyvisual/capsules.ts`（層は `layers.ts`）。確認は `docs/art-preview.html`
  （Steam での表示の大きさ・明るい背景・白黒＋ぼかし・混雑した一覧・Library Hero の範囲）
- カプセル画像には、ロゴとゲームの絵だけを入れる（レビュー点数・受賞歴・「発売中」「○%オフ」などの文言は入れない: Steam の規定）

### Steamworks へのアップロード（人が行う作業）

1. 上のコマンドで書き出し、「検証: 合格」と出ることを確かめる
2. Steamworks の App 管理 →「ストアページの管理」→「グラフィックアセット」を開く（製品版と体験版の App ID それぞれ）
3. 各欄に、上の表のファイルをアップロードする（ライブラリの画像は「ライブラリアセット」の欄。Library Hero にロゴを重ねる位置も、ここで調整する）
4. プレビューで、ロゴ・ボルトが切れていないか確かめる（Steam は枠によって端を切ることがある）
5. ストアページの変更を「審査に提出」する（反映は Valve の確認のあと）
6. 素材は AI 生成なので、Steamworks の「コンテンツに関するアンケート」の AI 生成コンテンツの開示に、キービジュアル・カプセル画像を含める（ai-disclosure.md）

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
連鎖の山場を最初の2秒に入れる録画は、effects-capture.md（規模別の盤面・「ピークの直前から再生」）。
1920×1080 で撮る場合は、ブラウザの表示サイズを 1280×720 にして 150% 表示にすると、Steam Deck と同じ配置で大きく写る。
