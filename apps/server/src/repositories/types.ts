/**
 * リポジトリ層のインターフェース（DB アクセスはすべてここを通す）
 *
 * ドメインのロジックはこのインターフェースだけに依存し、D1 や SQLite の具体的な型は知らない。
 * 実装は drizzle/（D1・SQLite 共通）と memory/（テスト用）の2つ。
 * AWS に移る場合も、このインターフェースの実装を足すだけでよい。
 */
import type { PartId, RunConfig, RunOp } from '@chain-factory/sim';
import type { RankKey, ScoreColumns } from '@chain-factory/shared';

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

export interface DailyRecord {
  id: string;
  number: number;
  config: RunConfig;
  seedCommitment: string;
  simVersion: string;
  opensAt: number;
  closesAt: number;
}

export interface SessionRecord {
  dailyId: string;
  playerId: string;
  /** 確定したシフトごとの操作ログ */
  ops: RunOp[][];
  /** 次に確定するシフト（= 確定済みのシフト数） */
  shiftIndex: number;
  status: 'playing' | 'finished';
  /** ランキング対象か（その日の最初の挑戦） */
  ranked: boolean;
  updatedAt: number;
}

export interface ResultRecord {
  dailyId: string;
  playerId: string;
  shiftsCleared: number;
  score: ScoreColumns;
  maxChain: number;
  submittedAt: number;
}

/** ランキングの1行（表示名つき） */
export interface RankedRow extends ResultRecord {
  displayName: string;
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
  /** createdAt が before より前のプレイヤーの IP ハッシュを消し、消した件数を返す */
  clearIpHashesBefore(before: number): Promise<number>;
}

export interface DailyRepository {
  find(id: string): Promise<DailyRecord | null>;
  /** 同じ ID がすでにあれば何もしない（ジョブを何度実行しても同じ結果にするため） */
  createIfAbsent(record: DailyRecord): Promise<void>;
}

export interface SessionRepository {
  find(dailyId: string, playerId: string): Promise<SessionRecord | null>;
  /** 作成できたら true。同じデイリー×プレイヤーがすでにあれば false（1日1回を DB の一意制約で守る） */
  create(session: SessionRecord): Promise<boolean>;
  /**
   * 進行状況を更新する。expectedShiftIndex と一致するときだけ更新し、成否を返す
   * （同じシフトを同時に2回確定しようとした場合に、後の方を失敗させるため）
   */
  update(session: SessionRecord, expectedShiftIndex: number): Promise<boolean>;
}

export interface ResultRepository {
  put(result: ResultRecord): Promise<void>;
  find(dailyId: string, playerId: string): Promise<ResultRecord | null>;
  /** 参加人数（非表示のプレイヤーを除く） */
  count(dailyId: string): Promise<number>;
  /** key より上位の件数（非表示のプレイヤーを除く）。順位 = この値 + 1 */
  countAbove(dailyId: string, key: RankKey): Promise<number>;
  /** 上位から offset 件飛ばして limit 件（並び順はランキングと同じ） */
  list(dailyId: string, offset: number, limit: number): Promise<RankedRow[]>;
}

export interface ShopStatsRepository {
  /** 加算する（検証済みのランが終わるたびに呼ぶ） */
  add(dailyId: string, rows: ShopStatRow[]): Promise<void>;
  get(dailyId: string): Promise<ShopStatRow[]>;
}

export interface MarketRepository {
  put(date: string, rows: MarketRow[]): Promise<void>;
  get(date: string): Promise<MarketRow[] | null>;
}

export interface Repositories {
  players: PlayerRepository;
  dailies: DailyRepository;
  sessions: SessionRepository;
  results: ResultRepository;
  shopStats: ShopStatsRepository;
  market: MarketRepository;
}
