/**
 * WebGLが使える場合のみ立体の土俵を描画する。
 * 描画に失敗した場合は従来のSVGへ自動的に戻す。
 */
import { useEffect, useRef, useState, type ComponentProps } from 'react';
import { BoutStage } from '../BoutStage';
import { mountStage, type MountedStage } from './stage';
import type { MotionClock } from './animation';

type Props = ComponentProps<typeof BoutStage> & { motion?: MotionClock };

export default function BoutStage3D(props: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stageRef = useRef<MountedStage | null>(null);
  const [fallback, setFallback] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || fallback) return;

    let stage: MountedStage | null = null;
    let resizeObserver: ResizeObserver | null = null;
    const onVisibility = () => {
      if (!document.hidden) stage?.resize();
    };
    const lost = (event: Event) => {
      event.preventDefault();
      setFallback(true);
    };

    try {
      stage = mountStage(canvas, props);
      stageRef.current = stage;
      canvas.addEventListener('webglcontextlost', lost);
      document.addEventListener('visibilitychange', onVisibility);
      if (typeof ResizeObserver !== 'undefined') {
        resizeObserver = new ResizeObserver(() => stage?.resize());
        resizeObserver.observe(canvas);
      } else {
        window.addEventListener('resize', stage.resize);
      }
    } catch {
      stage?.dispose();
      setFallback(true);
    }

    return () => {
      resizeObserver?.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
      if (stage) window.removeEventListener('resize', stage.resize);
      canvas.removeEventListener('webglcontextlost', lost);
      stageRef.current = null;
      stage?.dispose();
    };
    // 描画器とキャラクターはこの取組の開始時に一度だけ構築する。
    // 位置・傾きの更新は下の別の effect で行う。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fallback]);

  useEffect(() => {
    stageRef.current?.update(props);
  }, [props]);

  if (fallback) {
    const { motion: _motion, ...svgProps } = props;
    void _motion;
    return <BoutStage {...svgProps} />;
  }
  return <canvas ref={canvasRef} className="dohyo dohyo--3d" role="img" aria-label={props.title} />;
}
