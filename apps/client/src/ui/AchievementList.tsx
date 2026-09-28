/**
 * 実績の一覧（ラン終了画面）。Steam がオフラインでも、ゲーム内で解除状況を確かめられるように
 *
 * 隠し実績は解除するまで名前・説明を伏せる。体験版では出さない（実績が無効のため）。
 */
import { ACHIEVEMENTS, type AchievementProgress } from '@chain-factory/sim';
import { useI18n } from '../i18n';

export function AchievementList({ progress }: { progress: AchievementProgress }) {
  const { t } = useI18n();
  const unlocked = new Set<string>(progress.unlocked);
  return (
    <details className="meta achievements">
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
