# Chain Factory（仮）

工場フロアにパーツを置き、スイッチを1回押すだけで連鎖が走る「連鎖ビルダー × ノルマ上昇型ローグライク」。
設計書は [CLAUDE.md](./CLAUDE.md) を参照。現在は **フェーズ4: Steam 化**（デスクトップ版・Steam 連携・素材・ストア準備）まで実装済み。

## 必要なもの

- Node.js 22.13 以上
- pnpm 10 以上（`corepack enable` で有効化できます）

## よく使うコマンド

| コマンド                                          | 内容                                                      |
| ------------------------------------------------- | --------------------------------------------------------- |
| `pnpm install`                                    | 依存関係のインストール                                    |
| `pnpm dev`                                        | 開発サーバー起動（http://localhost:5173）                 |
| `pnpm test`                                       | 全パッケージのテスト                                      |
| `pnpm build`                                      | 型チェック + クライアントのビルド（`apps/client/dist`）   |
| `pnpm --filter @chain-factory/client build:demo`  | 体験版のビルド（初期パーツ・7×7・延長戦なし）             |
| `pnpm lint` / `pnpm format`                       | ESLint / Prettier                                         |
| `pnpm balance --seeds 200`                        | バランス検証（ボットが自動で遊び、レポートを出力）        |
| `pnpm dev:server`                                 | API サーバー起動（wrangler dev、http://localhost:8787）   |
| `pnpm perf`                                       | サーバー検証1回あたりの計算量の計測                       |
| `pnpm --filter @chain-factory/desktop start`      | デスクトップ版（Electron）を起動（`start:demo` で体験版） |
| `pnpm --filter @chain-factory/desktop package`    | Windows 向けのフォルダを作る（`package:demo` で体験版）   |
| `pnpm --filter @chain-factory/client art`         | 素材（SVG・パレットの CSS）を生成スクリプトから書き出す   |
| `pnpm --filter @chain-factory/client dev:capture` | 撮影モード（ストア用の画像・動画の撮影）で起動            |

`http://localhost:5173/?seed=42` のように `seed` を付けると、そのシードで新しいランを始めます。

### バランス検証

`pnpm balance --seeds 200` で、ランダム・貪欲・探索の3種類のボットが自動でランを遊び、
`tools/balance/reports/latest.md` にレポートを出力します（ボット別・シフト別のクリア率、スコア分布、
パーツ別の購入率、クリアできなかったシード）。主なオプション:

- `--bots greedy,search` … 使うボット
- `--search-seeds 100` … 探索ボットだけシード数を絞る（重いため。既定は最大100）
- `--start 5000` … 開始シード
- `--time-limit 3000` … 探索ボットの1シフトあたりの思考時間（ミリ秒）
- `--eval worst --samples 5` … ランダムな盤面を「5回試して最悪の回」で評価する（慎重なプレイヤー）
- `--mode daily` … デイリーと同じ条件（3シフト・全パーツ・今日の特殊ルール）

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

- 本番と同じ形（同一オリジン・セキュリティヘッダー・PWA）で試すときは、クライアントをビルドしてから `pnpm dev:server` だけを起動し http://localhost:8787 を開く
- 人間確認（Turnstile）は、開発時は Cloudflare 公式のテスト用キーで常に通る（通信もしない）
- ジョブ（Cron とは独立して実行できる）: `pnpm --filter @chain-factory/server job <daily|market|ip-purge|all>`
  （`--at 2026-10-05T00:00:00Z` で時刻指定、`--db file.sqlite` で任意の SQLite に対して実行）
- スキーマを変えたら `pnpm --filter @chain-factory/server db:generate` でマイグレーションを生成する
- 本番デプロイ・バックアップの手順は [docs/ops/](./docs/ops/)、規約類の下書きは [docs/legal/](./docs/legal/)

### デスクトップ版（Steam）

- 開発・ビルドの手順: [docs/ops/desktop.md](./docs/ops/desktop.md)（Steamworks SDK の配置・App ID 480 での起動）
- Steam の人の作業: [steam-setup](./docs/ops/steam-setup.md)・[steam-achievements](./docs/ops/steam-achievements.md)・
  [steam-cloud](./docs/ops/steam-cloud.md)・[steam-build](./docs/ops/steam-build.md)・[steam-testing](./docs/ops/steam-testing.md)・
  [store-assets](./docs/ops/store-assets.md)
- 素材のスタイルガイド: [docs/art-style.md](./docs/art-style.md)。生成AIの利用記録: [docs/ops/ai-disclosure.md](./docs/ops/ai-disclosure.md)

## ディレクトリ構成

```
packages/
  sim/            純粋なシミュレーション・ラン進行・バランス定数（外部依存ゼロ）
    src/
      balance/          ★ ゲームの数値はすべてここ（種類ごとにファイルを分けている）
        parts.ts          パーツの価格・発動回数・レア度・倍率などの効果量
        shifts.ts         シフト表（ノルマ・予算・報酬）・延長戦・デイリー
        economy.ts        ショップの品数・リロール・売却・最初の手持ち
        meta.ts           パーツの解放条件・工場拡張
        boss.ts           ボス（夜シフト）の修正ルールの効果量
        sim.ts            盤面の広さ・tick 上限など
      types.ts          盤面・信号・イベントなどの型
      core/             スコア型・シード付き乱数・方向・盤面ヘルパー
      config/           RunConfig（ランごとに確定する設定）・ルールの層・ボス修正ルール
      simulate/         simulate() 本体と、パーツ1種=1ファイルの挙動定義（parts/）
      run/              ラン進行（開始・購入/配置/移動/売却/リロール・試運転/本番・用途別シード）
      meta/             メタ進行（ランをまたぐ進捗）
      achievements/     実績の定義と解除の判定（純粋関数）
    test/               決定論・停止性・各パーツ・連鎖スナップショット・ボス・ラン進行・実績
  shared/         client / server / desktop 共通の型（セーブデータ形式・API の型・スコアの3列表現・ランキングの並び順・デスクトップ版の IPC）
apps/
  server/         API サーバー（Hono + Cloudflare Workers + D1）
    src/
      index.ts          Workers の入り口（Cloudflare 固有のものはここと adapters/ だけ）
      app.ts            ルーティング・認証・レート制限・エラー変換
      env.ts            環境変数 → 設定
      domain/           デイリー（秘密値・生成ジョブ・サーバー検証）・相場・プレイヤー（IP の扱い）・ランキング
      repositories/     DB アクセスの窓口（types.ts）と実装（drizzle.ts / memory.ts）
      adapters/         レート制限・人間確認（Turnstile）・Steam の認証チケットの確認・node:sqlite（テスト用）
      db/               Drizzle スキーマとマイグレーション
      jobs/             Cron から呼ぶジョブの一覧
      config/           サーバーの上限値・表示名のルール・相場の係数
    scripts/run-job.ts  ジョブを単体で実行する（daily / market / ip-purge / all）
    test/               リポジトリ・API（不正な提出の拒否・ゴールデンデータ）
  client/         Web版クライアント（Vite + PixiJS + React）
    art/                素材の生成スクリプト（パレット → SVG・CSS）とプレビューページ
    build/              ビルド用のプラグイン・OGP／アイコン／実績／ストア画像の書き出し
    public/             アイコン・OGP 画像・PWA のマニフェスト・セキュリティヘッダー（_headers）
    src/
      Root.tsx          タイトル ⇄ ゲーム画面の切り替え（ゲーム本体は遅延読み込み）
      boot/             ゲーム本体の遅延読み込み（進捗つき）・Service Worker の登録
      board/            PixiJS の盤面描画と演出再生（fx/ に連鎖演出）
      playback/         イベント再生のタイミング制御・途切れた理由の集計（描画に依存しない）
      state/            画面状態の reducer（操作ログの記録・プレイモード）・セーブ/ロード
      online/           API クライアント・オンラインの身元・デイリーのラン組み立て・相場・シェア文・Turnstile
      ui/               React の各パネル（HUD・ショップ・手持ち・結果画面など。title/ online/ share/）
      i18n/             文言（ja.json / en.json）と大きな数の表記
      audio/            サウンドマニフェスト（合成SEのレシピ）と再生エンジン
      config/           演出の閾値・操作（input.ts・キー割り当ての controls.ts）・レイアウト・体験版／製品版（edition.ts）・フォント
      input/            キーボード・コントローラーの入力（盤面のカーソル・メニューのフォーカス移動）
      platform/         Web 版とデスクトップ版の違いの吸収（実績・認証チケット・ストア）
      storage/          保存先（Web 版は localStorage、デスクトップ版はファイル）
      settings/         ユーザー設定（言語・演出・音量。セーブとは別に保存）
      assets/           見た目の定義（manifest.ts・palette.ts）と素材（パーツ・マスコット・盤面・アイコン・ロゴ・実績・フォント）
  desktop/        デスクトップ版（Electron。メインプロセス・preload・Steam アダプター・ビルド設定・SteamPipe のひな形）
tools/
  balance/        バランス検証ツール（bots/ にボット3種、reports/ に出力）
  perf/           計算量の計測（サーバー検証の CPU 時間の見積もり）
  fonts/          同梱フォントのサブセット化
docs/
  plans/          フェーズごとの計画書
  ops/            本番デプロイ・D1 のバックアップと復元・デスクトップ版と Steam の手順書
  legal/          利用規約・プライバシーポリシーの下書き
  balance-log.md  バランス調整の記録
  art-style.md    素材のスタイルガイド
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
