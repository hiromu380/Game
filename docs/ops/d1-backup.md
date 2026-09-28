# D1 のバックアップと復元

守りたいデータ: プレイヤー（匿名 ID・表示名）、デイリーの進行状況と結果（ランキング）、ショップの集計と相場の履歴。

> コマンドは wrangler 4.142 の `--help` で確認した。保持期間などの制限は変わりうるので、公式ドキュメントで確認すること（要確認）。

## 1. 時点復元（Time Travel）

D1 は過去の任意の時点へ戻せる（`--timestamp` は直近30日以内。wrangler の説明による）。
誤った操作・壊れたマイグレーションからの復旧に使う。

```sh
cd apps/server

# 戻したい時点のブックマークを確認する（RFC3339 か UNIX 秒）
npx wrangler d1 time-travel info chain-factory --timestamp 2026-10-05T14:50:00Z

# その時点に戻す（それ以降の書き込みは失われる。戻す前に下の「2. エクスポート」で今の状態を保存しておく）
npx wrangler d1 time-travel restore chain-factory --timestamp 2026-10-05T14:50:00Z
```

復元の前後で次を確認する:

- 復元中は Worker の書き込みが失敗しうる。可能ならデイリーの切り替え直後など、プレイが少ない時間に行う
- 復元後に `/api/daily/today` とランキングが見られること

## 2. 定期エクスポート（SQL ファイル）

時点復元の期間より古いデータを残すため、また別の場所に控えを持つために、定期的に SQL として書き出す。

```sh
cd apps/server
npx wrangler d1 export chain-factory --remote --output backups/chain-factory-$(date -u +%Y%m%d).sql
```

- 頻度の目安: 週1回、およびマイグレーションを流す直前
- 書き出したファイルには表示名・IP のハッシュが含まれる。**リポジトリには入れない**（`backups/` は git 管理外にするか、別の保管場所に置く）
- 保管期間はプライバシーポリシー（docs/legal/privacy.md）の記載と矛盾しないようにする

### エクスポートからの復元（新しい DB に入れて確認してから切り替える）

```sh
npx wrangler d1 create chain-factory-restore
npx wrangler d1 execute chain-factory-restore --remote --file backups/chain-factory-YYYYMMDD.sql
# 中身を確認したら、wrangler.jsonc の database_id を新しい DB に差し替えてデプロイする
```

## 3. 復元の練習

公開前に一度、エクスポート → 新しい DB への取り込み → ローカル（`--local`）での確認 を通しでやっておく。
ローカルの D1 でも同じ手順を試せる:

```sh
npx wrangler d1 export chain-factory --local --output /tmp/local.sql
```

## 4. 秘密値のバックアップ

`DAILY_MASTER_SECRET` は DB には入っていない（毎回導き出す）。なくすと過去のデイリーの秘密値を公開・検証できなくなるので、
パスワードマネージャーなど、DB とは別の場所に保管する（docs/ops/deploy.md）。
