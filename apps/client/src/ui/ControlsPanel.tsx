/**
 * スイッチ操作（試運転・本番）と再生速度の切り替え
 */
import { useI18n } from '../i18n';
import type { PlaybackSpeed } from '../playback/timeline';
import { UiIcon } from './UiIcon';

interface Props {
  playing: boolean;
  /** 狭い画面用の短い表記 */
  compact?: boolean;
  speed: PlaybackSpeed;
  onTrial: () => void;
  onCommit: () => void;
  onSpeedChange: (speed: PlaybackSpeed) => void;
}

const SPEEDS: PlaybackSpeed[] = [1, 2, 'skip'];

export function ControlsPanel({
  playing,
  compact = false,
  speed,
  onTrial,
  onCommit,
  onSpeedChange,
}: Props) {
  const { t } = useI18n();
  return (
    <section className="panel controls">
      <div className="button-row">
        <button className="button--secondary" disabled={playing} onClick={onTrial}>
          <UiIcon name="trial" />
          {t('controls.trial')}
        </button>
        <button className="button--primary" disabled={playing} onClick={onCommit}>
          <UiIcon name="commit-switch" size={22} />
          {compact ? t('controls.commitShort') : t('controls.commit')}
        </button>
      </div>
      <p className="panel__hint">{t('controls.commitHint')}</p>
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
    </section>
  );
}
