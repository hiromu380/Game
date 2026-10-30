import type { Dohyoiri, KojoWord } from '../balance/ceremony';
/**
 * ゲームの状態（すべて JSON にそのまま保存できる形）
 */

export type Style = 'oshi' | 'yotsu' | 'waza';
export type Policy = Style | 'body' | 'rest';
export type Division = 'makuuchi' | 'juryo' | 'makushita' | 'sandanme' | 'jonidan' | 'jonokuchi';
/** 幕内の中の地位（横綱・大関・関脇・小結・前頭） */
export type Title = 'Y' | 'O' | 'S' | 'K' | 'M';
export type Side = 'E' | 'W';

export interface Rank {
  division: Division;
  /** 幕内のときだけ */
  title: Title | null;
  /** 枚目（1 始まり） */
  number: number;
  side: Side;
}

export interface Abilities {
  oshi: number;
  yotsu: number;
  waza: number;
}

/** 1場所の成績 */
export interface BashoRecord {
  bashoIndex: number;
  rank: Rank;
  wins: number;
  losses: number;
  /** 休場（不戦敗を含まない、出なかった日） */
  absences: number;
  yusho: boolean;
}

export interface Career {
  /** 番付に載った場所数 */
  basho: number;
  makuuchiBasho: number;
  /** 十両以上 */
  sekitoriBasho: number;
  /** 小結以上 */
  sanyakuBasho: number;
  wins: number;
  losses: number;
  absences: number;
  makuuchiYusho: number;
  otherYusho: number;
  kinboshi: number;
  /** 三賞の回数 */
  sansho: { shukun: number; kanto: number; gino: number };
  /** 持ち給金（0.5円単位の整数） */
  mochikyukinHalf: number;
  /** 最高位（番付の上からの順位。小さいほど上） */
  highestOrder: number;
  highestRank: Rank | null;
  /** 本人が受け取ったお金の合計（円。演出用） */
  earnings: number;
  /** 決まり手ごとの白星の数（得意技に使う。古いセーブにはない） */
  kimarite?: Record<string, number>;
}

export interface Rikishi {
  id: number;
  name: string;
  stableId: number;
  age: number;
  height: number;
  weight: number;
  abilities: Abilities;
  /** 伸びの上限（隠れた値） */
  talent: number;
  peakAge: number;
  /** けがのしやすさ 0〜1（隠れた値） */
  fragility: number;
  fatigue: number;
  /** けがで休む残りの場所数 */
  injury: number;
  foreign: boolean;
  policy: Policy;
  career: Career;
  /** 直近の成績（新しい順・最大6場所） */
  recent: BashoRecord[];
  /** 大関から落ちた直後の場所（10勝で戻れる） */
  exOzeki: boolean;
  /** けがを押して次の場所に出る（親方の判断。自分の弟子だけ。場所が終わると戻る） */
  playHurt: boolean;
  /** 自分の部屋にいる間の場所ごとの成績（番付の推移のグラフ用。他の部屋の力士は空） */
  track: TrackEntry[];
  /** 次の稽古の伸びの倍率（出稽古など。稽古のあと 1 に戻る） */
  boost: number;
  /** 昇進伝達式の口上の四字熟語（大関・横綱で選んだもの。最後に選んだもの） */
  kojo?: KojoWord;
  /** 横綱の土俵入りの型 */
  dohyoiri?: Dohyoiri;
}

/** 場所ごとの成績（番付の上からの順位つき） */
export interface TrackEntry extends BashoRecord {
  /** 番付の上からの順位（0 = 筆頭）と、そのときの番付の人数 */
  order: number;
  total: number;
}

/** 自分の部屋から引退した力士の記録（歴代の力士） */
export interface Alumnus {
  id: number;
  name: string;
  retiredAge: number;
  retiredBashoIndex: number;
  /** 引退したときの師匠（何代目） */
  generation: number;
  becameOyakata: boolean;
  foreign: boolean;
  career: Career;
  track: TrackEntry[];
}

export interface Stable {
  id: number;
  /** 部屋の名前（親方の年寄名と同じ） */
  name: string;
  isPlayer: boolean;
  /** 架空の部屋の稽古の好み */
  style: Style;
  /** 所属する一門 */
  ichimonId: number;
  /** 自分の系譜の分家（自分の部屋・分家から独立した部屋）。それ以外は null */
  branch: BranchInfo | null;
}

/** 分家の部屋（自動で運営する。師匠は Oyakata として持つ） */
export interface BranchInfo {
  /** 独立元の部屋 */
  parentStableId: number;
  /** 今の師匠の系譜図の節 */
  nodeId: number;
}

/** 一門（部屋のまとまり。すべての親方がどれかに属する） */
export interface Ichimon {
  id: number;
  name: string;
}

/** 年寄名跡（holderId は持っている親方。空きは null） */
export interface ToshiyoriName {
  name: string;
  holderId: number | null;
}

/** 系譜図の節（一門の親方1人） */
export interface FamilyNode {
  id: number;
  /** 年寄名（名跡待ちの間は空） */
  name: string;
  shikona: string;
  /** 師匠の節 */
  parentId: number | null;
  stableId: number;
  /** master: 本家の師匠 / heyatsuki: 部屋付き / waiting: 名跡待ち / branch: 分家の師匠 / gone: 定年・退職・閉鎖 */
  kind: 'master' | 'heyatsuki' | 'waiting' | 'branch' | 'gone';
  /** 本家の師匠・部屋付きの親方なら Oyakata の ID */
  oyakataId: number | null;
  fromBashoIndex: number;
  toBashoIndex: number | null;
  highestRank: Rank | null;
  /** 師匠として出した関取・三役・横綱、幕内優勝 */
  sekitori: number;
  sanyaku: number;
  yokozuna: number;
  makuuchiYusho: number;
}

/**
 * master: 部屋の師匠 / heyatsuki: 部屋付きの親方 / waiting: 資格はあるが名跡の空き待ち（部屋で手伝う）/
 * sanyo: 定年後の再雇用（参与。70歳まで名跡を持ったまま部屋にいる）
 */
export type OyakataRole = 'master' | 'heyatsuki' | 'waiting' | 'sanyo';

export interface Oyakata {
  id: number;
  /** 年寄名（例: 大浜） */
  name: string;
  /** 現役時代の四股名 */
  shikona: string;
  age: number;
  stableId: number;
  role: OyakataRole;
  style: Style;
  /** 現役時代の最高位 */
  highestRank: Rank | null;
  /** 一門の何代目の親方か（自分の部屋の系譜だけ） */
  generation: number | null;
  /** 元の力士 ID（自分の部屋の弟子から親方になったとき） */
  fromRikishiId: number | null;
  /** 名跡待ちになった場所（waiting のときだけ） */
  waitingSince: number | null;
  /** 親方（部屋付き・師匠）になった場所 */
  since: number;
}

/** 場所の間の出来事 */
export type HappeningId =
  | 'supporterParty'
  | 'riceGift'
  | 'tanimachiDinner'
  | 'newSponsor'
  | 'sponsorScandal'
  | 'hometownCheer'
  | 'kenshoOffer'
  | 'merchandise'
  | 'chankoVideo'
  | 'demegeiko'
  | 'rengoKeiko'
  | 'soken'
  | 'kneeWorry'
  | 'guestCoach'
  | 'bulkUp'
  | 'lateStudy'
  | 'strictSenior'
  | 'summerCamp'
  | 'heatWave'
  | 'coldSnap'
  | 'homesick'
  | 'runaway'
  | 'parentsVisit'
  | 'newChanko'
  | 'snsTrouble'
  | 'drinkingTrouble'
  | 'wedding'
  | 'japaneseClass'
  | 'alumniVisit'
  | 'quarrel'
  | 'veteranDoubt'
  | 'leakyRoof'
  | 'managerQuits'
  | 'taxAudit'
  | 'lodging'
  | 'nutritionist'
  | 'chiropractor'
  | 'ichimonMeeting'
  | 'associationDuty'
  | 'kidsSumo'
  | 'tvInterview'
  | 'hospitalVisit'
  | 'disasterRelief'
  | 'overseasEvent'
  | 'newYearVisit'
  | 'setsubun'
  | 'promisingKid'
  | 'collegeStar'
  | 'highSchoolCoach'
  | 'overseasProspect'
  | 'famousDoctor'
  | 'surgery';

/** 設備と契約: 寮・稽古場・トレーナー・スカウト */
export type FacilityId = 'dorm' | 'dojo' | 'trainer' | 'scout';

export type KakunId = 'tachiai' | 'yotsuFirst' | 'craft' | 'chanko' | 'restDay' | 'thrift';

/** 入門希望者（素質は一部だけ見える） */
export interface Candidate {
  id: number;
  name: string;
  age: number;
  height: number;
  weight: number;
  foreign: boolean;
  abilities: Abilities;
  talent: number;
  peakAge: number;
  fragility: number;
  /** 見える素質の目安（1〜5。実際の素質に誤差を加えたもの） */
  scoutGrade: number;
  /** 経歴（例: 中学卒・高校相撲・柔道） */
  background: 'juniorHigh' | 'highSchool' | 'college' | 'otherSport';
}

/** 自分の系譜の1件（何代目の親方が誰か） */
export interface LineageEntry {
  generation: number;
  oyakataId: number;
  name: string;
  shikona: string;
  fromBashoIndex: number;
  toBashoIndex: number | null;
  /** その代に出した関取・三役・横綱の数、幕内優勝 */
  sekitori: number;
  sanyaku: number;
  yokozuna: number;
  makuuchiYusho: number;
}

export type GameOverReason = 'noSuccessor' | 'bankrupt';

export interface Pending {
  /** 入門希望者（場所前に受け入れるか決める） */
  candidates: Candidate[];
  /** 引退を申し出た自分の弟子 */
  retireRequests: number[];
  /** 定年: 跡継ぎを選ぶ（候補の親方 ID） */
  successor: number[] | null;
  /** 家訓の候補（代替わりのとき） */
  kakun: KakunId[] | null;
  /** 部屋付きの親方からの独立の申し出（親方 ID） */
  independence: number | null;
  /** 跡継ぎがいないとき、継ぐことのできる分家の部屋 */
  takeOver: number[] | null;
  /** 場所の間の出来事（target はけがの弟子など、出来事の相手） */
  happening: { id: HappeningId; target: number | null } | null;
}

export interface PlayerState {
  stableId: number;
  oyakataId: number;
  generation: number;
  stableMoney: number;
  personalMoney: number;
  prestige: number;
  kakun: KakunId[];
  lineage: LineageEntry[];
  /** 系譜図（一門のすべての親方） */
  family: FamilyNode[];
  /** 設備と契約のレベル（0 = なし） */
  facilities: Record<FacilityId, number>;
  /** 部屋の歴代の力士（引退した弟子） */
  alumni: Alumnus[];
  /** ちゃんこの方針 */
  diet: Diet;
  /** 部屋の人（元弟子の若者頭・世話人） */
  staff: StaffMember[];
}

export type Diet = 'standard' | 'hearty' | 'balanced' | 'frugal';
export type StaffRole = 'wakaimonogashira' | 'sewanin';

export interface StaffMember {
  role: StaffRole;
  /** 元弟子（Alumnus）の ID */
  alumnusId: number;
  name: string;
  age: number;
  /** 腕前 1〜3（最高位で決まる: 幕内 3・十両 2・幕下 1） */
  skill: number;
  since: number;
}

export interface GameState {
  version: number;
  seed: number;
  /** 何場所目か（0 = 1年目の初場所） */
  bashoIndex: number;
  rikishi: Rikishi[];
  /** 番付（上から順の力士 ID） */
  banzuke: number[];
  /** 幕内の地位（横綱・大関・関脇・小結）。ないものは前頭 */
  titles: Record<number, Title>;
  stables: Stable[];
  oyakata: Oyakata[];
  player: PlayerState;
  /** 年寄名跡（105） */
  names: ToshiyoriName[];
  /** 一門（5つ） */
  ichimon: Ichimon[];
  nextId: number;
  pending: Pending;
  gameOver: GameOverReason | null;
  /** 直近の場所の結果（画面に出す） */
  lastReport: BashoReport | null;
  /** 部屋の日誌（古い順） */
  journal: JournalEntry[];
  /** 最近起きた出来事（同じ出来事が続かないように） */
  happeningLog: { id: HappeningId; bashoIndex: number }[];
}

/** 日誌の1行。bashoIndex は出来事が起きた場所（場所前の出来事は、これから取る場所） */
export type JournalEntry = { bashoIndex: number } & JournalEvent;

export type JournalEvent =
  | { kind: 'open'; stable: string; shikona: string }
  | { kind: 'join'; shikona: string; age: number }
  | {
      kind: 'promote';
      shikona: string;
      stable: string;
      to: 'Y' | 'O' | 'sekitori' | 'makuuchi';
    }
  | { kind: 'yusho'; shikona: string; stable: string; division: Division; wins: number }
  | { kind: 'sansho'; shikona: string; prize: 'shukun' | 'kanto' | 'gino' }
  | {
      kind: 'retire';
      shikona: string;
      age: number;
      highest: Rank | null;
      /** 親方として残ったときの名跡（名跡待ちは空文字） */
      oyakata: string | null;
    }
  /** name: 出来事の当人の四股名 / hit: 確率の結果が起きたか（確率のない選択肢は持たない） */
  | { kind: 'happening'; id: HappeningId; option: string; name?: string; hit?: boolean }
  | { kind: 'independence'; stable: string; shikona: string }
  | { kind: 'successor'; generation: number; stable: string; shikona: string }
  | { kind: 'kakun'; id: KakunId }
  | { kind: 'facility'; id: FacilityId; level: number }
  | { kind: 'branchSucceeded'; stable: string; shikona: string }
  | { kind: 'branchClosed'; stable: string }
  | { kind: 'diet'; diet: Diet }
  | { kind: 'kojo'; shikona: string; to: 'O' | 'Y'; word: KojoWord; dohyoiri?: Dohyoiri }
  | { kind: 'staffHire'; role: StaffRole; name: string }
  | { kind: 'staffLeave'; role: StaffRole; name: string; retired: boolean }
  /** セーブの変換で作った日誌の始まり（これより前の細かい出来事は残っていない） */
  | { kind: 'earlier' };

export interface BoutResult {
  day: number;
  eastId: number;
  westId: number;
  winnerId: number;
  kimarite: string;
  /** 懸賞の本数 */
  kensho: number;
  fusen: boolean;
}

export interface MoneyLine {
  key: string;
  amount: number;
}

export interface BashoReport {
  bashoIndex: number;
  /** 各段の優勝（力士 ID） */
  yusho: Partial<Record<Division, number>>;
  /** 自分の弟子の成績 */
  mine: { id: number; record: BashoRecord; bouts: BoutResult[] }[];
  /** 新しい横綱・大関・関取など（自分の部屋以外も） */
  promotions: { id: number; to: 'Y' | 'O' | 'sekitori' | 'makuuchi' }[];
  retired: { id: number; name: string; stableId: number; becameOyakata: boolean }[];
  injuries: number[];
  /** 自分の弟子の番付の上がり下がり（この場所の地位 → 次の番付。引退したら null） */
  banzukeChanges: { id: number; from: Rank; to: Rank | null }[];
  /** 場所の後の巡業（なければ null） */
  jungyo: 'spring' | 'summer' | 'autumn' | 'winter' | null;
  /** 三賞（力士 ID。該当者なしは空） */
  sansho: { shukun: number[]; kanto: number[]; gino: number[] };
  /** 幕内の優勝決定戦に出た力士（なければ null） */
  playoff: number[] | null;
  income: MoneyLine[];
  expenses: MoneyLine[];
  personal: MoneyLine[];
}
