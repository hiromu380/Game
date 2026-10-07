/**
 * スイッチ操作（試運転・本番）・次にすることの案内・元に戻す。再生速度は再生中だけ出す
 */
import { useI18n } from '../i18n';
import type { InputMode } from '../input/controls';
import type { PlaybackSpeed } from '../playback/timeline';
import type { NextStep } from '../state/nextStep';
import { UiIcon } from './UiIcon';

interface Props {
  playing: boolean;
  /** 狭い画面用の短い表記 */
  compact?: boolean;
  /** 最後に使った入力の種類（キー・コントローラーなら操作の案内を出す） */
  inputMode?: InputMode;
  speed: PlaybackSpeed;
  /** 次にすること（1行の案内。state/nextStep.ts） */
  next?: NextStep | null;
  canUndo?: boolean;
  onUndo?: () => void;
  onTrial: () => void;
  onCommit: () => void;
  onSpeedChange: (speed: PlaybackSpeed) => void;
  /** 初回ガイドで押してほしいボタン（光らせる） */
  guide?: 'trial' | 'commit' | null;
}

const SPEEDS: PlaybackSpeed[] = [1, 2, 'skip'];

export function ControlsPanel({
  playing,
  compact = false,
  inputMode = 'pointer',
  speed,
  next = null,
  canUndo = false,
  onUndo,
  onTrial,
  onCommit,
  onSpeedChange,
  guide = null,
}: Props) {
  const { t, formatCompact } = useI18n();
  return (
    <section className={`panel controls ${playing ? 'is-playing' : ''}`}>
      <div className="button-row">
        <button
          className={`button--secondary ${guide === 'trial' ? 'is-guided' : ''}`}
          disabled={playing}
          onClick={onTrial}
        >
          <UiIcon name="trial" />
          {t('controls.trial')}
        </button>
        <button
          className={`button--primary ${guide === 'commit' ? 'is-guided' : ''}`}
          disabled={playing}
          onClick={onCommit}
        >
          <UiIcon name="commit-switch" size={22} />
          {compact ? t('controls.commitShort') : t('controls.commit')}
        </button>
      </div>
      {!playing && next && (
        <p className={`controls__next controls__next--${next.kind}`}>
          {next.kind === 'short'
            ? t('next.short', { amount: formatCompact(next.amount.toString()) })
            : t(`next.${next.kind}`)}
        </p>
      )}
      {!playing && inputMode !== 'pointer' && (
        <p className="panel__hint">{t(`controls.keysHint.${inputMode}`)}</p>
      )}
      {playing ? (
        <div className="speed">
          <span className="speed__label">{t('controls.speed')}</span>
          {SPEEDS.map((s) => (
            <button
              key={String(s)}
              className={`speed__button ${speed === s ? 'speed__button--active' : ''}`}
              onClick={() => onSpeedChange(s)}
            >
              {s === 'skip' ? t('controls.skip') : `${s}x`}
            </button>
          ))}
        </div>
      ) : (
        <div className="speed">
          <button
            className="button--small button--ghost"
            disabled={!canUndo}
            onClick={onUndo}
            title={t('undo.hint')}
            aria-label={t('undo.label')}
          >
            <UiIcon name="undo" size={16} />
            {!compact && t('undo.label')}
          </button>
        </div>
      )}
    </section>
  );
}
