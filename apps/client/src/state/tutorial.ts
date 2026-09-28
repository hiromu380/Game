/**
 * 初回ガイドの進み方（画面に依存しない純粋な関数。表示は ui/TutorialGuide.tsx）
 *
 * ゲームの状態（盤面・手持ち・試運転の結果・本番）を見て、条件を満たしたら次の手順へ進む。
 * プレイヤーの操作はガイドの外でも普段どおりできる（ガイドは案内するだけで、操作を止めない）。
 */
import {
  getCurrentShift,
  getPart,
  getRerollCost,
  scoreCompare,
  scoreOf,
  type PartId,
  type RunState,
  type Score,
} from '@chain-factory/sim';
import { TUTORIAL_CONFIG } from '../config/tutorial';

export type TutorialStep =
  | 'intro'
  | 'placeSwitch'
  | 'placeGear'
  | 'placeDock'
  | 'trial'
  | 'buyGear'
  | 'moveDock'
  | 'placeSecondGear'
  | 'trialAgain'
  | 'commit'
  | 'finish'
  | 'done';

export interface TutorialState {
  step: TutorialStep;
  /** この手順に入ったときの試運転回数（手順の中で試運転したかを見分ける） */
  trialsAtStep: number;
  /** 試運転がうまくいかなかったときの助言 */
  hint: 'notReached' | 'short' | null;
}

export interface TutorialContext {
  run: RunState;
  /** 最後の試運転の出荷量（まだなら null） */
  lastTrialScore: Score | null;
  /** 再生中（試運転の結果は再生が終わってから見る） */
  playing: boolean;
}

export function startTutorial(run: RunState): TutorialState {
  return { step: 'intro', trialsAtStep: run.trialCount, hint: null };
}

const { row, columns } = TUTORIAL_CONFIG;
const partAt = (run: RunState, x: number) => getPart(run.board, x, row)?.id ?? null;

/** 手順で「ここに置く」マス（盤面で光らせる） */
export function tutorialCell(step: TutorialStep): { x: number; y: number } | null {
  const x = {
    placeSwitch: columns.switch,
    placeGear: columns.gear,
    placeDock: columns.dock,
    moveDock: columns.dockMoved,
    placeSecondGear: columns.secondGear,
  }[step as string];
  return x === undefined ? null : { x, y: row };
}

/** 手順で選ぶパーツ（手持ち・ショップで光らせる） */
export function tutorialPart(step: TutorialStep): PartId | null {
  switch (step) {
    case 'placeSwitch':
      return 'switch';
    case 'placeGear':
    case 'placeSecondGear':
    case 'buyGear':
      return 'gear';
    case 'placeDock':
      return 'dock';
    default:
      return null;
  }
}

/** 今の手順を終えたか。終えていなければ、そのまま（助言つき）の状態を返す */
function check(state: TutorialState, ctx: TutorialContext): TutorialState | 'next' {
  const { run } = ctx;
  switch (state.step) {
    case 'placeSwitch':
      return partAt(run, columns.switch) === 'switch' ? 'next' : state;
    case 'placeGear':
      return partAt(run, columns.gear) === 'gear' ? 'next' : state;
    case 'placeDock':
      return partAt(run, columns.dock) === 'dock' ? 'next' : state;
    case 'buyGear':
      return (run.inventory.gear ?? 0) > 0 ? 'next' : state;
    case 'moveDock':
      return partAt(run, columns.dockMoved) === 'dock' ? 'next' : state;
    case 'placeSecondGear':
      return partAt(run, columns.secondGear) === 'gear' ? 'next' : state;
    case 'trial':
    case 'trialAgain': {
      if (ctx.playing || run.trialCount === state.trialsAtStep || ctx.lastTrialScore === null) {
        return state;
      }
      const score = ctx.lastTrialScore;
      const reached = scoreCompare(score, scoreOf(0)) > 0;
      const met = scoreCompare(score, scoreOf(getCurrentShift(run).quota)) >= 0;
      // 1回目は「出荷口に届けば」次へ（ノルマに足りないのは想定どおり）。2回目はノルマに届いたら次へ
      if (state.step === 'trial' ? reached : met) return 'next';
      return { ...state, trialsAtStep: run.trialCount, hint: reached ? 'short' : 'notReached' };
    }
    case 'commit':
      return run.history.length > 0 ? 'next' : state;
    default:
      // intro・finish はボタンで進む
      return state;
  }
}

const ORDER: TutorialStep[] = [
  'intro',
  'placeSwitch',
  'placeGear',
  'placeDock',
  'trial',
  'buyGear',
  'moveDock',
  'placeSecondGear',
  'trialAgain',
  'commit',
  'finish',
  'done',
];

function nextStep(state: TutorialState, run: RunState): TutorialState {
  const step = ORDER[Math.min(ORDER.indexOf(state.step) + 1, ORDER.length - 1)]!;
  return { step, trialsAtStep: run.trialCount, hint: null };
}

/** ゲームの状態が変わったら呼ぶ。満たしている手順はまとめて進める */
export function updateTutorial(state: TutorialState, ctx: TutorialContext): TutorialState {
  // ガイドの手順を飛ばして本番まで進めたら、締めのあいさつへ
  if (ctx.run.history.length > 0 && ORDER.indexOf(state.step) < ORDER.indexOf('finish')) {
    return { step: 'finish', trialsAtStep: ctx.run.trialCount, hint: null };
  }
  let current = state;
  for (;;) {
    const result = check(current, ctx);
    if (result !== 'next') return result;
    current = nextStep(current, ctx.run);
  }
}

/** 「次へ」ボタン（intro・finish） */
export function advanceTutorial(state: TutorialState, run: RunState): TutorialState {
  return state.step === 'intro' || state.step === 'finish' ? nextStep(state, run) : state;
}

/**
 * ギアを買う手順で、ショップの状況に合わせた案内（リロールなどでギアが並んでいないこともある）
 * - buy: 買えるギアが並んでいる
 * - reroll: ギアはないが、リロールで引き直せる
 * - stuck: ギアが並んでおらずリロールもできない（予算不足など）。自由に工夫してもらう
 */
export function gearAvailability(run: RunState): 'buy' | 'reroll' | 'stuck' {
  const gear = run.shop.find((o) => o.partId === 'gear' && !o.sold);
  if (gear) return run.budget >= gear.price ? 'buy' : 'stuck';
  const reroll = getRerollCost(run);
  // リロールしてもギアを買えるだけの予算が残らないなら、引き直しは勧めない
  const gearPrice = run.config.economy.prices.gear;
  return reroll !== null && run.budget >= reroll + gearPrice ? 'reroll' : 'stuck';
}
