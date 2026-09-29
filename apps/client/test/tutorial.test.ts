import { createInitialMeta, createRun, metaToModifiers } from '@chain-factory/sim';
import { describe, expect, it } from 'vitest';
import { TUTORIAL_CONFIG } from '../src/config/tutorial';
import {
  createGameState,
  gameReducer,
  type GameAction,
  type GameState,
} from '../src/state/gameReducer';
import {
  advanceTutorial,
  gearAvailability,
  startTutorial,
  tutorialCell,
  updateTutorial,
  type TutorialState,
} from '../src/state/tutorial';

/** ガイド用のラン（初期パーツ・7×7・決まったシード） */
const tutorialRun = () =>
  createRun(TUTORIAL_CONFIG.seed, { meta: metaToModifiers(createInitialMeta()), tutorial: true });

/** 操作してからガイドを進める */
function play(game: GameState, tutorial: TutorialState, ...actions: GameAction[]) {
  const next = actions.reduce(gameReducer, game);
  const guide = updateTutorial(tutorial, {
    run: next.run,
    lastTrialScore: next.lastResult?.score ?? null,
    playing: next.playback !== null,
  });
  return { game: next, tutorial: guide };
}

const { row, columns } = TUTORIAL_CONFIG;
const place = (partId: 'switch' | 'gear' | 'dock', x: number): GameAction[] => [
  { type: 'selectInventory', partId },
  { type: 'clickCell', x, y: row },
];
const trial: GameAction[] = [
  { type: 'startTrial' },
  { type: 'playbackFinished' },
  { type: 'closePlayback' },
];

describe('初回ガイド', () => {
  it('案内どおりに操作すると、1シフト目のノルマに届いて最後まで進む', () => {
    let game = createGameState(tutorialRun(), createInitialMeta());
    let tutorial = advanceTutorial(startTutorial(game.run), game.run);
    expect(tutorial.step).toBe('placeSwitch');
    expect(tutorialCell('placeSwitch')).toEqual({ x: columns.switch, y: row });

    ({ game, tutorial } = play(game, tutorial, ...place('switch', columns.switch)));
    ({ game, tutorial } = play(game, tutorial, ...place('gear', columns.gear)));
    ({ game, tutorial } = play(game, tutorial, ...place('dock', columns.dock)));
    expect(tutorial.step).toBe('trial');

    ({ game, tutorial } = play(game, tutorial, ...trial));
    expect(tutorial.step).toBe('buyGear');

    const gearOffer = game.run.shop.findIndex((o) => o.partId === 'gear');
    expect(gearOffer).toBeGreaterThanOrEqual(0);
    ({ game, tutorial } = play(game, tutorial, { type: 'buy', offerIndex: gearOffer }));
    expect(tutorial.step).toBe('moveDock');

    ({ game, tutorial } = play(game, tutorial, {
      type: 'movePart',
      from: { x: columns.dock, y: row },
      to: { x: columns.dockMoved, y: row },
    }));
    ({ game, tutorial } = play(game, tutorial, ...place('gear', columns.secondGear)));
    expect(tutorial.step).toBe('trialAgain');

    ({ game, tutorial } = play(game, tutorial, ...trial));
    expect(tutorial.step).toBe('commit');

    const committed = play(
      game,
      tutorial,
      { type: 'startCommit' },
      { type: 'playbackFinished' },
      { type: 'closePlayback' },
    );
    game = committed.game;
    tutorial = committed.tutorial;
    expect(game.run.history[0]?.cleared).toBe(true);
    expect(tutorial.step).toBe('finish');
    expect(advanceTutorial(tutorial, game.run).step).toBe('done');
  });

  it('試運転で出荷口に届かなければ、助言を出して同じ手順にとどまる', () => {
    const game = createGameState(tutorialRun(), createInitialMeta());
    const start: TutorialState = { step: 'trial', trialsAtStep: 0, hint: null };
    const { tutorial } = play(game, start, ...trial);
    expect(tutorial).toMatchObject({ step: 'trial', hint: 'notReached' });
  });

  it('再生中は試運転の結果を見ない', () => {
    const game = gameReducer(createGameState(tutorialRun(), createInitialMeta()), {
      type: 'startTrial',
    });
    const tutorial: TutorialState = { step: 'trial', trialsAtStep: 0, hint: null };
    expect(
      updateTutorial(tutorial, {
        run: game.run,
        lastTrialScore: game.lastResult?.score ?? null,
        playing: true,
      }),
    ).toBe(tutorial);
  });

  it('ガイドを飛ばして本番まで進めたら、締めのあいさつへ', () => {
    let game = createGameState(tutorialRun(), createInitialMeta());
    game = [
      ...place('switch', 0),
      { type: 'startCommit' } as const,
      { type: 'playbackFinished' } as const,
      { type: 'closePlayback' } as const,
    ].reduce(gameReducer, game);
    const tutorial: TutorialState = { step: 'placeGear', trialsAtStep: 0, hint: null };
    expect(
      updateTutorial(tutorial, { run: game.run, lastTrialScore: null, playing: false }).step,
    ).toBe('finish');
  });

  it('ガイドのランの最初のショップには増幅ギアが並ぶ', () => {
    expect(gearAvailability(tutorialRun())).toBe('buy');
  });

  it('リロールなどでギアがなくなったら、リロールを勧める。予算が足りなければ自由に工夫してもらう', () => {
    const run = tutorialRun();
    const noGear = {
      ...run,
      shop: run.shop.map((o) => (o.partId === 'gear' ? { ...o, partId: 'coil' as const } : o)),
    };
    expect(gearAvailability(noGear)).toBe('reroll');
    expect(gearAvailability({ ...noGear, budget: 1 })).toBe('stuck');
    expect(gearAvailability({ ...run, budget: 1 })).toBe('stuck');
  });
});
