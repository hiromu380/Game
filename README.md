# Chain Factory（仮）

工場フロアにパーツを置き、スイッチを1回押すだけで連鎖が走る「連鎖ビルダー × ノルマ上昇型ローグライク」。
設計書は [CLAUDE.md](./CLAUDE.md) を参照。現在は **フェーズ3: オンライン** を実装中（3a: デイリーチャレンジ・サーバー検証・ランキングまで）。

## 必要なもの

- Node.js 22.12 以上
- pnpm 10 以上（`corepack enable` で有効化できます）

## よく使うコマンド

| コマンド                    | 内容                                                    |
| --------------------------- | ------------------------------------------------------- |
| `pnpm install`              | 依存関係のインストール                                  |
| `pnpm dev`                  | 開発サーバー起動（http://localhost:5173）               |
| `pnpm test`                 | 全パッケージのテスト                                    |
| `pnpm build`                | 型チェック + クライアントのビルド（`apps/client/dist`） |
| `pnpm lint` / `pnpm format` | ESLint / Prettier                                       |
| `pnpm balance --seeds 200`  | バランス検証（ボットが自動で遊び、レポートを出力）      |
| `pnpm dev:server`           | API サーバー起動（wrangler dev、http://localhost:8787） |
| `pnpm perf`                 | サーバー検証1回あたりの計算量の計測                     |

`http://localhost:5173/?seed=42` のように `seed` を付けると、そのシードで新しいランを始めます。

### バランス検証

`pnpm balance --seeds 200` で、ランダム・貪欲・探索の3種類のボットが自動でランを遊び、
`tools/balance/reports/latest.md` にレポートを出力します（ボット別・シフト別のクリア率、スコア分布、
パーツ別の購入率、クリアできなかったシード）。主なオプション:

- `--bots greedy,search` … 使うボット
- `--search-seeds 100` … 探索ボットだけシード数を絞る（重いため。既定は最大100）
- `--start 5000` … 開始シード
- `--time-limit 3000` … 探索ボットの1シフトあたりの思考時間（ミリ秒）

調整の記録は [docs/balance-log.md](./docs/balance-log.md) にあります。

### オンライン（デイリーチャレンジ）をローカルで動かす

API サーバーは Cloudflare Workers + D1（Hono）。ローカルでは wrangler が D1 ごと再現します。

```sh
cp apps/server/.dev.vars.example apps/server/.dev.vars   # 秘密値（git 管理外）。値は任意の長い文字列に変える
pnpm --filter @chain-factory/server db:migrate:local      # ローカル D1 にテーブルを作る（初回・スキーマ変更時）
pnpm dev:server                                           # API（:8787）
pnpm dev                                                  # クライアント（:5173。/api は 8787 へ転送される）
```

画面右上の「デイリー」から、本番（1日1回・ランキング対象）・練習・ランキングを開けます。

- ジョブ（Cron とは独立して実行できる）: `pnpm --filter @chain-factory/server job daily`
  （`--at 2026-10-05T00:00:00Z` で時刻指定、`--db file.sqlite` で任意の SQLite に対して実行）
- スキーマを変えたら `pnpm --filter @chain-factory/server db:generate` でマイグレーションを生成する
- 本番の秘密値は `wrangler secret put DAILY_MASTER_SECRET` で設定する（リポジトリには置かない）

## ディレクトリ構成

```
packages/
  sim/            純粋なシミュレーション・ラン進行・バランス定数（外部依存ゼロ）
    src/
      balance.ts        ★ ゲームの数値はすべてここ（価格・倍率・発動回数・ノルマ・予算）
      types.ts          盤面・信号・イベントなどの型
      core/             スコア型・シード付き乱数・方向・盤面ヘルパー
      config/           RunConfig（ランごとに確定する設定）・ルールの層・ボス修正ルール
      simulate/         simulate() 本体と、パーツ1種=1ファイルの挙動定義（parts/）
      run/              ラン進行（開始・購入/配置/移動/売却/リロール・試運転/本番・用途別シード）
      meta/             メタ進行（ランをまたぐ進捗）
    test/               決定論・停止性・各パーツ・連鎖スナップショット・ボス・ラン進行
  shared/         client / server 共通の型（セーブデータ形式・API の型・スコアの3列表現・ランキングの並び順）
apps/
  server/         API サーバー（Hono + Cloudflare Workers + D1）
    src/
      index.ts          Workers の入り口（Cloudflare 固有のものはここと adapters/ だけ）
      app.ts            ルーティング・認証・レート制限・エラー変換
      env.ts            環境変数 → 設定
      domain/           デイリー（秘密値・生成ジョブ・サーバー検証）・プレイヤー・ランキング
      repositories/     DB アクセスの窓口（types.ts）と実装（drizzle.ts / memory.ts）
      adapters/         レート制限・node:sqlite（テストとジョブのローカル実行用）
      db/               Drizzle スキーマとマイグレーション
      jobs/             Cron から呼ぶジョブの一覧
      config/           サーバーの上限値・表示名のルール
    scripts/run-job.ts  ジョブを単体で実行する
    test/               リポジトリ・API（不正な提出の拒否・ゴールデンデータ）
  client/         Web版クライアント（Vite + PixiJS + React）
    src/
      board/            PixiJS の盤面描画と演出再生（fx/ に連鎖演出）
      playback/         イベント再生のタイミング制御・途切れた理由の集計（描画に依存しない）
      state/            画面状態の reducer（操作ログの記録・プレイモード）・セーブ/ロード
      online/           API クライアント・オンラインの身元・デイリーのラン組み立て（再開・練習）
      ui/               React の各パネル（HUD・ショップ・手持ち・結果画面など。online/ にデイリー・ランキング）
      i18n/             文言（ja.json / en.json）と大きな数の表記
      audio/            サウンドマニフェスト（合成SEのレシピ）と再生エンジン
      config/           演出の閾値（effects.ts）・操作の設定（input.ts）
      settings/         ユーザー設定（言語・演出・音量。セーブとは別に保存）
      assets/           見た目の定義（manifest.ts）とパーツ画像（parts/*.svg、仮素材）
tools/
  balance/        バランス検証ツール（bots/ にボット3種、reports/ に出力）
  perf/           計算量の計測（サーバー検証の CPU 時間の見積もり）
docs/
  plans/          フェーズごとの計画書
  balance-log.md  バランス調整の記録
legacy/machigai/  以前このリポジトリにあった別ゲーム（まちがい仕掛け人）
```

## 遊び方

1ラン = 3日 × 3シフト（朝・昼・夜）= 9シフト。夜はボスシフトで、修正ルールが1つかかる（同じ日の朝・昼に予告）。

1. ショップでパーツを買う（買ったパーツは手持ちに入り、そのまま配置待ちになる）。品揃えは有料でリロールできる
2. 盤面の空きマスをクリックして配置（マウスを乗せると配置プレビュー）。`R` キーで向きを回転
3. 盤面のパーツをクリックすると、回転・手持ちに戻す（無料。移動に使う）・売却（半額返金、2回押しで確定）ができる
4. 「試運転」は何度でも可能（ポンコツロボなどランダムな動きは毎回変わる）。「スイッチを押す（本番）」で結果が確定
5. ノルマ達成で次のシフトへ（盤面・手持ち・残予算・報酬・貯金箱の収入を持ち越し）。9シフト達成でクリア
6. 再生後は、連鎖が途切れた場所と理由が盤面に表示される。右上の「デバッグ」で tick ごとのイベントも見られる
7. ランが終わると実績が記録され、新パーツや工場拡張（8×8・9×9）が解放される。全シフトクリア後は「延長戦」に挑戦できる

スマホでは、選択中のパーツをもう一度タップで回転、長押しで手持ちに戻せます。
右上の「設定」で、言語・演出の強さ（標準／控えめ／最小）・画面の揺れ・音量を変えられます。
