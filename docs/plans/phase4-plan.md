# フェーズ4 計画書（Steam 化）

前提: CLAUDE.md、`docs/plans/phase4-handoff.md`、フェーズ4のプロンプト（2026-09-28）。

> **2026-09-28 承認済み。** 要相談の決定: B4 Steam の名前は使わない／D2 Steam 統計は回数系だけ入れる（ラン回数・全クリア回数・デイリー参加日数）／E2 コントローラー＋キーボード操作を入れる（4d）。
> この計画の承認後に 4a から着手する。**実績の一覧（§8）・素材の一覧とパーツのモチーフ（§9）もこの計画で承認をもらう**（プロンプトの「着手前に承認」の項目をまとめて提示している）。

---

## 1. 先に指摘しておきたいこと（異論・懸念・より良い案）

1. **体験版の名前を `trial` → `demo` にそろえる**
   - プロンプトは `VITE_EDITION=demo`、現在のコードは `trial`。Steam の用語（Demo）に合わせて `demo` に改名する。Web 体験版も `demo` を使う（`.env.trial` → `.env.demo`、`build:trial` → `build:demo`）
2. **この作業環境で作れる Windows ビルドは「未署名・アイコン未埋め込み」になる**
   - electron-builder は Linux 上でも Windows 向けの `dir`（展開フォルダ）／`zip` を作れるが、exe へのアイコン・バージョン情報の埋め込み（rcedit）には wine が要る。作業環境には wine がない
   - 対策: `win.signAndEditExecutable: false` で作れるところまで作り、**正式ビルドは Windows 機（人の作業）で同じコマンドを実行する**手順にする。Steam 配布はインストーラー不要なので `dir` ターゲットで足りる
   - 作業環境ではデスクトップ版の起動確認を **Linux 版の Electron** で行う（Steam なしで起動して通常ランを最後まで遊べることを Playwright の Electron 操作で確認する）
3. **Steam 体験版と製品版でセーブが別になる**（E3 の方針案）
   - App ID が違うので Steam Cloud は共有されない。ローカルの保存先フォルダも分ける（混ざると延長戦など体験版にない状態が入り込むため）
   - 提案: 製品版の初回起動時に、同じ PC に体験版のセーブがあれば「体験版のデータを引き継ぐ」を1回だけ出す（ローカルのファイルを読むだけ）。形式は同じなのでそのまま読める。体験版のメタ進行は初期状態のまま使っていないため、引き継ぐのは実績の元になる記録（ラン回数など）と設定だけになる
4. **Steam ユーザーは Turnstile を通れない可能性が高い**
   - Turnstile はホスト名で制限されるため、`app://` の画面では動かない見込み。Steam 認証を人間確認の代わりにする方針（B2）で問題が解消する。逆に「Steam が起動していない」デスクトップ版はデイリーに参加できない（通常ランは遊べる）。画面でそう案内する
5. **SteamID は保存しないで「秘密値つきハッシュ」だけを持つ**
   - 同じ Steam アカウントを同じプレイヤー ID に紐づけるにはハッシュで足りる。IP の扱い（フェーズ3）と同じ方式にそろえる
6. **トークンは Steam 認証のたびに作り直す**
   - 複数の端末（PC と Steam Deck）で同じアカウントを使うと、片方のトークンが無効になる。デスクトップ版は 401 を受けたら Steam で認証し直して1回だけやり直す
7. **実績の判定に使う記録が足りない**
   - ボス別のクリア・デイリーの参加記録などを `MetaRecords` に追加する必要がある → セーブの `SAVE_VERSION` を 3 に上げ、変換処理とテストを足す
8. **「確認済みの外部情報」との食い違いはない**。補足:
   - Electron の最新安定版は 44.4.5（npm、2026-09-24 更新）。steamworks-ffi-node は 0.11.3（2026-09-24 更新）、steamwand.js は 0.6.0（2026-09-28 更新）
   - steamwand.js は `steam_api` の redistributable を npm パッケージに同梱している（ライセンス上の扱いが不明。要確認）

---

## 2. 論点ごとの判断

### A1. Steamworks ライブラリ → **steamworks-ffi-node 0.11.3 を推奨**

|                 | steamworks-ffi-node                                                                                                         | steamwand.js                                        | steamworks.js                                                |
| --------------- | --------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- | ------------------------------------------------------------ |
| 最新版・更新    | 0.11.3（2026-09-24）                                                                                                        | 0.6.0（2026-09-28）                                 | 0.4.0（2024-08）                                             |
| 方式            | Koffi FFI・手書きの TS ラッパー                                                                                             | Koffi FFI・Valve の API 定義から自動生成（807関数） | Rust（napi-rs）                                              |
| Electron        | メインプロセスでの初期化を推奨・ASAR 除外の手順あり                                                                         | ASAR 除外は README に記載                           | README がレンダラーで nodeIntegration 前提（方針と合わない） |
| 必要な機能      | 実績・Web API チケット（16進で取得できる）・Remote Storage・オーバーレイ（ストアを開く）・画面上キーボード・Steam Deck 判定 | ほぼ全 API                                          | 実績・チケット等                                             |
| redistributable | 同梱しない（人が SDK から配置）                                                                                             | 同梱（ライセンス要確認）                            | 同梱                                                         |
| ライセンス      | MIT                                                                                                                         | MIT                                                 | MIT                                                          |

- 理由: 必要な機能がそろい、Electron でメインプロセス初期化という方針に合う。型定義で Web API チケット（`steam.user.getAuthTicketForWebApi(identity)` → `ticketHex`）を確認済み
- 差し替えに備え、Steam の呼び出しは `apps/desktop/src/main/steam/` のアダプター（自前のインターフェース）1か所に閉じ込める。steamwand.js に替える場合もここだけを書き直す

### A2. Electron の構成

- **Electron 44.4.5 に固定**（最新の安定版。セキュリティ修正が最も新しく、サポート期間が最も長い。Koffi は N-API なので Electron の版に依存しない）
- パッケージャーは electron-builder 26.15.3（`asarUnpack` で steamworks-ffi-node・koffi・@koromix・SDK を除外）
- プロセス構成は §4 のとおり

### A4. 対応 OS → Windows x64 のみ。macOS の見積もり（要相談の材料）

| 項目   | 内容                                                                                                                                                             |
| ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 費用   | Apple Developer Program の年会費（要確認。以前は年 99 USD）＋ Mac 実機（Apple Silicon）が必要                                                                    |
| 作業   | 署名・公証（notarize）の設定、ユニバーサルビルド（koffi の両アーキテクチャ取得）、Steam の Mac 用 depot、オーバーレイ（Metal、実験的）の確認、Mac でのテスト一式 |
| 規模感 | 初回の整備で数日、以後リリースのたびに公証の待ち時間                                                                                                             |

→ 発売後、ウィッシュリストやレビューで Mac の要望が一定数あれば着手する（推奨）

### B4. 表示名に Steam の名前を使うか（要相談） → **推奨: 自動では使わない。「Steam の名前を使う」ボタンで本人が選んだときだけ**

- 自動で使わない理由: Steam の名前には本名が入っていることがある（ランキングで公開される）。NG ワードに引っかかる名前もある。Steam 側で名前を変えても自動では追従しない
- ボタンで使う場合も、既存の表示名ルール（文字数・使用文字・NG ワード）を通す。通らなければその旨を表示する
- 採用する場合はプライバシーポリシーに「本人が選んだ場合に Steam の名前を表示名として保存する」を追記する

### D2. Steam 統計（進捗バー）（要相談） → **推奨: 今回は見送り**

- 効果: 実績の進捗バー（「ラン10回 3/10」など）が Steam 上に出る
- コスト: 実装は小さい（統計の送信を1か所）が、Steam の統計は 32bit の整数か浮動小数点で、このゲームの出荷量（bigint）は表せない。進捗バーを付けられるのは回数系（ラン回数・全クリア回数）だけ。統計の定義を人が Steamworks に登録する作業も増える
- 代わりに、ゲーム内の実績一覧（メタ進行パネル）に進捗を表示する

### E2. コントローラー操作（要相談） → **推奨: 入れる（4d で実装）**

- Steam Deck の評価: 「確認済み（Verified）」には、既定の操作をコントローラーで全部できることが必要。タッチだけでは「プレイ可能（Playable）」止まりの見込み。確認済みはストアでの露出に効く
- 方式: 盤面にカーソルを出し、十字キー／スティック・矢印キーで移動、A で配置・選択、X で回転、B で取り消し、L/R でショップ↔手持ちのタブ切り替え、Y で試運転、スタートで本番。メニューはフォーカス移動（ボタンを順に選ぶ）
- 実装: ブラウザ標準の Gamepad API（Electron でそのまま使える。Steam Input が Deck の操作を XInput として渡す）＋キーボード。キー割り当ては設定ファイルに集約
- 規模感: 盤面カーソルとフォーカス移動・ボタン表示の切り替えで、4a〜4b の半分程度の作業量
- 入れない場合: 4d でタッチとマウスだけを確認する

### E1. Steam Deck

- 1280×800 で全体が収まるレイアウト（フェーズ3の狭い画面レイアウトとは別に、横長で高さが低い画面用の調整）
- タッチ: 既存のタップ操作（タップで配置・もう一度タップで回転・長押しで戻す）がそのまま使える
- 名前入力: Steam の画面上キーボード（`showFloatingGamepadTextInput`）を、入力欄にフォーカスしたとき Steam Deck 上でだけ呼ぶ（IPC 経由）

### E3. Steam 体験版

- `VITE_EDITION=demo` で体験版をデスクトップにも作る。App ID は設定値（製品版・体験版で別）
- 体験版では実績を無効にする（体験版の App ID に実績を登録しない前提）
- 製品版への誘導: オーバーレイが使えれば `activateGameOverlayToStore(製品版の App ID)`、使えなければ外部ブラウザでストアページ
- セーブの引き継ぎは §1-3 のとおり

### E4. 撮影モード

- 開発用の設定（`VITE_CAPTURE=1` でビルドしたときだけ有効。製品版・体験版の通常ビルドには含めない）
- 機能: UI の表示切り替え（全部／最小限／なし）、指定したシードと盤面（JSON）の本番を再生、ウィンドウサイズ固定（1920×1080・2560×1440）、再生速度（0.25×〜2×）
- 盤面は「今の盤面を書き出す／読み込む」で JSON にする（見栄えの良い連鎖を何度でも再現できる）

### F1〜F3

- F1: `--eval worst` の実行、デイリーモード（3シフト）の追加、ノルマとポンコツロボの倍率幅の調整案を2〜3案（採用は要相談）
- F2: プライバシーポリシーに SteamID（ハッシュで保存）・Steam の名前（B4 を採用した場合）を追記。【未確定】の一覧を作る
- F3: フォントのサブセット化（§7）

---

## 3. ディレクトリ構成（追加・変更分）

```
apps/desktop/                     （新規）
  package.json                    electron 44.4.5（固定）・electron-builder・steamworks-ffi-node
  electron-builder.config.cjs     製品版／体験版の設定（App ID・保存先フォルダ・asarUnpack）
  src/
    main/
      index.ts                    起動（Steam 初期化 → プロトコル登録 → ウィンドウ）
      window.ts                   ウィンドウの作成（sandbox 等）・遷移と新規ウィンドウの禁止
      protocol.ts                 app:// の配信と CSP
      externalLinks.ts            外部リンクの許可リスト
      ipc/
        channels.ts               IPC のチャンネル名と引数・戻り値の型（preload と共有）
        validate.ts               引数の検証（メインプロセス側）
        handlers.ts               チャンネル → 処理の対応
      storage/fileStore.ts        JSON ファイルの保存（一時ファイル → 置き換え）
      steam/
        types.ts                  自前の Steam アダプターのインターフェース
        steamworksAdapter.ts      steamworks-ffi-node の実装（ここだけがライブラリを知る）
        mockAdapter.ts            テスト・Steam なし用
      config.ts                   App ID・identity・ストア URL など（ビルド時の設定から）
    preload/index.ts              contextBridge で最小限の API を公開
  steampipe/                      SteamPipe のアップロード設定のひな形（app_build / depot_build）
  test/                           IPC 検証・ファイル保存・Steam アダプター（モック）
apps/client/src/
  platform/
    types.ts                      Platform インターフェース（実績・認証チケット・ストア・画面上キーボード・環境情報）
    web.ts                        Web 版（何もしない）
    desktop.ts                    デスクトップ版（preload の API を呼ぶ）
    index.ts                      どちらを使うかを決める
  storage/
    types.ts                      KeyValueStore インターフェース
    localStorageStore.ts          Web 版
    desktopStore.ts               デスクトップ版（起動時に全部読み込み、書き込みは IPC）
  achievements/                   実績の表示・送信（判定は sim）
  capture/                        撮影モード（開発用ビルドのみ）
  input/                          コントローラー・キーボード操作（E2 を採用した場合）
  assets/
    palette.ts                    カラーパレット（1か所に集約。CSS 変数にも書き出す）
    mascot/ parts/ board/ boss/ ui/ logo/ achievements/   （§9）
packages/sim/src/
  achievements/
    definitions.ts                実績の定義（ID・条件・隠しかどうか）
    evaluate.ts                   解除の判定（純粋関数）
  meta/                           MetaRecords の追加項目（§5）
packages/shared/src/
  save/v3.ts                      SAVE_VERSION 3（記録の追加・解除済み実績）
  api/types.ts                    SteamAuthRequest / Response
apps/server/src/
  adapters/steamAuth.ts           AuthenticateUserTicket の呼び出し（＋モック）
  domain/players/externalAuth.ts  外部 ID プロバイダーで確認済みのユーザー → プレイヤー
  db/migrations/0002_*.sql        external_accounts テーブル
tools/
  fonts/                          フォントのサブセット化スクリプト
  store-art/                      ストア用画像・実績アイコンの書き出し
docs/
  art-style.md                    スタイルガイド
  art-preview.html                素材のプレビューページ
  ops/steam-*.md                  人が行う作業の手順書（§11）
  ops/ai-disclosure.md            生成AIコンテンツの一覧と設問の文案
```

---

## 4. デスクトップ版の構成と IPC

```
メインプロセス（Node）                         レンダラー（sandbox・Node なし）
 ├ Steam アダプター（steamworks-ffi-node）      ├ apps/client（Web 版と同じコード）
 ├ ファイル保存（userData/save/*.json）         │   └ platform/desktop.ts・storage/desktopStore.ts
 ├ app:// の配信（dist）＋ CSP                  └ preload（contextBridge: window.chainFactory）
 └ IPC ハンドラー（引数を検証）  ←── invoke ──
```

### IPC（`ipcRenderer.invoke` のみ。チャンネルと型を固定）

| チャンネル                | 引数                                             | 戻り値                                                             | 備考                                                                |
| ------------------------- | ------------------------------------------------ | ------------------------------------------------------------------ | ------------------------------------------------------------------- |
| `storage:readAll`         | なし                                             | `{ [key]: string }`                                                | 起動時に1回。キーは許可リストのもの（save・settings・identity）だけ |
| `storage:write`           | `key`（許可リスト）・`value`（文字列、上限 1MB） | `void`                                                             | 一時ファイル → 置き換え                                             |
| `platform:info`           | なし                                             | `{ edition, steam: 'ready' \| 'unavailable', isSteamDeck, appId }` |                                                                     |
| `steam:authTicket`        | なし                                             | `{ ticketHex } \| null`                                            | identity はメインプロセスの設定値（レンダラーから渡さない）         |
| `steam:unlockAchievement` | `id`（定義済みの ID のみ）                       | `boolean`                                                          | 体験版では常に false                                                |
| `steam:openStore`         | なし                                             | `void`                                                             | オーバーレイ → 使えなければ既定のブラウザ                           |
| `steam:showKeyboard`      | 入力欄の位置（整数4つ）                          | `boolean`                                                          | Steam Deck のときだけ                                               |
| `shell:openExternal`      | `url`（許可リストのドメインのみ）                | `void`                                                             | X の投稿画面・ストア・規約ページ                                    |

- 保存のキーは `save` / `settings` / `identity` の3つ。`identity`（認証トークン）は Auto-Cloud の対象外のファイル名にする
- クライアントの保存処理は同期的に読めるよう、起動時にすべて読み込んでメモリに持ち、書き込みだけを IPC で送る

### Steam 認証の流れ（B1）

1. 起動時（Steam が使えるとき）: レンダラー → `steam:authTicket` → メインプロセスが `getAuthTicketForWebApi(identity)`
2. レンダラー → サーバー `POST /api/auth/steam { appId, ticket }`
3. サーバー: App ID が許可リストにあるか確認 → `AuthenticateUserTicket(key, appid, ticket, identity)` → SteamID
4. SteamID の HMAC で `external_accounts` を引き、あればそのプレイヤー、なければ新規作成（Turnstile なし）。トークンを発行して返す
5. 以後は既存の API（`Bearer playerId.token`）をそのまま使う。401 なら 1〜4 をやり直して1回だけ再試行

### クラウドセーブ（C1）

- 保存先: `%APPDATA%/<製品名フォルダ>/save/`（体験版は別フォルダ）
  - `save.json`（ラン・メタ進行・実績）・`settings.json` → Auto-Cloud の対象
  - `identity.json` → 対象外（別フォルダ `local/` に置く）
- Auto-Cloud の設定値（ルート・サブフォルダ・パターン・容量）は手順書に書く（人が管理画面で入力）

---

## 5. 主要な型

```ts
// ---- client: プラットフォーム ----
interface Platform {
  kind: 'web' | 'desktop';
  info(): Promise<{ edition: 'full' | 'demo'; steam: 'ready' | 'unavailable'; isSteamDeck: boolean }>;
  steamAuthTicket(): Promise<string | null>;         // Web 版は常に null
  unlockAchievement(id: AchievementId): Promise<boolean>;
  openStore(): Promise<void>;
  openExternal(url: string): Promise<void>;
  showKeyboard(rect: { x: number; y: number; width: number; height: number }): Promise<boolean>;
}
interface KeyValueStore { get(key: StoreKey): string | null; set(key: StoreKey, value: string): void }
type StoreKey = 'save' | 'settings' | 'identity';

// ---- sim: 実績 ----
interface AchievementDef {
  id: AchievementId;           // 'ACH_FIRST_SHIP' など（Steamworks に登録する API 名と同じ）
  hidden: boolean;
  condition: AchievementCondition; // 記録のしきい値 or イベント
}
type AchievementCondition =
  | { kind: 'record'; record: keyof AchievementRecords; atLeast: number | string }
  | { kind: 'bossCleared'; boss: BossModifierId }
  | { kind: 'dailyResult'; ... };
function evaluateAchievements(records: AchievementRecords, unlocked: readonly AchievementId[]): AchievementId[];

// MetaRecords への追加（SAVE_VERSION 3）
interface MetaRecords {
  /* 既存 */ totalShipped; bestShiftReached; bestChain; bestShiftScore; runsPlayed; runsCleared; …
  bossesCleared: Partial<Record<BossModifierId, number>>;
  bestOvertimeShift: number;
  dailyPlayed: number; dailyCleared: number; bestDailyTopPercent: number | null; dailyStreak: …;
}
// セーブに「解除済みの実績」を持つ（Steam がオフラインでも後で送り直せるように）
interface SaveDataV3 { version: 3; run; meta; achievements: { unlocked: AchievementId[] } }

// ---- server ----
interface ExternalAuthProvider {
  /** 確認できたら外部 ID（プロバイダー内で一意）を返す。失敗は理由つき */
  verify(input: { appId: string; ticket: string }): Promise<{ ok: true; subject: string } | { ok: false; reason: 'appIdNotAllowed' | 'invalidTicket' | 'providerError' }>;
}
```

---

## 6. API・DB の変更

- `POST /api/auth/steam` `{ appId: string, ticket: string }` → `RegisterPlayerResponse`（既存と同じ形）
  - エラー: `badRequest`（形式）・`unauthorized`（チケット不正・identity 不一致）・`forbidden`（App ID 不許可）・`serviceUnavailable`（Steam 側の障害）
  - レート制限は IP 単位（既存の書き込み上限）
- 環境変数: `STEAM_WEB_API_KEY`（Secrets）、`STEAM_APP_IDS`（例 `480,<製品版>,<体験版>`）、`STEAM_TICKET_IDENTITY`（例 `chain-factory-api`）
- CORS: `CORS_ORIGINS` にデスクトップ版の Origin（`app://chain-factory` の見込み。実機で確認して手順書に書く）
- DB（migration 0002）:

| テーブル          | 列                                                                                            | 備考                 |
| ----------------- | --------------------------------------------------------------------------------------------- | -------------------- |
| external_accounts | provider（'steam'）, subject_hash（HMAC）, player_id, created_at。PK (provider, subject_hash) | SteamID は保存しない |

---

## 7. フォントのサブセット化（F3）

- ソースは Google Fonts の M PLUS Rounded 1c（OFL）の TTF を `tools/fonts/` のスクリプトで取得（GitHub から。リポジトリには入れない）
- 収録する文字: i18n の全文言＋英数字記号＋ひらがな・カタカナ全部。→ 1ファイル（太さごと）の woff2 にして同梱し、`@fontsource` の依存を外す
- 表示名にサブセット外の漢字が入った場合は、日本語フォントを優先したフォールバック（Hiragino / Noto Sans JP / Yu Gothic / Meiryo）で表示（ランキングは DOM 表示なので問題ない）
- 見込み: 定義 CSS 127KB（gzip）＋都度ダウンロード → 数十〜百数十KB の woff2 が2つ

---

## 8. 実績の一覧（案・承認をお願いしたい項目）

ID は Steamworks に登録する API 名。★は隠し実績。デイリー系はサーバーで検証済みの結果を受け取ってから解除する。

| #   | ID                    | 名前           | 条件                                                |
| --- | --------------------- | -------------- | --------------------------------------------------- |
| 1   | ACH_FIRST_SHIP        | はじめての出荷 | 出荷量が 1 以上になる                               |
| 2   | ACH_FIRST_SHIFT       | 初仕事         | シフトを初めてクリアする                            |
| 3   | ACH_FIRST_NIGHT       | 夜勤明け       | 夜（ボス）のシフトを初めてクリアする                |
| 4   | ACH_FULL_CLEAR        | 定時退社       | 9シフトすべてクリアする                             |
| 5   | ACH_FULL_CLEAR_10     | ベテラン工場長 | 全シフトクリアを10回                                |
| 6   | ACH_BOSS_LOWOIL       | 油切れでも回る | ボス「油切れ」のシフトをクリア                      |
| 7   | ACH_BOSS_REPAIR       | 工事中も出荷   | ボス「床の補修工事」のシフトをクリア                |
| 8   | ACH_BOSS_INSPECTION   | 検査合格       | ボス「出荷検査強化」のシフトをクリア                |
| 9   | ACH_BOSS_SHORT        | 時短の達人     | ボス「短縮営業」のシフトをクリア                    |
| 10  | ACH_BOSS_SHORTAGE     | あるもので回す | ボス「部品不足」のシフトをクリア                    |
| 11  | ACH_CHAIN_25          | 連鎖反応       | 1回の稼働で連鎖 25                                  |
| 12  | ACH_CHAIN_100         | 大連鎖         | 1回の稼働で連鎖 100                                 |
| 13  | ACH_CHAIN_300         | 止まらない工場 | 1回の稼働で連鎖 300                                 |
| 14  | ACH_SHIFT_1M          | 百万出荷       | 1シフトで出荷量 1M                                  |
| 15  | ACH_SHIFT_1B          | 十億出荷       | 1シフトで出荷量 1B                                  |
| 16  | ACH_SHIFT_1T          | 兆の工場       | 1シフトで出荷量 1T                                  |
| 17  | ACH_TOTAL_1B          | 累計十億       | 累計出荷量 1B                                       |
| 18  | ACH_RUNS_10           | 常連           | ランを10回遊ぶ                                      |
| 19  | ACH_RUNS_50           | 工場に住む     | ランを50回遊ぶ                                      |
| 20  | ACH_FACTORY_8         | 工場拡張       | 工場が 8×8 になる                                   |
| 21  | ACH_FACTORY_9         | 大工場         | 工場が 9×9 になる                                   |
| 22  | ACH_ALL_PARTS         | 全部そろった   | 全パーツを解放する                                  |
| 23  | ACH_OVERTIME_3        | 残業開始       | 延長戦で3シフト生き残る                             |
| 24  | ACH_OVERTIME_9        | 終わらない残業 | 延長戦で9シフト生き残る                             |
| 25  | ACH_DAILY_FIRST       | 今日の工場     | デイリーに初めて参加（本番を1回以上確定）           |
| 26  | ACH_DAILY_CLEAR       | 本日の最優秀   | デイリーの3シフトをすべてクリア                     |
| 27  | ACH_DAILY_TOP10       | 上位 10%       | デイリーの結果が上位10%以内（結果画面の時点の順位） |
| 28  | ACH_DAILY_7           | 皆勤賞         | デイリーに合計7日参加                               |
| 29  | ACH_JUNKBOT_JACKPOT ★ | ポンコツの本気 | ポンコツロボが1回の稼働で3回続けて×3を出す          |
| 30  | ACH_ZERO ★            | 何も起きない   | スイッチを押して出荷量 0 で終わる                   |

- 数値は設定ファイル（`packages/sim/src/achievements/definitions.ts`）に置き、Steamworks に入力する一覧（ID・名前・説明・隠し）を書き出すスクリプトを用意する
- 皆勤賞は「連続7日」だと端末や日付のずれで取りこぼしが出やすいため「合計7日」にした
- 体験版では実績を無効にする

---

## 9. デザイン素材（承認をお願いしたい項目）

### 既存の素材（確認済み）

- `apps/client/public/icon.svg`・`icon-180.png`・`icon-512.png`（ポンコツロボの顔）、`ogp.png`（`build/ogp/ogp.html` から生成）
- `apps/client/src/assets/parts/*.svg`（20種）と `manifest.ts`（`src`・テーマ色・`rotates`）
- 盤面（床・枠・背景）・ボス・UI アイコンは画像がなく、PixiJS の図形と CSS で描いている

### 作る素材（すべて SVG。`apps/client/src/assets/` 以下）

| 区分         | ファイル                                                                                                                                                                                 | 備考                                                                              |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| パレット     | `palette.ts`（＋CSS 変数に書き出し）                                                                                                                                                     | 素材の SVG は色をこの定義から埋め込む（ビルド時に置換）か、`currentColor` で塗る  |
| マスコット   | `mascot/bolt-base.svg` `bolt-idle.svg` `bolt-happy.svg` `bolt-surprised.svg` `bolt-fail.svg`                                                                                             | 本体共通・目／口／アンテナで表情。アプリアイコン・OGP も更新                      |
| パーツ       | `parts/<partId>.svg` ×20                                                                                                                                                                 | ファイル名・マニフェストのキーは維持                                              |
| 盤面         | `board/floor-1.svg` `floor-2.svg` `floor-3.svg` `floor-blocked.svg` `frame-corner.svg` `frame-edge.svg` `background.svg`                                                                 | 枠は角＋辺の分割（どの盤面サイズでも並べられる）                                  |
| ボス         | `boss/lowOil.svg` `repairWork.svg` `strictInspection.svg` `shortShift.svg` `partShortage.svg`                                                                                            | 警告感（黄・赤）                                                                  |
| UI           | `ui/reroll.svg` `sell.svg` `return.svg` `rotate.svg` `trial.svg` `commit-switch.svg` `settings.svg` `volume.svg` `mute.svg` `ranking.svg` `share.svg` `debug.svg` `daily.svg` `back.svg` | 24px で判別できる線の少ないデザイン。本番スイッチだけ大きな赤ボタンとして作り込む |
| ロゴ         | `logo/logo-dark-bg.svg` `logo-light-bg.svg`                                                                                                                                              | 120×45 に縮めても読めること                                                       |
| 実績         | `achievements/<ID>.svg`（§8 の承認後）＋未解除のグレースケール版は書き出し時に自動生成                                                                                                   |                                                                                   |
| マニフェスト | `manifest.ts` を区分ごとに拡張（`MASCOT_ASSETS`・`BOARD_ASSETS`・`BOSS_ASSETS`・`UI_ICONS`・`LOGO_ASSETS`・`ACHIEVEMENT_ICONS`）                                                         |                                                                                   |

### パーツのモチーフ案（系統色: 倍率=橙、分岐=紫、再発動=水色、配置=緑、経済=桃、基本=灰と黄）

| パーツ                  | 系統   | モチーフ（1行）                                                           |
| ----------------------- | ------ | ------------------------------------------------------------------------- |
| switch スイッチ         | 基本   | 黄黒ハザード台座に乗った大きな赤い押しボタン                              |
| conveyor ベルトコンベア | 基本   | 上向きの矢羽根が並んだベルト（ローラー2本が見える）                       |
| dock 出荷口             | 基本   | 半分開いたシャッター付きの搬出口と、出ていく段ボール箱                    |
| junkbot ポンコツロボ    | 基本   | ボルトの親戚の小型ロボ（片目がずれていて、頭に「?」のランプ）             |
| gear 増幅ギア           | 倍率   | 大きな歯車と小さな歯車が噛み合い、中央に「×2」の刻印                      |
| press プレス機          | 倍率   | 上から押し潰す油圧プレスのヘッドと、左右に伸びる4本の腕（隣接マスを示す） |
| merger 合流炉           | 倍率   | 漏斗型の炉に3本の配管が集まり、下から1本出る                              |
| chainMeter 連鎖メーター | 倍率   | 針が振り切れそうな半円メーターに鎖のマーク                                |
| splitter 分岐器         | 分岐   | 1本のレールが左右2本に分かれる二股ポイント                                |
| spreader 散布機         | 分岐   | スプリンクラーのヘッドから前・左・右に3方向の噴射                         |
| barrel 爆発ドラム缶     | 分岐   | ハザード柄の帯が入ったドラム缶と、8方向の小さな爆発マーク                 |
| copier コピー機         | 分岐   | 紙が2枚ずれて出てくるコピー機（前方に2連の矢印）                          |
| reflector 反射板        | 再発動 | 斜めの鏡面パネルと、跳ね返る矢印（U字）                                   |
| turntable 回転台        | 再発動 | 円形のターンテーブルに回転矢印（時計回り）                                |
| rebooter 再起動装置     | 再発動 | 電源マーク（⏻）の大きなレバースイッチと、周囲4方向の稲妻                  |
| oiler 潤滑油タンク      | 再発動 | 注ぎ口付きの油差し（オイル缶）と、したたる油滴                            |
| coil 共鳴コイル         | 配置   | 銅線を巻いたコイルと、左右上下に広がる波紋                                |
| solar ソーラーパネル    | 配置   | 斜めに傾いたソーラーパネルと、上に小さな太陽                              |
| inspector 検品台        | 配置   | 虫めがねと、チェックマークの入った検品札                                  |
| piggyBank 貯金箱        | 経済   | ボルト（ねじ）柄の豚の貯金箱と、落ちてくる硬貨                            |

- 余白: 向きの矢印バッジ（辺の中央）・倍率バッジ（左下）・残り発動回数（下辺）と重ならないよう、モチーフは中央 70% に収める
- 向きがあるパーツ（コンベア・分岐器・散布機）は上向きで描く（回転は描画側）。他は向きの矢印バッジで向きを示す（既存どおり）
- 48px でシルエットだけで区別できるか、プレビューページで並べて確認する

### スタイルガイド（G1）の骨子

- 背景: チャコール `#1a1c20`／パネル `#262a31`、アクセント: ハザードイエロー `#ffc107`
- ボルト: 本体 緑 `#7cb342`、アウトライン 濃緑 `#33691e`、アンテナランプ 黄 `#ffeb3b`
- 線: 濃色アウトライン、64px 基準で 4px（24px 表示用のアイコンは 2px 相当）、角丸
- 塗り: フラット＋1段の影（下側を 15% 暗く）またはハイライト1本まで。グラデーションなし
- 可読性: 48px でシルエット判別、24px（UI）で意味が分かる
- 雰囲気: 親しみのあるデフォルメ、少しポンコツで愛嬌のある工場（ネジが1本飛んでいる・傾いている などの遊び）

### 生成AIコンテンツ

- 上記の素材はすべて「AI が生成したコンテンツ」として `docs/ops/ai-disclosure.md` に記録し、Steamworks の設問への文案を用意する

---

## 10. 作業手順と分割

| 段階                                 | 内容                                                                                                                                                                                                                                                                                                                                              | 主な成果物           |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------- |
| **4a デスクトップ基盤**              | ① `demo` への改名 ② Platform・保存先インターフェース（Web 実装）とセーブの読み書き差し替え ③ `apps/desktop`（Electron 44・app://・CSP・IPC・ファイル保存・外部リンク）④ Steam アダプター（steamworks-ffi-node＋モック、初期化と疎通）⑤ 製品版／体験版ビルド（Linux で起動確認、Windows の `dir` ビルド）⑥ 手順書（SDK 配置・App ID 480 での疎通） | 起動・保存・ビルド   |
| **4b Steam 連携**                    | ① サーバー `POST /api/auth/steam`（アダプター＋モック・migration）② デスクトップの認証の流れ・401 の再認証 ③ 実績（sim の判定・SAVE_VERSION 3・送信・後から送り直し・Steamworks 用の一覧の書き出し）④ Auto-Cloud 用の保存レイアウト ⑤ Steam Deck（1280×800・画面上キーボード）⑥ B4（採用時）・E2（採用時）                                        | 認証・実績・クラウド |
| **4c デザイン素材**（4a・4b と並行） | ① スタイルガイド＋パレット ② ボルト（表情4種・アイコン・OGP 更新）③ パーツ20種 ④ 盤面・ボス・UI アイコン（ゲームへの組み込み）⑤ ロゴ・実績アイコン（§8 承認後）⑥ プレビューページ ⑦ AI 開示の一覧                                                                                                                                                 | 素材一式             |
| **4d ストア・Next Fest 準備**        | ① Steam 体験版（誘導・セーブ引き継ぎ）② 撮影モード ③ ストア用画像の書き出し（G1〜G4 の後）④ バランス（worst 評価・デイリーモード・調整案）⑤ 規約の追記と【未確定】一覧 ⑥ フォントのサブセット化 ⑦ SteamPipe のひな形 ⑧ 人の作業の手順書一式                                                                                                       | 体験版・画像・手順書 |

各段階の終わりで報告し、確認をもらってから次に進む。

---

## 11. 人が行う作業（手順書: docs/ops/）

| 手順書                  | 内容                                                                                                         |
| ----------------------- | ------------------------------------------------------------------------------------------------------------ |
| `steam-setup.md`        | Steamworks 登録（登録料・税務・振込先）、製品版・体験版の App ID 取得、パブリッシャーキー発行と Secrets 登録 |
| `steam-sdk.md`          | Steamworks SDK の取得と redistributable の配置場所                                                           |
| `steam-achievements.md` | 実績の登録（書き出した一覧・アイコン）、画像サイズ（要確認）                                                 |
| `steam-cloud.md`        | Auto-Cloud の設定値                                                                                          |
| `steam-build.md`        | Windows 機でのビルド、SteamPipe でのアップロード                                                             |
| `steam-testing.md`      | App ID 480 での疎通、実績・クラウド・認証の実機確認、Steam Deck での確認                                     |

---

## 12. 要確認（公式ドキュメントで確認が必要な外部仕様）

- steamwand.js が redistributable を同梱していることのライセンス上の扱い（採用しない場合は不要）
- Steam 体験版の App ID に実績を登録できるか（今回は体験版で実績を無効にする前提）
- 実績アイコンの画像サイズ・形式（書き出しスクリプトで変更可能にする）
- Auto-Cloud のルートフォルダ名（`WinAppDataRoaming` など）とパターンの書式
- Electron のカスタムプロトコル（`app://`）から送られる `Origin` ヘッダーの値（実機で確認）
- Apple Developer Program の現在の年会費（macOS を検討する場合）
- Steam Deck の「確認済み」の審査基準の最新版（コントローラー・文字サイズ・画面上キーボード）

---

## 13. CLAUDE.md の更新差分

```diff
--- CLAUDE.md	2026-09-28 08:27:10.325226259 +0000
+++ /tmp/claude-0/-home-user-Game/fcf3fb39-d12a-5899-a606-d050b039daf9/scratchpad/CLAUDE.p4.md	2026-09-28 09:10:31.790584179 +0000
@@ -12,6 +12,8 @@
 - 世界観: 機械・工場系。リアルではなく、親しみのあるデフォルメ。当面は仮素材（単純図形）で開発する
 - マスコット: デフォルメの作業ロボ（仮名: ボルト）
 - 販売: Steam買い切り（1,000〜1,500円想定）＋ Web版を無料体験版として公開
+  - Steam 版は Windows（x64）のみで発売する。Steam Deck は Windows 版を Proton で動かす。macOS は発売後の需要を見て判断
+  - Steam には製品版とは別の App ID で体験版（Next Fest 用）を出す。内容は Web 体験版と同じ
 - オンライン: 非同期のみ（リアルタイム通信はしない）。**オンライン必須なのはデイリーのみ**。通常ランはオフラインで完結する
   - デイリーチャレンジ: 全員同じ条件（空の盤面・同じショップ・同じ相場・今日の特殊ルール）で世界ランキング
     - 1日＝3シフト（朝・昼・夜、夜はボス）の短縮版。ランキング対象は1日1回（最初の挑戦）のみ
@@ -156,7 +158,7 @@
 - サーバー（フェーズ3〜）: Cloudflare Workers + D1 + Cron Triggers
   - Webフレームワーク: Hono
   - ORM: Drizzle
-- デスクトップ（フェーズ4〜）: Electron + steamworks.js（着手時に保守状況を再確認）
+- デスクトップ（フェーズ4〜）: Electron（バージョンは固定）+ steamworks-ffi-node（Koffi FFI・メインプロセスでのみ初期化）。パッケージャーは electron-builder

 ### ディレクトリ構成

@@ -166,7 +168,7 @@
 /apps/client         Web版クライアント（Vite + PixiJS + React）
 /tools/balance       バランス検証ツール（ボットによる自動プレイ。製品コードとは分離）
 /apps/server         APIサーバー（Hono）・定期ジョブ（デイリー生成・相場計算）
-/apps/desktop        Electronラッパー ※フェーズ4から
+/apps/desktop        Electronラッパー（メインプロセス・preload・Steam アダプター・ビルド設定）
```

### 配信と運用（フェーズ3〜）

@@ -183,7 +185,25 @@

- `limits.cpu_ms` は計算量の計測結果（`pnpm perf`）に余裕を持たせた値にする（上限のままにしない。料金の暴走防止）
- IP アドレスは生のまま保存しない。登録時の IP は秘密値つきのハッシュで保存し、保存期間（設定値）を過ぎたら定期ジョブで消す
- D1 のバックアップと復元（時点復元・定期エクスポート）、本番デプロイの手順は docs/ops に書く。本番の秘密情報・API トークンはリポジトリにも開発環境にも置かず、本番デプロイは人が実行する
  -- Web 体験版と製品版はビルド時の設定で切り替える。体験版の通常ランは初期パーツ・7×7・延長戦なし。デイリーは製品版と同条件
  +- 製品版と体験版（Web 体験版・Steam 体験版）はビルド時の設定（`VITE_EDITION=full|demo`）で切り替える。体験版の通常ランは初期パーツ・7×7・延長戦なし。デイリーは製品版と同条件

*

+### デスクトップ版（フェーズ4〜）+
+- レンダラーは `contextIsolation: true`・`sandbox: true`・`nodeIntegration: false`。preload の `contextBridge` で公開する API は最小限にし、IPC のチャンネルと引数を型で固定して、メインプロセス側で検証する
+- ページは `file://` ではなくカスタムプロトコル（`app://`）で配信し、そのレスポンスで CSP を付ける。外部リンクは許可リストのものだけ既定のブラウザで開き、ウィンドウ内の遷移・新規ウィンドウは禁止する
+- Steam の処理はすべてメインプロセスの Steam アダプターに置く。ゲーム本体（`apps/client`）は Steam を直接知らず、「プラットフォーム」インターフェース（Web 版は何もしない実装）経由で呼ぶ
+- Steam が起動していない・初期化に失敗した場合も、オフラインで通常ランが遊べる（実績・認証だけが無効になる）
+- 保存先はインターフェースで切り替える: Web 版は localStorage、デスクトップ版はユーザーデータフォルダ内の JSON ファイル（一時ファイルに書いてから置き換える）。セーブとユーザー設定は Steam Auto-Cloud で同期し、オンラインの認証トークンは同期しない
+- Service Worker（PWA）はデスクトップ版では登録しない +
+### Steam 連携（フェーズ4〜）+
+- 認証: デスクトップ版はメインプロセスで Web API 用チケットを取得し、サーバーの `POST /api/auth/steam` へ送る。サーバーは `ISteamUserAuth/AuthenticateUserTicket` で SteamID を確かめ、紐づくプレイヤー ID とトークンを発行する（既存なら同じ ID）

- - パブリッシャーキーは Workers の Secrets（`STEAM_WEB_API_KEY`）だけに置き、クライアントには含めない。identity 文字列と許可する App ID の一覧は設定値
- - Steam 固有の処理はサーバーのアダプター層に置き、ドメイン層は「外部 ID プロバイダーで確認済みのユーザー」として扱う
- - SteamID は個人を特定しうる情報として扱う。DB には秘密値つきのハッシュだけを保存し、ランキング等で公開しない
- - Steam 認証を通った登録は Turnstile を省略する（レート制限は維持）
    +- 実績: 定義は設定ファイルに集約し、解除の判定は `packages/sim` の純粋関数で行う。Steam への送信はアダプター経由。デイリーの実績はサーバーで検証済みの結果を受け取ってから解除する。体験版では実績を無効にする

### AWS移行を見据えたルール

@@ -196,7 +216,9 @@

## 5. 実装ルール

- 文言はすべて i18n ファイル（`apps/client/src/i18n/ja.json`, `en.json`）に置き、コードに直書きしない。既定言語は日本語。開発者本人が文言を直接編集できるよう、キーは意味がわかる名前にする
  -- 画像はアセットマニフェスト（キー → ファイルパス）経由で参照し、仮素材から本番イラストへ差し替えやすくする。仮素材は単純図形（色分け＋頭文字）でよい
  +- 画像はアセットマニフェスト（キー → ファイルパス）経由で参照し、仮素材から本番イラストへ差し替えやすくする
  +- 素材はスタイルガイド（`docs/art-style.md`）に従う。色はパレットの定義ファイル1か所に集約する
  +- 生成AIで作った素材は `docs/ops/ai-disclosure.md` の一覧に記録する（本番イラストに差し替えたら「人の制作」に更新する）
- `packages/sim` は必ずテストを書く。特に「決定論（同入力→同出力）」「停止性」「各パーツの挙動」
- セーブデータはバージョン番号を持たせ、将来のマイグレーションに備える。バージョンを上げたら変換処理とテストを必ず追加する
- ユーザー設定（音量・演出の強さ・言語）はセーブデータとは別に保存し、こちらにもバージョンを持たせる

```

```
