# 本番デプロイ手順（Cloudflare Workers + D1）

本番デプロイは**人が実行する**。本番の秘密値・API トークンはリポジトリにも開発環境（Claude の作業環境を含む）にも置かない。

> 注意: この手順は wrangler 4.142 の `--help` と、フェーズ3着手時に調べた Cloudflare の仕様をもとに書いている。
> 作業環境から Cloudflare の公式ドキュメントを直接確認できなかった箇所に「要確認」を付けた。初回のデプロイ前に公式ドキュメントで確かめること。

## 構成

- Worker 1つ（`apps/server`）が API（`/api/*`）と Web 版の静的ファイル（`apps/client/dist`）の両方を配信する
- D1: `chain-factory`（`apps/server/wrangler.jsonc` の `d1_databases`）
- Cron: 毎時（相場 → デイリー生成 → IP ハッシュの削除。すべて冪等）
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
   - **この値をなくすと、過去のデイリーの秘密値を公開（検証）できなくなる。** 変えると進行中のデイリーの本番シードが変わるので、変更はしない
8. 本番の D1 にテーブルを作る: `cd apps/server && npx wrangler d1 migrations apply chain-factory --remote`
9. `apps/server/wrangler.jsonc` の `vars.DAILY_EPOCH` を公開日（デイリー #1 の日付）にする

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

シミュレーションの挙動を変えたデプロイは、**デイリーの切り替え直後（日本時間 0:00 過ぎ）** に行う。
その日のデイリーは、生成したときの `SIM_VERSION` で遊ばれるため、途中で変えると進行中のプレイヤーの提出が「バージョン違い」で拒否される。

## デプロイ後の確認（チェックリスト）

- [ ] `https://<ドメイン>/` でタイトルが出て、ゲームが始められる（スマホでも）
- [ ] レスポンスヘッダーに `Content-Security-Policy` などが付いている（`curl -sI https://<ドメイン>/`）（静的アセットの `_headers` 対応は要確認）
- [ ] `/api/daily/today` が返る
- [ ] デイリーに初めて参加すると Turnstile が表示される（**テスト用キーのままになっていないこと**。サーバーのログに `Cloudflare test key` の警告が出ていないこと）
- [ ] Cron が動いている（管理画面の Cron の実行履歴。`scheduled jobs` のログ）
- [ ] Web Analytics にアクセスが記録される

## ロールバック

- コード: `npx wrangler rollback`（直前のバージョンに戻す）。`wrangler deployments list` で履歴を確認できる
- DB: `docs/ops/d1-backup.md` の時点復元

## 秘密値の一覧

| 名前                       | 置き場所                                 | 備考                                                           |
| -------------------------- | ---------------------------------------- | -------------------------------------------------------------- |
| `DAILY_MASTER_SECRET`      | Workers の Secrets                       | デイリーの本番シードの元。なくすと過去分の公開・検証ができない |
| `TURNSTILE_SECRET_KEY`     | Workers の Secrets                       | 人間確認の検証用                                               |
| Cloudflare の API トークン | デプロイする人の端末（`wrangler login`） | リポジトリ・CI には置かない                                    |

公開値（`VITE_*`・`wrangler.jsonc` の `vars`・D1 の `database_id`）は秘密ではない。
