import type { GameState } from '@ichimon/sim';
import { useI18n, type MessageKey } from '../i18n';
import { ACHIEVEMENTS, ACHIEVEMENT_GROUPS, achievedOf, type AchievementId } from '../achievements';

/** 一門タブの実績の一覧（まだのものは名前と手がかり） */
export function AchievementsPanel({ game }: { game: GameState }) {
  const { t } = useI18n();
  const done = new Set(achievedOf(game));
  return (
    <section className="panel" aria-labelledby="achv-title">
      <h2 id="achv-title">
        {t('achv.title')}{' '}
        <span className="muted">
          {t('achv.count', { done: done.size, total: ACHIEVEMENTS.length })}
        </span>
      </h2>
      {ACHIEVEMENT_GROUPS.map((g) => (
        <div key={g}>
          <h3 className="achv__group">{t(`achv.group.${g}` as MessageKey)}</h3>
          <ul className="achv__list">
            {ACHIEVEMENTS.filter((a) => a.group === g).map((a) => {
              const ok = done.has(a.id);
              return (
                <li key={a.id} className={`achv__item ${ok ? 'is-done' : ''}`}>
                  <span aria-hidden="true">{ok ? '★' : '☆'}</span>
                  <span>
                    {t(`achv.${a.id}.name` as MessageKey)}
                    <span className="visually-hidden">
                      {ok ? t('achv.done') : t('achv.notYet')}
                    </span>
                    <small className="achv__hint">{t(`achv.${a.id}.hint` as MessageKey)}</small>
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </section>
  );
}

/** 新しく達成した実績の知らせ（押すと消える） */
export function AchievementToast({ ids, onClose }: { ids: AchievementId[]; onClose: () => void }) {
  const { t } = useI18n();
  if (ids.length === 0) return null;
  return (
    <button className="achv-toast" role="status" onClick={onClose}>
      <span className="achv-toast__head">★ {t('achv.unlocked')}</span>
      {ids.map((id) => t(`achv.${id}.name` as MessageKey)).join('・')}
    </button>
  );
}
