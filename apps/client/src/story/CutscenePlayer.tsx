/**
 * カットシーンの再生画面（画面全体に重ねる）。紙芝居: 止め絵と1〜2行の文を自動でめくる（story/pages.ts）
 *
 * - ページが変わると話し手が少し跳ね、セリフは1文字ずつ出て、話し手ごとの声の音が鳴る（演出「弱」では止め絵と全文のまま）
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
import {
  applyPageFaces,
  applySpeakerBounce,
  isVoiced,
  pageAt,
  pageSchedule,
  speakerBounce,
  STORY_PAGES,
  typedLength,
} from './pages';
import { sampleScene } from './timeline';

interface Props {
  scene: SceneId;
  /** 終わった（見終わった・スキップした・失敗した）。skipped は見終わらずに閉じたとき */
  onDone: (result: { skipped: boolean }) => void;
}

export default function CutscenePlayer({ scene: sceneId, onDone }: Props) {
  const { t, lang } = useI18n();
  const { settings } = useSettings();
  const pages = STORY_PAGES[sceneId] ?? [];
  const [page, setPage] = useState(0);
  /** いまのページのセリフを何文字目まで出したか */
  const [typed, setTyped] = useState(0);
  const parentRef = useRef<HTMLDivElement>(null);
  /** めくりで横へ抜く前の絵（紙芝居の抜き差し）を置く場所 */
  const cardsRef = useRef<HTMLDivElement>(null);
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
        // 作る前に、まだ要るかを確かめる（開発中の StrictMode は作り直しのために一度捨てる。
        // 捨てる方まで作ると、後から壊したときに描画の共有の資源まで壊れ、残った方が描けなくなる）
        if (disposed) return;
        const created = await CutsceneRenderer.create(parent, scene, (key) => t(key as never));
        if (disposed) {
          created.destroy();
          return;
        }
        renderer = created;
        // 経過時間は実時間で測る（描画が重くてコマが落ちても、めくる間隔がずれないように）
        const texts = pages.map((p) => t(p.text as never));
        const schedule = pageSchedule(texts, lang);
        let shownChars = -1;
        const startedAt = performance.now();
        let shown = -1;
        // 撮影モード（開発専用）: 指定の経過時間で止めて描く（docs/ui-review の撮影・コマの確認用）
        let frozenAt: number | null = null;
        if (import.meta.env.VITE_CAPTURE === '1') {
          (window as { cutsceneSeek?: (t: number) => void }).cutsceneSeek = (t) => {
            clearTimeout(guard);
            frozenAt = t;
          };
        }
        const { zoom } = CUTSCENE_CONFIG.pages;
        const still = options.current.strength === 'minimal';
        const draw = (elapsed: number) => {
          const state = pageAt(schedule, elapsed);
          const current = pages[state.index];
          if (!current) return state;
          if (state.index !== shown) {
            // 紙芝居のめくり: 前の絵を写して横へ抜き、下から次の絵を見せる（演出「弱」では暗転だけ）
            if (shown >= 0 && options.current.strength !== 'minimal' && cardsRef.current) {
              const card = created.snapshot();
              card.className = 'cutscene__card';
              card.addEventListener('animationend', () => card.remove());
              cardsRef.current.replaceChildren(card);
            }
            shown = state.index;
            shownChars = -1;
            setPage(state.index);
            if (state.index > 0) audio.play('paper' as SoundKey);
          }
          const sinceTurn = elapsed - (schedule[state.index]?.start ?? 0);
          // セリフを1文字ずつ出し、出た文字に合わせて話し手の声を鳴らす（1コマに1回まで）
          const text = texts[state.index] ?? '';
          const count = typedLength(text, sinceTurn, lang, options.current.strength);
          if (count !== shownChars) {
            const chars = [...text];
            const fresh = chars.slice(Math.max(0, shownChars), count);
            const voiced = fresh.findIndex(
              (c, i) =>
                isVoiced(c) &&
                (Math.max(0, shownChars) + i) % CUTSCENE_CONFIG.pages.voiceEvery === 0,
            );
            if (shownChars >= 0 && voiced >= 0 && options.current.strength !== 'minimal') {
              // 音程は文字で決める（同じセリフはいつも同じ節回し）
              const code = fresh[voiced]!.codePointAt(0) ?? 0;
              audio.play(current.speaker === 'bolt' ? 'voiceBolt' : 'voiceChief', (code % 5) - 2);
            }
            shownChars = count;
            setTyped(count);
          }
          // 止め絵: 揺れ・光は出さず、ページの間だけゆっくり寄る。ページの頭で話し手が跳ねる
          const frame = applySpeakerBounce(
            applyPageFaces(sampleScene(scene, current.at, options.current), current),
            current,
            speakerBounce(sinceTurn, options.current.strength),
          );
          const push = still ? 1 : 1 + zoom * state.progress;
          created.render({
            ...frame,
            camera: { ...frame.camera, zoom: frame.camera.zoom * push },
            shake: { x: 0, y: 0 },
            flash: null,
          });
          return state;
        };
        draw(0);
        created.onTick(() => {
          if (finished.current) return;
          if (frozenAt !== null) {
            draw(frozenAt);
            return;
          }
          if (draw((performance.now() - startedAt) / 1000).done) finish(false);
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
      <div className="cutscene__cards" ref={cardsRef} aria-hidden="true" />
      {/* 演出「弱」のページの切り替え: 一瞬暗くしてからめくる（ページが変わるたびに作り直してアニメーションさせる） */}
      {settings.effects === 'minimal' && (
        <div key={`turn-${page}`} className="cutscene__turn" aria-hidden="true" />
      )}
      {pages[page] && (
        <p
          key={`text-${page}`}
          className={`cutscene__text cutscene__text--${pages[page].speaker}`}
          aria-live="polite"
        >
          <span className="cutscene__speaker">{t(`story.name.${pages[page].speaker}`)}</span>
          {/* まだ出していない文字も場所は取っておく（行が途中で折り返し直さないように。読み上げには全文を渡す） */}
          {(() => {
            const chars = [...t(pages[page].text as never)];
            return (
              <>
                {chars.slice(0, typed).join('')}
                <span className="cutscene__untyped">{chars.slice(typed).join('')}</span>
              </>
            );
          })()}
        </p>
      )}
      <ol className="cutscene__pages" aria-hidden="true">
        {pages.map((p, i) => (
          <li key={p.text} className={i === page ? 'is-current' : i < page ? 'is-read' : ''} />
        ))}
      </ol>
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
