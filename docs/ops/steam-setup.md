# Steamworks の初期設定（人が行う作業）

Steam で販売・体験版を出すための登録と、App ID・パブリッシャーキーの準備。
**要確認**: Steamworks の画面・料金・手続きは変わることがある。作業時に Steamworks のドキュメント（partner.steamgames.com/doc）で最新を確かめる。

## 1. Steamworks パートナー登録

1. partner.steamgames.com でアカウントを作り、パートナー契約（Steam 配信契約）に同意する
2. 登録料（Steam Direct の手数料。要確認: 現在は1タイトルあたり 100 USD で、売上が一定額を超えると返金される）を支払う
3. 税務情報（米国の源泉徴収の書類。日本在住なら租税条約の適用を申告）と、振込先の銀行口座を登録する
4. 本人確認が済むまで待つ（数日かかることがある）

## 2. App ID の取得

1. 製品版のアプリを作る → **製品版の App ID**
2. 体験版（Demo）を製品版にひもづけて作る → **体験版の App ID**（Next Fest に出すのはこちら）
3. それぞれに Windows 用の Depot が作られる → **Depot ID**（SteamPipe のアップロードで使う: steam-build.md）

控えておく値（どれも秘密値ではない）:

| 値                 | 使う場所                                                                                              |
| ------------------ | ----------------------------------------------------------------------------------------------------- |
| 製品版の App ID    | デスクトップ版のビルド `STEAM_APP_ID_FULL`・サーバーの `STEAM_APP_IDS`・SteamPipe `STEAM_APP_ID_FULL` |
| 体験版の App ID    | デスクトップ版のビルド `STEAM_APP_ID_DEMO`・サーバーの `STEAM_APP_IDS`・SteamPipe `STEAM_APP_ID_DEMO` |
| 各 Depot ID        | SteamPipe `STEAM_DEPOT_ID_FULL` / `STEAM_DEPOT_ID_DEMO`                                               |
| ストアページの URL | Web 体験版 `VITE_STORE_URL`・デスクトップ版 `STORE_URL`（ストアページの公開後）                       |

## 3. パブリッシャーキー（Web API キー）

**秘密値。** サーバー（Workers の Secrets）にだけ置き、クライアント・リポジトリ・チャット・作業環境には置かない。

1. Steamworks の「ユーザーと権限」→「Web API キーの管理」でパブリッシャーキーを作る（要確認: メニュー名）
2. 登録する: `cd apps/server && npx wrangler secret put STEAM_WEB_API_KEY`
3. `apps/server/wrangler.jsonc` の `vars.STEAM_APP_IDS` に「製品版,体験版」の App ID を書いてデプロイする（deploy.md）
4. キーが漏れた疑いがあれば、Steamworks で作り直して登録し直す

サーバーはこのキーで `ISteamUserAuth/AuthenticateUserTicket` を呼び、デスクトップ版が送ったチケットを確かめる（CLAUDE.md「Steam 連携」）。

## 4. アプリの基本設定（Steamworks の「アプリの管理」）

- **インストールと起動**: 起動するファイル `Chain Factory.exe`（体験版は `Chain Factory Demo.exe`）、OS は Windows（64bit）
- **Steam クラウド**: steam-cloud.md
- **実績・統計**: steam-achievements.md
- **Steam Input**: 「ゲームパッドに対応（標準の配置）」を選ぶ（要確認: 項目名）。ゲームは Gamepad API の標準配置で読む（`apps/client/src/config/controls.ts`）
- **Steam Deck の互換性**: 審査の申請（steam-testing.md の確認が済んでから）
- **コンテンツに関するアンケート（AI 生成コンテンツ）**: docs/ops/ai-disclosure.md の文案
- **ストアページ・グラフィック**: store-assets.md
- **価格**: 1,000〜1,500円の想定（CLAUDE.md）。地域ごとの価格は Steam の推奨価格を参考にする
