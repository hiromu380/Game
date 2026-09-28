# Steam クラウド（Auto-Cloud）の設定（人が行う作業）

セーブとユーザー設定を、同じ Steam アカウントの別の PC・Steam Deck と同期する。
ゲーム側は Steam の API を使わず、決まったフォルダにファイルを置くだけ（Auto-Cloud が同期する）。

## ゲームが保存する場所（apps/desktop/src/main/storage/fileStore.ts）

| ファイル                                      | 中身                         | 同期     |
| --------------------------------------------- | ---------------------------- | -------- |
| `%APPDATA%\Chain Factory\save\save.json`      | 進行中のラン・メタ進行・実績 | **する** |
| `%APPDATA%\Chain Factory\save\settings.json`  | 言語・音量・演出の設定       | **する** |
| `%APPDATA%\Chain Factory\local\identity.json` | オンラインの認証トークン     | しない   |

体験版はフォルダ名が `Chain Factory Demo`（製品版と混ざらないように別にしている）。

## Steamworks の設定（製品版・体験版それぞれ）

「Steam クラウド」の設定で次のようにする（要確認: 項目名・ルートの名前は Steamworks のドキュメントで確かめる）。

1. バイト数の上限: 1 MB、ファイル数の上限: 10（セーブは数十 KB）
2. Auto-Cloud のルート:
   - ルート: `WinAppDataRoaming`（= `%APPDATA%`）
   - サブディレクトリ: `Chain Factory/save`（体験版は `Chain Factory Demo/save`）
   - パターン: `*.json`
   - OS: Windows
3. Steam Deck（Proton）でも同じ場所に保存される（Proton が Windows の `%APPDATA%` を用意する）。
   追加のルートの対応付け（Root Overrides）は不要の見込み（要確認: 実機で同期できるか steam-testing.md で確かめる）

## 注意

- `local/identity.json`（認証トークン）は同期しない。別の端末では起動時に Steam で取り直す
- セーブの形式にはバージョンがある（`SAVE_VERSION`）。古い版のゲームで新しいセーブを開くと読み込まない（新規扱い）。
  アップデートは全員に同時に届くので、通常は問題にならない
