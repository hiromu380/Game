# Windows 向けのビルドと Steam へのアップロード（人が行う作業）

**本番のビルドとアップロードは人が Windows 機で行う。** 開発環境には Steamworks の SDK・アカウントの情報を置かない。

## 1. 準備（初回のみ）

- Windows 10/11（64bit）、Node.js 22 以上、pnpm（`corepack enable`）
- Steamworks SDK の redistributable を `apps/desktop/steamworks_sdk/redistributable_bin/` に置く（desktop.md §1）
- SteamCMD（Steamworks SDK の `tools/ContentBuilder/builder/steamcmd.exe`）
- Steam のアカウントに Steam Guard を設定し、アップロード権限のあるアカウントでログインできるようにする

## 2. ビルド

PowerShell で:

```powershell
pnpm install
$env:WIN_EDIT_EXECUTABLE = '1'          # exe にアイコン・バージョン情報を入れる（Windows 機だけ）
$env:STEAM_APP_ID_FULL = '<製品版の App ID>'
$env:STEAM_APP_ID_DEMO = '<体験版の App ID>'
$env:API_ORIGIN = 'https://<本番のドメイン>'
$env:STORE_URL = 'https://store.steampowered.com/app/<製品版の App ID>/'
$env:STEAM_RESTART = '1'                # Steam 以外から起動されたら Steam 経由で起動し直す
$env:STEAM_TICKET_IDENTITY = 'chain-factory-api'   # サーバーの設定と同じ値
pnpm --filter @chain-factory/desktop package        # 製品版 → apps/desktop/release/full/win-unpacked/
pnpm --filter @chain-factory/desktop package:demo   # 体験版 → apps/desktop/release/demo/win-unpacked/
```

- 出力のフォルダをそのまま起動して、タイトルが出て遊べることを確かめる（Steam を起動した状態で）
- `resources/app.asar.unpacked/steamworks_sdk/redistributable_bin/win64/steam_api64.dll` があることを確かめる

## 3. アップロード（SteamPipe）

```powershell
$env:STEAM_DEPOT_ID_FULL = '<製品版の Depot ID>'
pnpm --filter @chain-factory/desktop steampipe full --preview   # まず中身の確認だけ（アップロードしない）
<steamcmd.exe のパス> +login <アカウント名> +run_app_build "<リポジトリ>\apps\desktop\release\steampipe\app_build_<App ID>.vdf" +quit
```

- `--preview` を外して、もう一度 `steampipe full` → `run_app_build` で本番のアップロード
- 体験版は `demo`（`STEAM_APP_ID_DEMO` / `STEAM_DEPOT_ID_DEMO`）で同じ手順
- アップロードしたビルドは、Steamworks の「SteamPipe → ビルド」でブランチ（まずは非公開のテスト用ブランチ）に設定し、
  steam-testing.md の確認をしてから `default` ブランチに出す

## 4. 週替わりチャレンジとの兼ね合い（CLAUDE.md「実装ルール」）

- シミュレーションの挙動を変えた（`SIM_VERSION` を上げた）ビルドは、**週の切り替え直後（月曜 0:10 過ぎ。docs/ops/deploy.md）**に、サーバーと同時に出す
  （古いクライアントの週替わりの提出はサーバーが拒否する）
- それ以外の変更（見た目・文言など）はいつ出してもよい
