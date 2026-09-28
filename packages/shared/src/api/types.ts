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

// ---- デイリー ----

export interface DailyInfo {
  /** 例: '2026-09-28'（切り替え時刻の地域の日付） */
  dailyId: string;
  /** デイリーの通し番号（シェア文で使う） */
  number: number;
  /** サーバーが生成した RunConfig（その日の相場・特殊ルール込み）。クライアントはこれでランを作る */
  config: RunConfig;
  /** SHA-256(dailySecret) の16進。締め切り後に公開される dailySecret と照合できる */
  seedCommitment: string;
  /** 受付開始・締め切り（UNIX ミリ秒） */
  opensAt: number;
  closesAt: number;
}

export interface DailySessionView {
  dailyId: string;
  /** ランキング対象か（その日の最初の挑戦だけ true） */
  ranked: boolean;
  /** 確定したシフトごとの操作ログ */
  ops: RunOp[][];
  /** 確定したシフトごとの本番シード（再開時に演出を再現するため） */
  commitSeeds: number[];
  status: 'playing' | 'finished';
}

export interface StartDailyResponse {
  session: DailySessionView;
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
  /** ランが終わったか（全シフトクリア or 脱落） */
  finished: boolean;
}

// ---- ランキング ----

export interface RankingEntry {
  rank: number;
  displayName: string;
  shiftsCleared: number;
  score: string;
  maxChain: number;
  isMe: boolean;
}

export interface RankingResponse {
  dailyId: string;
  total: number;
  top: RankingEntry[];
  /** 自分の前後（自分が参加していなければ空） */
  around: RankingEntry[];
  me: { rank: number; topPercent: number } | null;
}

export interface RevealResponse {
  dailyId: string;
  /** 締め切り後に公開する、その日の秘密値（16進） */
  dailySecret: string;
}

// ---- 相場 ----

export interface MarketResponse {
  /** 相場の日付（デイリー ID と同じ形式） */
  date: string;
  prices: Record<PartId, number>;
  /** 前日の価格（前日比の表示用。履歴がなければ null） */
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
  | 'dailyClosed'
  | 'alreadyPlayed'
  | 'simVersionMismatch'
  | 'invalidSubmission'
  | 'invalidName';

export interface ApiError {
  error: ApiErrorCode;
}
