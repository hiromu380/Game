# D1 のバックアップと復元

守りたいデータ: プレイヤー（匿名 ID・表示名）、週替わりの週の設定（盤面の検証結果・確定した設定）・挑戦と成績・確定した結果発表、ショップの集計と相場の履歴。

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

- 復元中は Worker の書き込みが失敗しうる。可能なら週の途中の深夜など、プレイが少ない時間に行う（週の切り替えの前後は避ける）
- 復元後に `/api/weekly/current` と暫定ランキング・結果発表が見られること

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

公開前と、その後は定期的に、担当者がエクスポートから復元・読み取り確認までを通して実施する。
リモートの復元先は本番とは別の新しい D1 にし、確認が終わるまで本番の `database_id` は変更しない。
本番データを含む SQL はローカルにダウンロードせず、アクセス制限された作業端末・保管先を使う。

最低限、次を記録する:

- エクスポート日時と対象 DB
- 復元先 DB と復元完了日時
- SQL の取り込みが成功したこと
- 復元した DB に対して `/api/weekly/current` 相当の週の情報と、ランキング（暫定・結果発表）を読み取れたこと
- 本番 DB の接続先を変更していないこと

ローカルでは、機密情報を含まないテストデータで D1 のエクスポートとジョブ実行を確認できる:

```sh
cd apps/server
npx wrangler d1 export chain-factory --local --output .wrangler/local-backup.sql
pnpm job all --db .wrangler/local-restore.sqlite --at 2026-10-05T00:00:00Z
pnpm test
```

`pnpm job all` は指定した空の SQLite にマイグレーションを適用し、Cron と同じ順（週の先行生成 → 検証 → 週の切り替え → 結果の確定 → 削除）に実行する。
これらの一時ファイルは `.wrangler/`（git 管理外）に置く。これは定期ジョブのローカル確認であり、
`local-backup.sql` を復元する手順やリモート D1 の復元成功を代替しない。
実際のバックアップ SQL の取り込み確認は、上記の別 D1 への復元手順で行う。

## 4. 秘密値のバックアップ

`DAILY_MASTER_SECRET` は DB には入っていない（毎回導き出す）。なくすと過去の週の秘密値を公開・検証できなくなるので、
パスワードマネージャーなど、DB とは別の場所に保管する（docs/ops/deploy.md）。
