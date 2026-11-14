/**
 * 見本の工場を再生する盤面（操作はできない）。
 * - loop: 再生が終わったら少し間をおいて最初から（タイトル画面の背景）
 * - start を変えると再生を始める（チュートリアルの締めで、スイッチを押したら再生）
 * 演出の強さ・揺れ・点滅の設定はゲーム画面と同じものに従う
 */
import { DEFAULT_RULES, type SimResult } from '@chain-factory/sim';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { BoardViewState } from '../board/BoardRenderer';
import { PixiBoard } from '../board/PixiBoard';
import { useBoardLabels } from '../board/useBoardLabels';
import { useSettings } from '../settings/SettingsContext';
import { buildShowcase, runShowcase, type ShowcaseBoard } from './boards';

/** ループするときの、再生が終わってから次を始めるまでの間（ミリ秒） */
const LOOP_PAUSE_MS = 2600;
const noop = () => {};

interface Props {
  def: ShowcaseBoard;
  /** 再生する回（0 は再生しない。数が変わるたびに最初から再生する） */
  start: number;
  loop?: boolean;
  muted?: boolean;
  onFinish?: () => void;
}

export function ShowcasePlayer({ def, start, loop = false, muted = false, onFinish }: Props) {
  const labels = useBoardLabels();
  const { settings } = useSettings();
  const effectSettings = useMemo(
    () => ({
      strength: settings.effects,
      shake: settings.shake,
      reduceFlashes: settings.reduceFlashes,
    }),
    [settings.effects, settings.shake, settings.reduceFlashes],
  );
  const { board, floor } = useMemo(() => buildShowcase(def), [def]);
  const result = useMemo(() => runShowcase(def), [def]);
  const view = useMemo<BoardViewState>(
    () => ({
      board,
      rules: DEFAULT_RULES,
      floor,
      highlight: null,
      placing: null,
      mergeable: [],
      upcomingBlocked: [],
      shiftKey: 'showcase',
      guideCell: null,
    }),
    [board, floor],
  );

  // 再生するたびに新しいオブジェクトを渡す（同じオブジェクトの間は再生し直さないため）。
  // ループでは、終わったら少し休んで（resting）から回を進める
  const [round, setRound] = useState(0);
  const [resting, setResting] = useState(false);
  const playing = useMemo<SimResult | null>(
    () => (start > 0 && !resting ? { ...result, events: [...result.events], round } : null),
    [start, resting, result, round],
  );

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  const finish = () => {
    onFinish?.();
    if (!loop) return;
    setResting(true);
    timer.current = setTimeout(() => {
      setResting(false);
      setRound((n) => n + 1);
    }, LOOP_PAUSE_MS);
  };

  return (
    <div className="showcase" aria-hidden>
      <PixiBoard
        view={view}
        labels={labels}
        effectSettings={effectSettings}
        playbackResult={playing}
        quota={null}
        speed={1}
        muted={muted}
        showBreaks={false}
        onCellClick={noop}
        onCellLongPress={noop}
        onCellSecondaryClick={noop}
        onCellDragStart={noop}
        onCellDragEnd={noop}
        onShip={noop}
        onPlaybackFinish={finish}
      />
    </div>
  );
}
