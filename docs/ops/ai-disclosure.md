# 生成AIで作ったコンテンツの記録

Steam のストアページ（Steamworks の「コンテンツに関するアンケート」の AI 生成コンテンツの項目）で開示するための記録。
素材を人の制作物に差し替えたら、その行の「状態」を「人の制作」に更新する（CLAUDE.md「実装ルール」）。

## 1. 一覧

「AI 生成」= 開発中に AI（コーディング支援の AI アシスタント）が作ったもの。**ゲームの実行中に AI で生成するものはない**。

| 区分                                                                   | ファイル                                                                        | 作り方                                                                                             | 状態                |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- | ------------------- |
| マスコット                                                             | `apps/client/src/assets/mascot/bolt-*.svg`（4種）                               | AI が描画コード（`apps/client/art/mascot.ts`）を書き、SVG を生成                                   | AI 生成             |
| アプリアイコン                                                         | `apps/client/public/icon.svg`・`icon-180.png`・`icon-512.png`                   | 同上（ボルトの待機の顔。PNG は SVG から変換）                                                      | AI 生成             |
| ボルトの全身（設定画・切り絵の部品・表情・ポーズ）                     | `apps/client/src/assets/characters/bolt/`・`docs/characters/`                   | AI が描画コード（`apps/client/art/characters/`）を書き、SVG と部品の関節データ（`rig.json`）を生成 | AI 生成             |
| 工場長（天井クレーン）・ロケットの設定画                               | `apps/client/src/assets/characters/chief/`・`apps/client/src/assets/rocket/`    | AI が描画コード（`apps/client/art/characters/chief.ts`・`art/rocket.ts`）を書き、SVG を生成        | AI 生成             |
| ナット（仮名・見知らぬロボ）の設定画                                   | `apps/client/src/assets/characters/nut/`・`docs/characters/`                    | AI が描画コード（`apps/client/art/characters/nut.ts`）を書き、SVG と部品の関節データを生成         | AI 生成             |
| ナットのロケット                                                       | `apps/client/src/assets/rocket/nut-rocket*.svg`                                 | AI が描画コード（`apps/client/art/characters/nutRocket.ts`）を書き、SVG を生成                     | AI 生成             |
| カットシーン（ストーリー演出）の背景・小物・絵コンテ・動き             | `apps/client/src/assets/story/`・`apps/client/src/story/scenes/`・`docs/story/` | AI が描画コード（`apps/client/art/story/`）と動きの表（シーンの定義）を書き、SVG を生成            | AI 生成             |
| ゲーム画面の上部の帯（窓の外の景色・組み立て台・警告灯）               | `apps/client/src/assets/backdrop/`                                              | AI が描画コード（`apps/client/art/backdrop.ts`）を書き、SVG を生成                                 | AI 生成             |
| キービジュアル・Steam のカプセル画像（ストアページの素材。開示の対象） | `apps/client/build/store/svg/`（書き出しは `apps/desktop/release/store/`）      | AI が描画コード（`apps/client/art/keyvisual/`）を書き、ゲーム内の素材を組み合わせて SVG を生成     | AI 生成             |
| パーツ                                                                 | `apps/client/src/assets/parts/*.svg`（20種）                                    | AI が描画コード（`art/parts.ts`）を書き、SVG を生成                                                | AI 生成             |
| 盤面                                                                   | `apps/client/src/assets/board/*.svg`（床・床タイル・枠・背景など10種）          | AI が描画コード（`art/board.ts`）                                                                  | AI 生成             |
| ボス・今日の出来事・UI アイコン                                        | `apps/client/src/assets/boss/*.svg`・`events/*.svg`・`ui/*.svg`                 | AI が描画コード（`art/icons.ts`）                                                                  | AI 生成             |
| ロゴ                                                                   | `apps/client/src/assets/logo/*.svg`                                             | AI が描画コード（`art/logo.ts`・文字も線で描いた独自の字形）                                       | AI 生成             |
| 実績アイコン                                                           | `apps/client/src/assets/achievements/*.svg`（30個）と PNG                       | AI が描画コード（`art/achievements.ts`）                                                           | AI 生成             |
| ロケット                                                               | `apps/client/src/assets/rocket/*.svg`（組み上がりの10段階と炎）                 | AI が描画コード（`art/rocket.ts`）                                                                 | AI 生成             |
| タイトルの背景                                                         | `apps/client/src/assets/title/*.svg`（工場のシルエット・歯車）                  | AI が描画コード（`art/title.ts`）                                                                  | AI 生成             |
| OGP 画像                                                               | `apps/client/public/ogp.png`                                                    | ロゴ・ボルトを HTML に並べて撮影（`build/ogp/`）                                                   | AI 生成             |
| 効果音                                                                 | `apps/client/src/audio/`（Web Audio API で合成）                                | AI が合成レシピ（コード）を書いた。録音・外部素材なし                                              | AI 生成             |
| 文言                                                                   | `apps/client/src/i18n/ja.json`・`en.json`                                       | AI が下書きし、開発者が確認・修正                                                                  | AI 生成（人が確認） |
| プログラム                                                             | リポジトリのソースコード                                                        | AI のコーディング支援を使って開発し、開発者が確認                                                  | AI 支援             |

- 画像生成 AI（テキストから画像を作るモデル）は使っていない。上記の絵はすべて、AI が書いた SVG の描画コード（図形の座標と色）から作った
- フォントは M PLUS Rounded 1c（SIL Open Font License。人の制作物）

## 2. Steamworks への回答の文案

要確認: Steamworks の設問の最新の文言（提出時に管理画面で確認し、合わせて調整する）。

**事前に生成したコンテンツ（Pre-Generated）の説明**

> 日本語: 本作のイラスト（マスコット、パーツ、盤面、アイコン、ロゴ、実績アイコン）と効果音は、開発中に AI コーディングアシスタントが作成したプログラム（SVG の描画コード・音の合成コード）から生成しています。画像生成 AI は使用していません。すべての素材は開発者が確認し、ゲームに合わせて調整しています。ゲーム内の文章も AI が下書きし、開発者が確認・修正しています。
>
> English: The game's artwork (mascot, parts, board, icons, logo, achievement icons, rocket, title background) and sound effects were generated from code (SVG drawing code and audio synthesis code) written with the help of an AI coding assistant during development. No text-to-image AI models were used. All assets were reviewed and adjusted by the developer. In-game text was drafted with AI assistance and reviewed/edited by the developer.

**ゲーム中に生成するコンテンツ（Live-Generated）**

> なし（ゲームの実行中に AI でコンテンツを生成することはない）

## 3. 差し替えたとき

- 人の制作物に差し替えた素材は、同じファイル名で置き換え、`apps/client/art/index.ts` からその項目を外す（生成スクリプトが上書きしないように）
- この一覧の「状態」を「人の制作」にし、制作者（クレジット表記の要否）を書き足す
- すべて差し替え終わったら、Steamworks の回答も更新する
