/**
 * リポジトリ層のインターフェース（DB アクセスはすべてここを通す）
 *
 * ドメインのロジックはこのインターフェースだけに依存し、D1 や SQLite の具体的な型は知らない。
 * 実装は drizzle/（D1・SQLite 共通）と memory/（テスト用）の2つ。
 * AWS に移る場合も、このインターフェースの実装を足すだけでよい。
 */
import type { PartId, RunConfig, RunOp } from '@chain-factory/sim';
import type { ScoreColumns } from '@chain-factory/shared';

export interface PlayerRecord {
  id: string;
  tokenHash: string;
  displayName: string;
  /** 管理用: true ならランキングに表示しない（不適切な名前など） */
  hidden: boolean;
  createdAt: number;
  /** 登録時の IP の HMAC（保存期間を過ぎると null） */
  registeredIpHash: string | null;
}

export interface ExternalAccountRecord {
  provider: ExternalProvider;
  /** 外部 ID の HMAC（外部 ID そのものは保存しない） */
  subjectHash: string;
  playerId: string;
  createdAt: number;
}

export type ExternalProvider = 'steam';

/** 公開前の自動検証の1回分（候補・本番シードの試行番号ごと） */
export interface VerifySample {
  candidate: number;
  sample: number;
  /** 試し始めた（ジョブが途中で止まったら、その試行は不合格として数える: 無限に繰り返さないため） */
  started: boolean;
  /** 全シフトをクリアしたか（終わるまでは null） */
  cleared: boolean | null;
}

export interface WeekRecord {
  id: string;
  number: number;
  candidate: number;
  fallback: boolean;
  verifyState: 'pending' | 'verified' | 'fallback';
  verifySamples: VerifySample[];
  /** 相場を入れる前の RunConfig */
  baseConfig: RunConfig;
  /** 相場を入れて確定した RunConfig（週の切り替えまでは null） */
  config: RunConfig | null;
  marketState: 'pending' | 'market' | 'base';
  seedCommitment: string;
  simVersion: string;
  opensAt: number;
  closesAt: number;
}

export interface AttemptRecord {
  weekId: string;
  /** 挑戦を始めた日（この日の挑戦として数える） */
  dayId: string;
  playerId: string;
  /** 確定したシフトごとの操作ログ */
  ops: RunOp[][];
  /** 次に確定するシフト（= 確定済みのシフト数） */
  shiftIndex: number;
  status: 'playing' | 'finished';
  startedAt: number;
  updatedAt: number;
}

export interface AttemptResultRecord {
  weekId: string;
  dayId: string;
  playerId: string;
  shiftsCleared: number;
  score: ScoreColumns;
  maxChain: number;
  submittedAt: number;
}

/** その週のベスト（ランキングに載る挑戦）と参加日数 */
export interface BestRecord extends AttemptResultRecord {
  daysPlayed: number;
}

/** ランキングの1行（表示名つき） */
export interface RankedBest extends BestRecord {
  displayName: string;
}

/** 確定した順位（表示名・非表示は表示のときに players から読む） */
export interface StandingRecord extends BestRecord {
  rank: number;
  /** 上位○% × 1000 */
  topPercentMilli: number;
}

export interface StandingRow extends StandingRecord {
  displayName: string;
  hidden: boolean;
}

export interface FinalizationRecord {
  weekId: string;
  total: number;
  processed: number;
  finishedAt: number | null;
}

export interface ShopStatRow {
  partId: PartId;
  offered: number;
  bought: number;
}

export interface MarketRow {
  partId: PartId;
  /** 相場倍率 × 1000（整数で保存する。浮動小数点の誤差・DB ごとの違いを避けるため） */
  multiplierMilli: number;
  price: number;
}

export interface PlayerRepository {
  create(player: PlayerRecord): Promise<void>;
  findById(id: string): Promise<PlayerRecord | null>;
  updateName(id: string, displayName: string): Promise<void>;
  /** トークンを発行し直す（外部 ID での再ログイン。前のトークンは使えなくなる） */
  updateTokenHash(id: string, tokenHash: string): Promise<void>;
  /** createdAt が before より前のプレイヤーの IP ハッシュを消し、消した件数を返す */
  clearIpHashesBefore(before: number): Promise<number>;
}

export interface ExternalAccountRepository {
  /** 対応するプレイヤー ID。なければ null */
  findPlayerId(provider: ExternalProvider, subjectHash: string): Promise<string | null>;
  /** 作成できたら true。同じ外部 ID がすでにあれば false（同時に初回ログインした場合に後の方を負けにする） */
  create(record: ExternalAccountRecord): Promise<boolean>;
}

export interface WeekRepository {
  find(id: string): Promise<WeekRecord | null>;
  /** 同じ ID がすでにあれば何もしない（ジョブを何度実行しても同じ結果にするため） */
  createIfAbsent(record: WeekRecord): Promise<void>;
  /** 変わる項目（候補・検証・確定した設定・相場の状態）を書き戻す */
  save(record: WeekRecord): Promise<void>;
}

export interface AttemptRepository {
  find(weekId: string, dayId: string, playerId: string): Promise<AttemptRecord | null>;
  /** 作成できたら true。同じ週×日×プレイヤーがすでにあれば false（1日1回を DB の一意制約で守る） */
  create(attempt: AttemptRecord): Promise<boolean>;
  /**
   * 進行状況を更新する。expectedShiftIndex と一致するときだけ更新し、成否を返す
   * （同じシフトを同時に2回確定しようとした場合に、後の方を失敗させるため）
   */
  update(attempt: AttemptRecord, expectedShiftIndex: number): Promise<boolean>;
  /** その週の自分の挑戦（日の順） */
  listByPlayer(weekId: string, playerId: string): Promise<AttemptRecord[]>;
  /** weekId より前の週の挑戦を消す（保存期間を過ぎたもの）。消した件数 */
  deleteWeeksBefore(weekId: string): Promise<number>;
}

export interface AttemptResultRepository {
  put(result: AttemptResultRecord): Promise<void>;
  find(weekId: string, dayId: string, playerId: string): Promise<AttemptResultRecord | null>;
  deleteWeeksBefore(weekId: string): Promise<number>;
}

export interface BestRepository {
  find(weekId: string, playerId: string): Promise<BestRecord | null>;
  put(best: BestRecord): Promise<void>;
  /** 参加人数（非表示のプレイヤーを除く） */
  count(weekId: string): Promise<number>;
  /** ランキングの並び順で全件（非表示のプレイヤーを除く。暫定ランキングのキャッシュを作るとき） */
  listRanked(weekId: string): Promise<RankedBest[]>;
  /** 並び順で全件（非表示も含む。結果の確定に使う。同順は playerId の順） */
  listAll(weekId: string): Promise<BestRecord[]>;
}

export interface StandingRepository {
  /** まとめて書く（同じ週×プレイヤーがあれば上書き。確定ジョブを再実行しても同じ結果） */
  putMany(rows: StandingRecord[]): Promise<void>;
  find(weekId: string, playerId: string): Promise<StandingRow | null>;
  /** 順位 fromRank 以降を limit 件（順位の順。非表示のプレイヤーも含む: 表示側で除く） */
  list(weekId: string, fromRank: number, limit: number): Promise<StandingRow[]>;
  deleteWeeksBefore(weekId: string): Promise<number>;
}

export interface FinalizationRepository {
  find(weekId: string): Promise<FinalizationRecord | null>;
  save(record: FinalizationRecord): Promise<void>;
  /** 確定が終わった週の ID（新しい順に limit 件） */
  listFinished(limit: number): Promise<string[]>;
}

export interface ShopStatsRepository {
  /** 加算する（検証済みのシフトが確定するたびに呼ぶ） */
  add(weekId: string, rows: ShopStatRow[]): Promise<void>;
  get(weekId: string): Promise<ShopStatRow[]>;
}

export interface MarketRepository {
  put(weekId: string, rows: MarketRow[]): Promise<void>;
  get(weekId: string): Promise<MarketRow[] | null>;
}

export interface Repositories {
  players: PlayerRepository;
  externalAccounts: ExternalAccountRepository;
  weeks: WeekRepository;
  attempts: AttemptRepository;
  attemptResults: AttemptResultRepository;
  bests: BestRepository;
  standings: StandingRepository;
  finalizations: FinalizationRepository;
  shopStats: ShopStatsRepository;
  market: MarketRepository;
}
