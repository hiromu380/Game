/**
 * カットシーンの再生画面（画面全体に重ねる）
 *
 * - スキップ: クリック・タップ・キー・コントローラーのボタンを長押し（誤操作の防止）。押している間は進み具合の輪を出す
 * - 設定: 演出の強さ・揺れ・点滅を減らす（timeline.ts）、音量（効果音は AudioEngine の設定に従う）
 * - 必ず終わる: シーンの長さ・上限時間を過ぎたら、読み込みに失敗したら、そのままゲームへ戻る
 */
import { useEffect, useRef, useState } from 'react';
import { audio } from '../audio/AudioEngine';
import type { SoundKey } from '../audio/manifest';
import { CUTSCENE_CONFIG } from '../config/cutscene';
import { useI18n } from '../i18n';
import { useSettings } from '../settings/SettingsContext';
import { CutsceneRenderer } from './CutsceneRenderer';
import type { SceneId } from './playback';
import { SCENE_LOADERS } from './scenes';
import { sampleScene, soundsBetween } from './timeline';

interface Props {
  scene: SceneId;
  /** 終わった（見終わった・スキップした・失敗した）。skipped は見終わらずに閉じたとき */
  onDone: (result: { skipped: boolean }) => void;
}

export default function CutscenePlayer({ scene: sceneId, onDone }: Props) {
  const { t } = useI18n();
  const { settings } = useSettings();
  const parentRef = useRef<HTMLDivElement>(null);
  const [hold, setHold] = useState(0);
  const doneRef = useRef(onDone);
  const finished = useRef(false);
  useEffect(() => {
    doneRef.current = onDone;
  });
  const finish = (skipped: boolean) => {
    if (finished.current) return;
    finished.current = true;
    doneRef.current({ skipped });
  };
  const options = useRef({
    strength: settings.effects,
    shake: settings.shake,
    reduceFlashes: settings.reduceFlashes,
  });

  // 読み込みと再生（終わったら破棄）
  useEffect(() => {
    const parent = parentRef.current;
    const load = SCENE_LOADERS[sceneId];
    if (!parent || !load) {
      finish(true);
      return;
    }
    let disposed = false;
    let renderer: CutsceneRenderer | null = null;
    // 上限時間の保険（描画が止まっても、必ずゲームへ戻る）
    const guard = setTimeout(
      () => finish(true),
      (CUTSCENE_CONFIG.maxDurationSec + 1) * 1000 + CUTSCENE_CONFIG.loadTimeoutMs,
    );
    void (async () => {
      try {
        const scene = await load();
        const created = await CutsceneRenderer.create(parent, scene, (key) => t(key as never));
        if (disposed) {
          created.destroy();
          return;
        }
        renderer = created;
        let time = 0;
        created.render(sampleScene(scene, 0, options.current));
        created.onTick((deltaMs) => {
          if (finished.current) return;
          const next = time + deltaMs / 1000;
          for (const key of soundsBetween(scene, time, next)) audio.play(key as SoundKey);
          time = next;
          const frame = sampleScene(scene, time, options.current);
          created.render(frame);
          if (frame.done) finish(false);
        });
      } catch {
        // 読み込みに失敗したら、カットシーンを飛ばしてゲームを続ける
        finish(true);
      }
    })();
    return () => {
      disposed = true;
      clearTimeout(guard);
      renderer?.destroy();
    };
    // シーンが変わったときだけ作り直す
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sceneId]);

  // 長押しでスキップ（マウス・タッチ・キー・コントローラー）
  useEffect(() => {
    let start: number | null = null;
    let frame = 0;
    const press = () => {
      if (start === null) start = performance.now();
    };
    const release = () => {
      start = null;
      setHold(0);
    };
    const loop = () => {
      const pads = navigator.getGamepads?.() ?? [];
      const padDown = pads.some((p) => p?.buttons.some((b) => b.pressed));
      if (padDown) press();
      else if (start !== null && !pointerOrKeyDown) release();
      if (start !== null) {
        const k = Math.min(1, (performance.now() - start) / CUTSCENE_CONFIG.skipHoldMs);
        setHold(k);
        if (k >= 1) {
          finish(true);
          return;
        }
      }
      frame = requestAnimationFrame(loop);
    };
    let pointerOrKeyDown = false;
    const down = (e: Event) => {
      if (e instanceof KeyboardEvent && e.repeat) return;
      pointerOrKeyDown = true;
      press();
    };
    const up = () => {
      pointerOrKeyDown = false;
      release();
    };
    window.addEventListener('pointerdown', down);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    frame = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('pointerdown', down);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, []);

  return (
    <div className="cutscene" role="dialog" aria-label={t(`story.scene.${sceneId}`)}>
      <div className="cutscene__stage" ref={parentRef} />
      <div className="cutscene__skip" aria-hidden="true">
        <svg viewBox="0 0 36 36" width="28" height="28">
          <circle
            cx="18"
            cy="18"
            r="15"
            fill="none"
            stroke="rgba(255,255,255,0.25)"
            strokeWidth="4"
          />
          <circle
            cx="18"
            cy="18"
            r="15"
            fill="none"
            stroke="var(--accent)"
            strokeWidth="4"
            strokeDasharray={`${hold * 94.2} 94.2`}
            transform="rotate(-90 18 18)"
          />
        </svg>
        <span>{t('story.skipHold')}</span>
      </div>
    </div>
  );
}
