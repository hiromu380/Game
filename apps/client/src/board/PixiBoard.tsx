/**
 * PixiJS の盤面を React に埋め込むコンポーネント
 *
 * 描画そのものは BoardRenderer が担当し、ここでは
 * 「React の状態が変わったら BoardRenderer に伝える」ことだけを行う。
 */
import type { PartId, Score, SimResult } from '@chain-factory/sim';
import { useEffect, useRef, useState } from 'react';
import type { PlaybackSpeed } from '../playback/timeline';
import { BoardRenderer, type BoardViewState } from './BoardRenderer';

interface Props {
  view: BoardViewState;
  /** 再生する結果（null なら再生しない）。同じオブジェクトの間は再生し直さない */
  playbackResult: SimResult | null;
  speed: PlaybackSpeed;
  getPartName: (partId: PartId) => string;
  formatIncome: (amount: number) => string;
  onCellClick: (x: number, y: number) => void;
  onShip: (total: Score) => void;
  onPlaybackFinish: () => void;
}

export function PixiBoard(props: Props) {
  const { view, playbackResult, speed } = props;
  const containerRef = useRef<HTMLDivElement>(null);
  const [renderer, setRenderer] = useState<BoardRenderer | null>(null);
  /** 再生開始時の速度（速度変更だけで再生し直さないよう ref で持つ） */
  const speedRef = useRef(speed);

  // コールバックは毎回変わりうるので ref 経由で最新を参照する
  const callbacksRef = useRef(props);
  useEffect(() => {
    callbacksRef.current = props;
  });

  // 初期化と破棄（PixiJS の init は非同期なので、破棄が先に来た場合にも備える）
  useEffect(() => {
    const parent = containerRef.current;
    if (!parent) return;
    let disposed = false;
    let created: BoardRenderer | null = null;

    void BoardRenderer.create(parent, {
      onCellClick: (x, y) => callbacksRef.current.onCellClick(x, y),
      getPartName: (partId) => callbacksRef.current.getPartName(partId),
      formatIncome: (amount) => callbacksRef.current.formatIncome(amount),
    }).then((r) => {
      if (disposed) {
        r.destroy();
        return;
      }
      created = r;
      setRenderer(r);
    });

    return () => {
      disposed = true;
      created?.destroy();
      setRenderer(null);
    };
  }, []);

  // 盤面・選択の反映
  useEffect(() => {
    renderer?.setState(view);
  }, [renderer, view]);

  // 再生の開始・終了
  useEffect(() => {
    if (!renderer) return;
    if (!playbackResult) {
      renderer.clearPlayback();
      return;
    }
    renderer.play(playbackResult, speedRef.current, {
      onShip: (total) => callbacksRef.current.onShip(total),
      onFinish: () => callbacksRef.current.onPlaybackFinish(),
    });
  }, [renderer, playbackResult]);

  // 再生速度の変更（再生を最初からやり直さないよう、別の effect にする）
  useEffect(() => {
    speedRef.current = speed;
    renderer?.setSpeed(speed);
  }, [renderer, speed]);

  return <div ref={containerRef} className="board-container" />;
}
