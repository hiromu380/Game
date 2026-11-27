/**
 * 初回ガイドの吹き出し（ボルトが次にすることを案内する）。進み方は state/tutorial.ts
 */
import { useEffect, useRef } from 'react';
import { getCurrentShift, type RunState } from '@chain-factory/sim';
import { MASCOT_ASSETS } from '../assets/manifest';
import { useI18n } from '../i18n';
import { getInputMode } from '../input/controls';
import { gearAvailability, type TutorialState } from '../state/tutorial';

interface Props {
  tutorial: TutorialState;
  run: RunState;
  /** 最後の試運転の出荷量（表示用の文字列） */
  lastTrialScore: string | null;
  onNext: () => void;
  onSkip: () => void;
  /** 前に重なっていたもの（カットシーン）が閉じた。フォーカスはこのあとで当てる */
  ready: boolean;
}

export function TutorialGuide({ tutorial, run, lastTrialScore, onNext, onSkip, ready }: Props) {
  const { t, formatScore } = useI18n();
  const { step, hint } = tutorial;
  const nextRef = useRef<HTMLButtonElement>(null);
  const withButton = step === 'intro' || step === 'finish';
  // キーボード・コントローラーで遊んでいれば、「次へ」にフォーカスを当てておく（決定ですぐ進める。
  // コントローラーには Tab がなく、盤面の外のボタンを探さなくてよいように）
  useEffect(() => {
    if (ready && withButton && getInputMode() !== 'pointer') {
      nextRef.current?.focus({ preventScroll: true });
    }
  }, [ready, step, withButton]);
  if (step === 'done') return null;
  // ギアを買う手順は、ショップにギアが並んでいないとき（リロールした後など）に案内を変える
  const gear = step === 'buyGear' ? gearAvailability(run) : 'buy';
  const message = hint
    ? t(`tutorial.hint.${hint}`)
    : gear !== 'buy'
      ? t(`tutorial.gear.${gear}`, { score: lastTrialScore ? formatScore(lastTrialScore) : '0' })
      : t(`tutorial.step.${step}`, {
          score: lastTrialScore ? formatScore(lastTrialScore) : '0',
          quota: formatScore(String(getCurrentShift(run).quota)),
        });
  return (
    <div className="tutorial" role="status">
      <img
        className="tutorial__mascot"
        src={MASCOT_ASSETS[step === 'finish' ? 'happy' : hint ? 'surprised' : 'idle']}
        alt=""
        width={48}
        height={48}
      />
      <p className="tutorial__message">{message}</p>
      <div className="tutorial__actions">
        {withButton && (
          <button ref={nextRef} className="button--primary button--small" onClick={onNext}>
            {t(step === 'intro' ? 'tutorial.next' : 'tutorial.showcase')}
          </button>
        )}
        {step !== 'finish' && (
          <button className="button--ghost button--small" onClick={onSkip}>
            {t('tutorial.skip')}
          </button>
        )}
      </div>
    </div>
  );
}
