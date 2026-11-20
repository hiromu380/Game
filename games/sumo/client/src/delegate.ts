/**
 * 任せる（早送り）: 場所を続けて進め、親方の判断が要ることが起きたら止まる（純粋関数）。
 * 場所前の4週間は「いつも通り」、中日の判断は「そのまま」で進む。任せた間の場所ごとの要点を返す
 */
import {
  advanceBasho,
  isBlocked,
  projectLedger,
  sumMoney as sum,
  type GameState,
} from '@ichimon/sim';

export type StopReason =
  'gameOver' | 'decision' | 'retire' | 'injury' | 'promotion' | 'candidate' | 'happening' | 'money';

/** 任せた間の1場所の要点 */
export interface DelegateStep {
  bashoIndex: number;
  kachikoshi: number;
  total: number;
  /** 番付が上がった・下がった弟子の数 */
  up: number;
  down: number;
  /** 部屋の口座の動き */
  net: number;
  /** 自分の弟子の昇進（関取以上） */
  promotions: { id: number; to: 'Y' | 'O' | 'sekitori' | 'makuuchi' }[];
  /** 自分の弟子のけが */
  injuries: number[];
}

export interface DelegateResult {
  game: GameState;
  steps: DelegateStep[];
  /** 止まったわけ（最後まで進んだら null） */
  stop: StopReason | null;
}

/** 見立ての星がこれ以上の入門希望者が来たら止まる */
export const CANDIDATE_STOP_GRADE = 3;
/** お金が尽きるまでの場所の数がこれ以下になったら止まる */
export const MONEY_STOP_RUNWAY = 3;

function stepOf(prev: GameState, next: GameState): DelegateStep {
  const report = next.lastReport!;
  const mine = (id: number) =>
    next.rikishi.find((r) => r.id === id)?.stableId === next.player.stableId;
  const rankOrder = (k: { division: string; title: string | null; number: number }) =>
    ['makuuchi', 'juryo', 'makushita', 'sandanme', 'jonidan', 'jonokuchi'].indexOf(k.division) *
      1000 +
    (k.title ? 'YOSKM'.indexOf(k.title) * 100 : 0) +
    k.number;
  return {
    bashoIndex: report.bashoIndex,
    kachikoshi: report.mine.filter(
      (m) => m.record.wins * 2 > m.record.wins + m.record.losses + m.record.absences,
    ).length,
    total: report.mine.length,
    up: report.banzukeChanges.filter((c) => c.to && rankOrder(c.to) < rankOrder(c.from)).length,
    down: report.banzukeChanges.filter((c) => c.to && rankOrder(c.to) > rankOrder(c.from)).length,
    net: sum(report.income) - sum(report.expenses),
    promotions: report.promotions.filter((p) => mine(p.id)),
    injuries: report.injuries.filter((id) =>
      prev.rikishi.some((r) => r.id === id && r.stableId === prev.player.stableId),
    ),
  };
}

/** 進めた後、止まるわけがあれば返す */
export function stopReason(
  prev: GameState,
  next: GameState,
  step: DelegateStep,
): StopReason | null {
  if (next.gameOver) return 'gameOver';
  if (isBlocked(next) || next.pending.independence !== null || next.pending.election !== null)
    return 'decision';
  if (next.pending.retireRequests.length > 0) return 'retire';
  if (step.injuries.length > 0 || next.pending.treatment.length > 0) return 'injury';
  if (step.promotions.length > 0) return 'promotion';
  const before = new Set(prev.pending.candidates.map((c) => c.id));
  if (
    next.pending.candidates.some((c) => !before.has(c.id) && c.scoutGrade >= CANDIDATE_STOP_GRADE)
  )
    return 'candidate';
  if (next.pending.happening !== null) return 'happening';
  const runway = projectLedger(next).runway;
  if (runway !== null && runway <= MONEY_STOP_RUNWAY) return 'money';
  return null;
}

/** 最大 count 場所を任せる */
export function delegate(start: GameState, count: number): DelegateResult {
  let game = start;
  const steps: DelegateStep[] = [];
  for (let i = 0; i < count; i++) {
    if (game.gameOver || isBlocked(game)) break;
    const next = advanceBasho(game);
    const step = stepOf(game, next);
    steps.push(step);
    const stop = stopReason(game, next, step);
    game = next;
    if (stop) return { game, steps, stop };
  }
  return { game, steps, stop: null };
}
