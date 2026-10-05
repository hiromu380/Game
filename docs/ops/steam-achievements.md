# 実績・統計の登録（人が行う作業）

実績30個と、回数系の統計3つを Steamworks に登録する。定義はコード（`packages/sim/src/achievements/definitions.ts`）が正で、
Steamworks にはその一覧を書き写す。**体験版の App ID には登録しない**（体験版では実績を無効にしている）。

## 1. 登録する一覧を用意する

```sh
pnpm --filter @chain-factory/desktop achievements:export          # → docs/ops/steam-achievements-list.md
node apps/client/build/achievements/generate.mjs                   # → apps/desktop/release/achievements/*.png
```

- `steam-achievements-list.md`: API 名・名前（日英）・説明（日英）・隠し・進捗の統計の表
- アイコン: `<API 名>.png`（解除済み）と `<API 名>_locked.png`（未解除）。256×256（要確認: Steamworks の指定サイズ。違う場合は generate.mjs の SIZE を変える）

## 2. 統計を先に登録する（進捗バーで使うため）

Steamworks の「統計と実績」→「統計」で3つ作る。

| API 名           | 型  | 既定値 | 最小 | 増加のみ | 表示名             |
| ---------------- | --- | ------ | ---- | -------- | ------------------ |
| STAT_RUNS        | INT | 0      | 0    | はい     | ラン回数           |
| STAT_FULL_CLEARS | INT | 0      | 0    | はい     | 全シフトクリア回数 |
| STAT_DAILY_DAYS  | INT | 0      | 0    | はい     | 週替わり参加日数   |

- 「クライアントから設定できる」（Set By: Client）にする（要確認: 項目名）。ゲームは `SetStatInt` → `StoreStats` で送る

## 3. 実績を登録する

`steam-achievements-list.md` の表の順に、1行ずつ作る。

- **API 名**は表のとおり（大文字・下線も同じ）。ゲームはこの名前で解除する
- 名前・説明は日本語と英語の両方を入れる（言語の切り替え欄）
- 「隠し」がはいの2つ（ACH_JUNKBOT_JACKPOT・ACH_ZERO）は、隠し実績にする
- 進捗の統計がある3つ（ACH_FULL_CLEAR_10・ACH_RUNS_10/50・ACH_DAILY_7）は、「進捗の統計」に表の統計と範囲（0〜上限）を設定する
- アイコンは解除済みと未解除の2枚を上げる
- 全部作ったら「公開」する（公開するまでゲームから解除できない。要確認）

## 4. 確認

steam-testing.md の「実績」の項目。解除は Steam のオーバーレイに通知が出る。やり直すときは Steamworks の管理画面か、
開発用のコマンドで自分の実績をリセットする（要確認）。

## 実績を追加・変更したとき

1. `packages/sim/src/achievements/definitions.ts` と i18n（`achievement.<ID>.name` / `.desc`）を直す
2. `apps/client/art/achievements.ts` にアイコンを足し、`pnpm --filter @chain-factory/client art`
3. 上の手順1〜3で Steamworks を更新する（API 名は一度公開したら変えない）
