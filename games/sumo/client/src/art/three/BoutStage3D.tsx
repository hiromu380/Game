/**
 * WebGLが使える場合のみ立体の土俵を描画する。
 * 描画に失敗した場合は従来のSVGへ自動的に戻す。
 */
import { useEffect, useRef, useState, type ComponentProps } from 'react';
import { BoutStage } from '../BoutStage';
import { mountStage, type MountedStage } from './stage';
import type { MotionClock } from './animation';

type Props = ComponentProps<typeof BoutStage> & { motion?: MotionClock; onReady: () => void };

export default function BoutStage3D(props: Props) {
  const initial = useRef(props);
  const hostRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<MountedStage | null>(null);
  const [fallback, setFallback] = useState(false);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || fallback) return;
    // StrictModeで解放直後のcanvasを再利用すると、喪失中のコンテキストを拾ってしまう。
    const canvas = document.createElement('canvas');
    canvas.setAttribute('aria-hidden', 'true');
    host.append(canvas);

    let stage: MountedStage | null = null;
    let resizeObserver: ResizeObserver | null = null;
    const onResize = () => {
      try {
        stage?.resize();
      } catch {
        setFallback(true);
      }
    };
    const onVisibility = () => {
      if (!document.hidden) onResize();
    };
    const lost = (event: Event) => {
      event.preventDefault();
      setFallback(true);
    };

    try {
      stage = mountStage(canvas, initial.current);
      stageRef.current = stage;
      initial.current.onReady();
      canvas.addEventListener('webglcontextlost', lost);
      document.addEventListener('visibilitychange', onVisibility);
      if (typeof ResizeObserver !== 'undefined') {
        resizeObserver = new ResizeObserver(onResize);
        resizeObserver.observe(canvas);
      } else {
        window.addEventListener('resize', onResize);
      }
    } catch {
      stage?.dispose();
      initial.current.onReady();
      setFallback(true);
    }

    return () => {
      resizeObserver?.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('resize', onResize);
      canvas.removeEventListener('webglcontextlost', lost);
      stageRef.current = null;
      stage?.dispose();
      canvas.remove();
    };
    // 描画器とキャラクターはこの取組の開始時に一度だけ構築する。
    // 位置・傾きの更新は下の別の effect で行う。
  }, [fallback]);

  useEffect(() => {
    try {
      stageRef.current?.update(props);
    } catch {
      setFallback(true);
    }
  }, [props]);

  if (fallback) {
    const { motion: _motion, onReady: _onReady, ...svgProps } = props;
    void _motion;
    void _onReady;
    return <BoutStage {...svgProps} />;
  }
  return <div ref={hostRef} className="dohyo dohyo--3d" role="img" aria-label={props.title} />;
}
