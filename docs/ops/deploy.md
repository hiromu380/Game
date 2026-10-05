# 本番デプロイ手順（Cloudflare Workers + D1）

本番デプロイは**人が実行する**。本番の秘密値・API トークンはリポジトリにも開発環境（Claude の作業環境を含む）にも置かない。

> 注意: この手順は wrangler 4.142 の `--help` と、フェーズ3着手時に調べた Cloudflare の仕様をもとに書いている。
> 作業環境から Cloudflare の公式ドキュメントを直接確認できなかった箇所に「要確認」を付けた。初回のデプロイ前に公式ドキュメントで確かめること。

## 構成

- Worker 1つ（`apps/server`）が API（`/api/*`）と Web 版の静的ファイル（`apps/client/dist`）の両方を配信する
- D1: `chain-factory`（`apps/server/wrangler.jsonc` の `d1_databases`）
- Cron: 毎時（週の先行生成 → 公開前の検証 → 週の切り替え（相場の確定）→ 前週の結果の確定 → 保存期間を過ぎたデータの削除。すべて冪等。詳細は docs/ops/weekly.md）
- Rate Limiting バインディング: `RATE_LIMIT_READ` / `RATE_LIMIT_WRITE`
- CPU 上限: `limits.cpu_ms = 500`（`pnpm perf` の計測結果に余裕を持たせた値）

## 初回の準備

1. Cloudflare のアカウントで Workers Paid プランを有効にする
2. `npx wrangler login`（デプロイする人の端末で）
3. D1 を作る: `npx wrangler d1 create chain-factory`
   - 表示された `database_id` を `apps/server/wrangler.jsonc` に書く（ID は秘密値ではない）
4. Rate Limiting の `namespace_id`（`1001` / `1002`）がアカウント内で重複しないか確認する（要確認）
5. Turnstile のウィジェットを管理画面で作る
   - ホスト名に本番のドメインを登録する
   - **サイトキー**（公開値）→ クライアントのビルド時に `VITE_TURNSTILE_SITE_KEY`
   - **秘密キー** → `wrangler secret put TURNSTILE_SECRET_KEY`
6. Cloudflare Web Analytics でサイトを追加し、トークン（公開値）を `VITE_CF_ANALYTICS_TOKEN` に使う
7. マスター秘密鍵を作って登録する
   ```sh
   openssl rand -hex 32   # 出力をパスワードマネージャーにも保管する
   cd apps/server && npx wrangler secret put DAILY_MASTER_SECRET
   ```
   - 名前はデイリーの頃のまま（週替わりチャレンジの秘密値の元）
   - **この値をなくすと、過去の週の秘密値を公開（検証）できなくなる。** 変えると進行中の週の本番シードが変わるので、変更はしない
8. 本番の D1 にテーブルを作る: `cd apps/server && npx wrangler d1 migrations apply chain-factory --remote`
9. `apps/server/wrangler.jsonc` の `vars` を確認する
   - `WEEKLY_EPOCH`: 公開する週の始まりの日（週替わり #1 の週。`WEEK_START_DAY` の曜日の日付）
   - `CHALLENGE_OFFSET_MINUTES`: 日・週の切り替え時刻（UTC からのずれ・分。初期値 540 = 日本時間 0 時）
   - `WEEK_START_DAY`: 週の始まりの曜日（0 = 日曜 … 6 = 土曜。初期値 1 = 月曜）
   - `DEV_CLOCK` は**本番では設定しない**（開発用の時刻送り。設定しても localhost 以外からは使えない）
10. 公開の前に、最初の週の盤面を用意して検証しておく（`npx wrangler` で Cron を待つか、管理画面から Cron を手動実行する。検証が終わる前に週が開くと、その週は固定の代替設定になる: docs/ops/weekly.md）
11. Steam 版を出すとき（フェーズ4〜。手順の詳細は docs/ops/steam-setup.md）
    - Steamworks の管理画面でパブリッシャーキー（Web API キー）を発行し、`npx wrangler secret put STEAM_WEB_API_KEY`
    - `wrangler.jsonc` の `vars.STEAM_APP_IDS` に製品版と体験版の App ID をカンマ区切りで書く
    - `vars.STEAM_TICKET_IDENTITY` をデスクトップ版のビルド設定（`STEAM_TICKET_IDENTITY`）と同じ値にする
    - `vars.CORS_ORIGINS` にデスクトップ版のオリジン（`app://chain-factory`）が入っていることを確認する

## 毎回のデプロイ

```sh
pnpm install
pnpm test && pnpm typecheck && pnpm lint

# Web 体験版をビルドする（公開値だけを渡す）
VITE_SITE_URL=https://<本番のドメイン> \
VITE_TURNSTILE_SITE_KEY=<サイトキー> \
VITE_CF_ANALYTICS_TOKEN=<Web Analytics のトークン> \
pnpm --filter @chain-factory/client build:demo

# スキーマを変えたときだけ（先に D1 のバックアップを取る: docs/ops/d1-backup.md）
cd apps/server && npx wrangler d1 migrations apply chain-factory --remote

# デプロイ（API と静的ファイルをまとめて配信）
cd apps/server && npx wrangler deploy
```

### `SIM_VERSION` を上げたとき

シミュレーションの挙動を変えたデプロイは、**週の切り替えの直後（月曜の日本時間 0:10 過ぎ。前週の猶予 10 分が終わってから）** に行う。
週の条件は開いたときの `SIM_VERSION` で固定されるので、週の途中で変えると、その週の提出がすべて「バージョン違い」で拒否される。

- 先行生成済みでまだ開いていない週は、新しい `SIM_VERSION` で自動的に作り直して検証をやり直す
- 開いた週も、**まだ誰も本番を確定していなければ**自動で作り直す（開き直す）。誰かが確定済みなら作り直さず、
  サーバーのログに `weekly week has committed runs on an old sim` が出る。対応は docs/ops/weekly.md の「古い SIM_VERSION のまま開いた週」
- 前週の猶予の内（月曜 0:00〜0:10）に提出された挑戦は拒否される（猶予が終わってからデプロイすれば起きない）

## デプロイ後の確認（チェックリスト）

- [ ] `https://<ドメイン>/` でタイトルが出て、ゲームが始められる（スマホでも）
- [ ] レスポンスヘッダーに `Content-Security-Policy` などが付いている（`curl -sI https://<ドメイン>/`）（静的アセットの `_headers` 対応は要確認）
- [ ] `/api/weekly/current` が返る（`fallback` が `false` であること。`true` なら公開前の検証が間に合っていない）
- [ ] 古いクライアントの `/api/daily/today` が 410（`clientOutdated`）を返す
- [ ] 週替わりチャレンジに初めて参加すると Turnstile が表示される（**テスト用キーのままになっていないこと**。サーバーのログに `Cloudflare test key` の警告が出ていないこと）
- [ ] Cron が動いている（管理画面の Cron の実行履歴。`scheduled jobs` のログ）
- [ ] Web Analytics にアクセスが記録される
- [ ] （Steam 版）デスクトップ版で今週のチャレンジを開くと Steam で本人確認され、人間確認なしで参加できる。サーバーのログに `external sign-in failed` が出ていない

## ロールバック

- コード: `npx wrangler rollback`（直前のバージョンに戻す）。`wrangler deployments list` で履歴を確認できる
- DB: `docs/ops/d1-backup.md` の時点復元

## 秘密値の一覧

| 名前                       | 置き場所                                 | 備考                                                                       |
| -------------------------- | ---------------------------------------- | -------------------------------------------------------------------------- |
| `DAILY_MASTER_SECRET`      | Workers の Secrets                       | 週替わりの本番シードの元。なくすと過去分の公開・検証ができない             |
| `TURNSTILE_SECRET_KEY`     | Workers の Secrets                       | 人間確認の検証用                                                           |
| `STEAM_WEB_API_KEY`        | Workers の Secrets                       | Steam のパブリッシャーキー。**クライアント・リポジトリには絶対に置かない** |
| Cloudflare の API トークン | デプロイする人の端末（`wrangler login`） | リポジトリ・CI には置かない                                                |

公開値（`VITE_*`・`wrangler.jsonc` の `vars`・D1 の `database_id`）は秘密ではない。
