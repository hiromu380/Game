# デスクトップ版（Electron）の開発・ビルド手順

このドキュメントの作業はすべて**人が行う**前提（Steamworks SDK の取得・Steam クライアントでの確認・本番ビルド）。
コードの構成は `apps/desktop/src/main/*` の先頭コメント、設計は CLAUDE.md「デスクトップ版」「Steam 連携」を参照。

## 1. Steamworks SDK の配置（初回のみ）

Steamworks SDK の redistributable（`steam_api64.dll` など）は Valve のライセンス上リポジトリに入れない（`.gitignore` 済み）。

1. Steamworks パートナーサイト（https://partner.steamgames.com/ → SDK）から最新の SDK をダウンロードする
2. 展開した `sdk/redistributable_bin` フォルダを、フォルダごと `apps/desktop/steamworks_sdk/` にコピーする

```
apps/desktop/steamworks_sdk/
└── redistributable_bin/
    ├── win64/steam_api64.dll      ← 製品で使うのはこれ（Windows x64）
    └── linux64/libsteam_api.so    ← Linux で開発起動するときだけ使う
```

- パッケージ時は `redistributable_bin` が `resources/app.asar.unpacked/steamworks_sdk/` にコピーされる
- SDK が無くてもビルド・起動はできる（Steam 連携が「unavailable」になり、オフラインの Web 版と同じ動作になる）

## 2. 開発中の起動

```bash
pnpm install
pnpm dev:server                          # 別ターミナル。デイリー・ランキングを試すとき
pnpm --filter @chain-factory/desktop start        # 製品版として起動
pnpm --filter @chain-factory/desktop start:demo   # 体験版として起動
```

- 既定の App ID は **480（Spacewar。Valve のテスト用）**。Steam クライアントにログインした状態で起動すると Steam 連携が有効になる
- 開発起動では「Steam 経由での起動し直し」をしない（パッケージした本番ビルドで `STEAM_RESTART=1` のときだけ）
- セーブの場所: Windows は `%APPDATA%\Chain Factory\`（体験版は `Chain Factory Demo`）
  - `save/save.json`・`save/settings.json` … Steam Cloud の対象（設定は4dの docs/ops/steam-cloud.md）
  - `local/identity.json` … オンラインの匿名ID。端末ごとに持つので Cloud に載せない

## 3. App ID 480 での疎通確認（Steam 連携の確認）

Steam クライアントにログインした Windows 機で行う。

| 確認               | 方法                                                                                                    | 期待                                                                                                     |
| ------------------ | ------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| 初期化             | 起動して DevTools なしで遊べること。Steam のフレンド欄に「Spacewar をプレイ中」と出る                   | 表示される                                                                                               |
| オーバーレイ       | Shift+Tab                                                                                               | Steam オーバーレイが開く                                                                                 |
| Web API チケット   | デイリーを開く（App ID 480 ではサーバーの確認までは通らない。自分の App ID とパブリッシャーキーが必要） | 480: 「Steam の認証サービスに接続できません」等のエラー表示まで。自分の App ID: 人間確認なしで参加できる |
| Steam 無しでの起動 | Steam を終了してから起動                                                                                | ゲームは普通に遊べる（コンソールに `[steam] unavailable`）                                               |

## 4. Windows 向けパッケージ

```bash
cd apps/desktop
pnpm package        # 製品版 → release/full/win-unpacked/
pnpm package:demo   # 体験版 → release/demo/win-unpacked/
```

- Steam で配布するのでインストーラーは作らず、フォルダのまま出力する（SteamPipe でそのままアップロード: 4d の steam-build.md）
- **本番ビルドは Windows 機で** 環境変数 `WIN_EDIT_EXECUTABLE=1` を付けて行う（exe へのアイコン・バージョン情報の埋め込み）。
  PowerShell なら `$env:WIN_EDIT_EXECUTABLE = '1'; pnpm package`。
  Linux/macOS からも作れるが、その場合は埋め込みを省略する（wine が要るため）
- ビルド時の環境変数（秘密値ではない。すべて省略可）

| 変数                    | 意味                                                | 既定                    |
| ----------------------- | --------------------------------------------------- | ----------------------- |
| `STEAM_APP_ID_FULL`     | 製品版の App ID                                     | 480                     |
| `STEAM_APP_ID_DEMO`     | 体験版の App ID                                     | 480                     |
| `API_ORIGIN`            | API サーバーのオリジン（CSP にも使う）              | `http://localhost:8787` |
| `STORE_URL`             | ストアページ（オーバーレイが使えないとき）          | App ID から生成         |
| `SITE_URL`              | 公式サイト（外部リンクの許可に加える）              | なし                    |
| `STEAM_RESTART`         | `1` で Steam 以外から起動されたら起動し直す         | なし（本番では `1`）    |
| `STEAM_TICKET_IDENTITY` | Web API チケットの identity（サーバーと一致させる） | `chain-factory-api`     |

- 依存のネイティブバイナリ（koffi の `@koromix/koffi-win32-x64`）は、`pnpm-workspace.yaml` の `supportedArchitectures` で
  開発機の OS に関係なく取得している。パッケージ後に次があることを確認する:
  - `resources/app.asar.unpacked/node_modules/@koromix/koffi-win32-x64/win32_x64/koffi.node`
  - `resources/app.asar.unpacked/node_modules/steamworks-ffi-node/prebuilds/win32-x64/`
  - `resources/app.asar.unpacked/steamworks_sdk/redistributable_bin/win64/steam_api64.dll`

## 5. 確認済み

- デスクトップ版から API への通信の `Origin` は `app://chain-factory`（Electron 44・Linux で、`CORS_ORIGINS` にこの値を入れて通信できることを確認）

## 6. 要確認（公式ドキュメント・実機で確認できていないこと）

- [ ] `getAuthTicketForWebApi` に渡す identity（`STEAM_TICKET_IDENTITY`）が、サーバー側の `ISteamUserAuth/AuthenticateUserTicket` の `identity` と一致すれば通ること（4b で実機確認）
- [ ] Windows 実機で、パッケージ版がコード署名なしで Steam から起動できること（SmartScreen の警告の有無）
- [ ] Steam Deck（Proton）での起動と、`isSteamRunningOnSteamDeck` の判定
- [ ] Steam オーバーレイが Electron のウィンドウに描画されること（Electron ではオーバーレイが出ないことがある。出ない場合の対処は4bで検討）
