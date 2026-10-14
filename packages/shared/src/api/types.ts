/**
 * API のリクエスト・レスポンスの型（クライアントとサーバーで共有する）
 *
 * - 認証: 初回に発行されたトークンを `Authorization: Bearer <token>` で送る
 * - スコアは JSON で扱えるよう文字列（bigint の10進表記）で送る
 * - エラーは { error: ApiErrorCode } で返す。不正な提出の詳しい理由はクライアントに返さない
 */
import type { PartId, RunConfig, RunOp } from '@chain-factory/sim';

// ---- プレイヤー ----

/** 匿名登録（人間確認のトークンを添える） */
export interface RegisterPlayerRequest {
  turnstileToken: string;
}

export interface RegisterPlayerResponse {
  playerId: string;
  /** 以後の認証に使う秘密トークン（サーバーはハッシュだけを保存する） */
  token: string;
  displayName: string;
}

/**
 * Steam 版の登録・再ログイン（デスクトップ版のみ。人間確認の代わりに Steam のチケットで本人確認する）
 * 同じ Steam アカウントなら同じプレイヤー ID に新しいトークンを発行する（応答は匿名登録と同じ形）
 */
export interface SteamAuthRequest {
  /** 起動している Steam の App ID（製品版・体験版・開発用） */
  appId: number;
  /** Web API 用の認証チケット（16進） */
  ticket: string;
}

export interface UpdateNameRequest {
  displayName: string;
}

export interface UpdateNameResponse {
  displayName: string;
}

// ---- 週替わりチャレンジ ----

/** 今週の自分の挑戦（1日1回） */
export interface WeeklyDayStatus {
  dayId: string;
  status: 'playing' | 'finished';
  shiftsCleared: number;
  /** その日の出荷量（10進の文字列） */
  score: string;
}

/** 今週の自分の状況（ログインしているときだけ） */
export interface WeeklyMe {
  /** その週のベスト（まだ挑戦していなければ null） */
  best: { dayId: string; shiftsCleared: number; score: string } | null;
  /** 挑戦した日（日の順） */
  days: WeeklyDayStatus[];
  /** 今日の挑戦の状態（none: まだ / playing: 途中 / finished: 終わった） */
  today: 'none' | 'playing' | 'finished';
}

export interface WeeklyInfo {
  /** 週の ID（週の始まりの日 'YYYY-MM-DD'） */
  weekId: string;
  /** 週の通し番号（シェア文で使う） */
  number: number;
  /** サーバーが生成した RunConfig（その週の相場・特殊ルール込み）。クライアントはこれでランを作る */
  config: RunConfig;
  /** 盤面の候補番号・代替設定か（ランシードが変わる: createWeeklyRun に渡す） */
  candidate: number;
  fallback: boolean;
  /** SHA-256(weekSecret) の16進。週の締め切り後に公開される weekSecret と照合できる */
  seedCommitment: string;
  /** 週の受付開始・締め切り（UNIX ミリ秒） */
  opensAt: number;
  closesAt: number;
  /** 今日の日の ID と、次に挑戦できる時刻（明日の区切り。UNIX ミリ秒） */
  today: string;
  nextDayAt: number;
  /** サーバーの現在時刻（UNIX ミリ秒。残り時間の表示をサーバーの時計に合わせる） */
  serverNow: number;
  me: WeeklyMe | null;
}

export interface WeeklyAttemptView {
  weekId: string;
  dayId: string;
  /** 確定したシフトごとの操作ログ */
  ops: RunOp[][];
  /** 確定したシフトごとの本番シード（再開時に演出を再現するため） */
  commitSeeds: number[];
  status: 'playing' | 'finished';
}

export interface StartAttemptResponse {
  attempt: WeeklyAttemptView;
}

/** 本番: 前回の本番以降の操作ログを送り、このシフトを確定する */
export interface CommitRequest {
  simVersion: string;
  /** 確定するシフト（0 始まり）。サーバーの進行状況と一致しなければ拒否 */
  shiftIndex: number;
  ops: RunOp[];
}

export interface CommitResponse {
  /** このシフトの本番シード。クライアントはこれで simulate を実行して演出する */
  seed: number;
  /** サーバーが計算した出荷量（クライアントの計算と一致するはず） */
  score: string;
  cleared: boolean;
  /** その日の挑戦が終わったか（全シフトクリア or 脱落） */
  finished: boolean;
  /** この挑戦で今週のベストを更新したか */
  newBest: boolean;
}

// ---- ランキング ----

export interface RankingEntry {
  rank: number;
  displayName: string;
  shiftsCleared: number;
  /** 出荷量（10進の文字列）。暫定ランキングの丸め表示では上 3 桁だけ残して 0 で埋めた値 */
  score: string;
  /** 参加日数（確定ランキングのみ。暫定では 0） */
  daysPlayed: number;
  isMe: boolean;
}

/** 当週の暫定ランキング（他人の配置・操作ログは含めない） */
export interface ProvisionalRankingResponse {
  weekId: string;
  provisional: true;
  /** 参加人数 */
  total: number;
  /** トップの出し方（full: 実数 / rounded: 丸め / hidden: 出さない） */
  topMode: 'full' | 'rounded' | 'hidden';
  top: RankingEntry[];
  /** 自分の前後（自分が参加していなければ空。topMode が hidden なら空） */
  around: RankingEntry[];
  me: { rank: number; topPercent: number } | null;
  /** この並びを作った時刻（UNIX ミリ秒。最大でキャッシュの間隔だけ古い） */
  updatedAt: number;
}

/** 確定した結果発表（締め切り後の週だけ） */
export interface WeeklyResultsResponse {
  weekId: string;
  number: number;
  provisional: false;
  total: number;
  top: RankingEntry[];
  around: RankingEntry[];
  me: {
    rank: number;
    topPercent: number;
    shiftsCleared: number;
    score: string;
    daysPlayed: number;
  } | null;
  /** 締め切り後に公開する、その週の秘密値（16進。seedCommitment と照合できる） */
  weekSecret: string;
}

/** 結果発表のリプレイ（上位の挑戦の操作ログと本番シード。締め切り後の週だけ） */
export interface ReplayResponse {
  weekId: string;
  rank: number;
  displayName: string;
  dayId: string;
  config: RunConfig;
  candidate: number;
  fallback: boolean;
  ops: RunOp[][];
  commitSeeds: number[];
}

/** 結果発表の一覧（タイトルの未読バッジ・過去週の切り替え） */
export interface WeeklyLatestResponse {
  /** 結果が確定した週の ID（新しい順。保存期間内） */
  finished: string[];
}

// ---- 相場 ----

export interface MarketResponse {
  /** 相場が適用される週の ID */
  weekId: string;
  prices: Record<PartId, number>;
  /** 前週の価格（前週比の表示用。履歴がなければ null） */
  previous: Record<PartId, number> | null;
}

// ---- エラー ----

export type ApiErrorCode =
  | 'badRequest'
  | 'unauthorized'
  /** 人間確認（Turnstile）に失敗した（登録時のみ） */
  | 'humanCheckFailed'
  /** 許可されていない（Steam 認証: 許可リストにない App ID） */
  | 'forbidden'
  /** 外部サービス（Steam の認証 API）に問い合わせられない。時間をおいて再試行する */
  | 'serviceUnavailable'
  | 'rateLimited'
  | 'notFound'
  /** 受付期間外（挑戦の日・週が締め切られた） */
  | 'challengeClosed'
  /** 今日はもう挑戦した（1日1回） */
  | 'alreadyPlayed'
  /** 当週・未来週のため、まだ公開されていない（ランキング・リプレイ・秘密値） */
  | 'notPublished'
  /** 締め切り後、結果を集計中（少し待って取り直す） */
  | 'tallying'
  /** 古いクライアント（旧 API）。アプリの更新を促す */
  | 'clientOutdated'
  | 'simVersionMismatch'
  | 'invalidSubmission'
  | 'invalidName';

export interface ApiError {
  error: ApiErrorCode;
}
