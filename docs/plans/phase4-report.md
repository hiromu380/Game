# フェーズ4 完了報告（Steam 化）

計画: [phase4-plan.md](./phase4-plan.md)（承認済み）。4a〜4d をすべて実装した。
コミットは目的ごとに約35件（`b9041fc` の計画の承認から）。**GitHub への push はしていない**（指示待ち）。

- テスト: 39ファイル・374件すべて成功。型チェック・lint・整形もすべて通る
- 実機（この作業環境）で確かめたこと: Web 版（Chromium）、デスクトップ版（Electron 44・Linux・xvfb）の起動・通常ラン・保存・
  デイリーの画面（Steam なし）・キーボードとコントローラー（Gamepad API を差し替えて）の操作、Windows 向けのパッケージ作成

## 1. 段階ごとの成果

| 段階                          | 内容                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **4a デスクトップ基盤**       | 体験版の名前を `demo` に統一／保存先とプラットフォームの抽象化（Web は localStorage、デスクトップはメインプロセス経由の JSON ファイル・一時ファイル → 置き換え）／Electron 44（`app://` で配信・CSP・sandbox・型付き IPC とメインプロセスでの検証・外部リンクの許可リスト）／Steam アダプター（steamworks-ffi-node。Steam なしでも遊べる）／Windows 向けパッケージ（koffi の Windows 用バイナリも同梱）                                  |
| **4b Steam 連携**             | サーバーの `POST /api/auth/steam`（チケットの確認はアダプター層・**SteamID は秘密鍵付きハッシュだけを保存**・Steam 認証は Turnstile を省略）／デスクトップ版の本人確認と 401 の再認証／実績30個（判定は sim の純粋関数・セーブ v3・オフラインで解除した分の送り直し・デイリー系はサーバーで確定後に判定・体験版は無効）／回数系の統計3つ／Steamworks 登録用の一覧の書き出し／Steam Deck（1280×800 に収まるレイアウト・画面上キーボード） |
| **4c デザイン素材**           | スタイルガイド・パレットの一元化／ボルトの表情4種・アプリアイコン・OGP／パーツ20種（系統色）／盤面・ボス・UI アイコン／ロゴ・実績アイコン30個／素材のプレビューページ／生成AIの利用記録。素材はすべて生成スクリプト（`apps/client/art/`）から書き出し、ずれはテストで検出                                                                                                                                                                |
| **4d ストア・Next Fest 準備** | Steam 体験版（製品版の初回起動時の引き継ぎ・ストア誘導はオーバーレイ）／撮影モード（`VITE_CAPTURE=1`）／ストア画像（カプセル7種・スクリーンショット）の書き出し／バランス（慎重な評価・デイリーモード・調整案）／規約・プライバシーポリシーの追記と【未確定】一覧／フォントのサブセット化（約 90KB × 2）／SteamPipe のひな形／キーボード・コントローラー操作／人の作業の手順書一式                                                       |

## 2. 相談したいこと（ゲーム性に関わるため未採用）

1. **デイリーの難しさ**（docs/balance-log.md「フェーズ4d」）: 1シフト目で約3割が脱落する（通常ランの1シフト目は 100%）。
   調整案: **案 C**（ノルマ 5/20/60 → 3/12/40 と、特殊ルールから「出荷検査強化」を外す）で全クリア 36〜47% → 48〜60%。
   ほかに「1シフト目のショップに出荷口を必ず並べる」「特殊ルールを1シフト目にかけない」案（未検証）。
   採用する場合は `SIM_VERSION` を上げ、デイリーの切り替え直後にデプロイする
2. **ポンコツロボの倍率幅**: ×1〜×3 に狭めても、ボットのクリア率は変わらなかった（購入率 4%）。難しさの問題ではないので、
   実際に遊んだ手触りで決めたい（今は ×0.5〜×3 のまま）
3. **ゲームの名前**: ロゴは「CHAIN / FACTORY」で作った（名前が仮のため）。名前が決まったら差し替える

## 3. 人が行う作業（順番）

1. Steamworks の登録・App ID・パブリッシャーキー（[steam-setup.md](../ops/steam-setup.md)）
2. Steamworks SDK の配置と、App ID 480 での起動確認（[desktop.md](../ops/desktop.md)）
3. サーバーの設定（`STEAM_WEB_API_KEY` を Secrets に・`STEAM_APP_IDS`）とデプロイ（[deploy.md](../ops/deploy.md)。マイグレーション 0002 を適用）
4. 実績・統計の登録（[steam-achievements.md](../ops/steam-achievements.md)）と Steam クラウドの設定（[steam-cloud.md](../ops/steam-cloud.md)）
5. Windows 機でのビルドとアップロード（[steam-build.md](../ops/steam-build.md)）
6. 実機確認（[steam-testing.md](../ops/steam-testing.md)。Steam Deck を含む）
7. ストアページの画像・文章（[store-assets.md](../ops/store-assets.md)）、AI 生成コンテンツの回答（[ai-disclosure.md](../ops/ai-disclosure.md)）
8. 規約・プライバシーポリシーの【未確定】を決める（[legal/undecided.md](../legal/undecided.md)）

## 4. 要確認（外部仕様・実機が必要なもの。詳細は各手順書）

- Steam: `getAuthTicketForWebApi` の identity がサーバーと一致して通るか／`AuthenticateUserTicket` の応答の形とパブリッシャーキーのエンドポイント
- Steam: Electron のウィンドウにオーバーレイが描かれるか／Steam Deck での画面上キーボード／Steam Input の標準配置とゲームのボタン番号
- Steam: 実績アイコン・ストア画像の指定サイズ／Auto-Cloud のルートの名前・Proton での同期／AI 開示の設問の文言／Steamworks のメニュー名・料金
- Windows: 署名なしの exe が SmartScreen の警告なしで起動するか
- 確認済み: デスクトップ版から API への Origin は `app://chain-factory`（Electron 44）

## 5. セキュリティの確認

- 秘密値（`DAILY_MASTER_SECRET`・`TURNSTILE_SECRET_KEY`・`STEAM_WEB_API_KEY`）はリポジトリ・クライアントに含めていない（Workers の Secrets・`.dev.vars` は git 管理外）
- SteamID は保存しない（HMAC のみ）。Steam の表示名は使わない。IP は HMAC で保存し30日で削除（フェーズ3のまま）
- Electron: `contextIsolation`・`sandbox`・`nodeIntegration: false`、IPC は送り元（`app://chain-factory`）と引数を検証、
  実績は定義済みの ID だけ・体験版の読み出しは製品版だけ、外部リンクは許可リストのみ、ウィンドウ内の遷移と新しいウィンドウは禁止
- Steamworks SDK の redistributable はリポジトリに含めない（`.gitignore`）
- 撮影モードのパネルは通常のビルドに含まれない（ビルド結果で確認）

## 6. 次のフェーズへの申し送り

- デイリーの難しさの調整（§2）を決めてから Next Fest 用の体験版を出す
- 素材は仮（生成AI）。本番イラストに差し替えるときは docs/art-style.md と ai-disclosure.md の手順で
- プレイヤー ID・プレイ記録の保存期間を決めたら、削除の定期ジョブを追加する（legal/undecided.md）
- フェーズ5（世界連鎖）は未着手
