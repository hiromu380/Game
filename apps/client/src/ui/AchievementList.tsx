/**
 * 実績の一覧（ラン終了画面・コレクション）。Steam がオフラインでも、ゲーム内で解除状況を確かめられるように
 *
 * 隠し実績は解除するまで名前・説明を伏せる。体験版では出さない（実績が無効のため）。
 */
import { ACHIEVEMENTS, type AchievementProgress } from '@chain-factory/sim';
import { ACHIEVEMENT_ICONS } from '../assets/manifest';
import { useI18n } from '../i18n';

export function AchievementList({
  progress,
  open = false,
}: {
  progress: AchievementProgress;
  /** 最初から開いておくか（ラン終了画面では畳んでおく） */
  open?: boolean;
}) {
  const { t } = useI18n();
  const unlocked = new Set<string>(progress.unlocked);
  return (
    <details className="meta achievements" open={open}>
      <summary>
        <strong>{t('achievement.title')}</strong>{' '}
        <span className="meta__condition">
          {t('achievement.progress', { count: unlocked.size, total: ACHIEVEMENTS.length })}
        </span>
      </summary>
      <ul className="meta__goals">
        {ACHIEVEMENTS.map(({ id, hidden }) => {
          const done = unlocked.has(id);
          const secret = hidden && !done;
          return (
            <li key={id} className={`meta__goal ${done ? 'is-done' : ''}`}>
              <img
                className={`achievements__icon ${done ? '' : 'is-locked'} ${secret ? 'is-secret' : ''}`}
                src={ACHIEVEMENT_ICONS[id]}
                alt=""
                width={36}
                height={36}
              />
              <div className="meta__goal-text">
                <strong>{secret ? t('achievement.hidden') : t(`achievement.${id}.name`)}</strong>{' '}
                <span className="meta__condition">
                  {secret ? t('achievement.hiddenDesc') : t(`achievement.${id}.desc`)}
                </span>
              </div>
              <span className="meta__check">{done ? '✓' : ''}</span>
            </li>
          );
        })}
      </ul>
    </details>
  );
}
