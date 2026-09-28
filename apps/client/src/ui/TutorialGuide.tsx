/**
 * 初回ガイドの吹き出し（ボルトが次にすることを案内する）。進み方は state/tutorial.ts
 */
import { getCurrentShift, type RunState } from '@chain-factory/sim';
import { MASCOT_ASSETS } from '../assets/manifest';
import { useI18n } from '../i18n';
import type { TutorialState } from '../state/tutorial';

interface Props {
  tutorial: TutorialState;
  run: RunState;
  /** 最後の試運転の出荷量（表示用の文字列） */
  lastTrialScore: string | null;
  onNext: () => void;
  onSkip: () => void;
}

export function TutorialGuide({ tutorial, run, lastTrialScore, onNext, onSkip }: Props) {
  const { t, formatScore } = useI18n();
  const { step, hint } = tutorial;
  if (step === 'done') return null;
  const message = hint
    ? t(`tutorial.hint.${hint}`)
    : t(`tutorial.step.${step}`, {
        score: lastTrialScore ? formatScore(lastTrialScore) : '0',
        quota: formatScore(String(getCurrentShift(run).quota)),
      });
  const withButton = step === 'intro' || step === 'finish';
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
          <button className="button--primary button--small" onClick={onNext}>
            {t(step === 'intro' ? 'tutorial.next' : 'tutorial.finish')}
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
