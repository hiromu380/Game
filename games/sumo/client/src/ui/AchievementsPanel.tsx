import { useEffect } from 'react';
import type { GameState } from '@ichimon/sim';
import { useI18n, type MessageKey } from '../i18n';
import {
  ACHIEVEMENTS,
  ACHIEVEMENT_GROUPS,
  achievedOf,
  nearAchievements,
  nextTierAt,
  tierOf,
  progressOf,
  type AchievementId,
} from '../achievements';
import { playSound } from '../sound';
import { useSettings } from '../settings';

/** 一門タブの実績の一覧（まだのものは名前と手がかり） */
export function AchievementsPanel({ game }: { game: GameState }) {
  const { t } = useI18n();
  const done = new Set(achievedOf(game));
  const progress = progressOf(game);
  const near = nearAchievements(game);
  return (
    <section className="panel" aria-labelledby="achv-title">
      <h2 id="achv-title">
        {t('achv.title')}{' '}
        <span className="muted">
          {t('achv.count', { done: done.size, total: ACHIEVEMENTS.length })}
        </span>
      </h2>
      <p className="achv__tier">
        {t('achv.tier', { tier: t(`achv.tierName.${tierOf(done.size)}` as MessageKey) })}
        {nextTierAt(tierOf(done.size)) !== null && (
          <span className="muted">
            {' '}
            {t('achv.tierNext', {
              n: nextTierAt(tierOf(done.size))!,
              tier: t(`achv.tierName.${tierOf(done.size) + 1}` as MessageKey),
            })}
          </span>
        )}
      </p>
      {near.length > 0 && (
        <p className="achv__near">
          <span className="tag tag--gold">{t('achv.near')}</span>{' '}
          {near.map((a, i) => (
            <span key={a.id} className="achv__nearItem">
              {i > 0 && '・'}
              {t('achv.nearItem', {
                name: t(`achv.${a.id}.name` as MessageKey),
                now: a.now,
                of: a.of,
              })}
            </span>
          ))}
        </p>
      )}
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
                    <small className="achv__hint">
                      {t(`achv.${a.id}.hint` as MessageKey)}
                      {progress.has(a.id) &&
                        t('achv.progress', {
                          now: progress.get(a.id)!.now,
                          of: progress.get(a.id)!.of,
                        })}
                    </small>
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

/** 何秒で知らせを消すか（押してもすぐ消える） */
const TOAST_SECONDS = 6;

/** 新しく達成した実績の知らせ（音とともに出て、数秒で消える。押すとすぐ消える） */
export function AchievementToast({
  ids,
  total,
  onClose,
}: {
  ids: AchievementId[];
  /** 達成した数（新しい分を含む） */
  total: number;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const { settings } = useSettings();
  const key = ids.join(',');
  useEffect(() => {
    if (!key) return;
    if (settings.sound) playSound('cheer');
    const timer = setTimeout(onClose, TOAST_SECONDS * 1000);
    return () => clearTimeout(timer);
    // 同じ知らせで鳴らし直さない
  }, [key]);
  if (ids.length === 0) return null;
  return (
    <button className="achv-toast" role="status" onClick={onClose}>
      <span className="achv-toast__head">
        ★ {t('achv.unlocked')}{' '}
        <span className="achv-toast__count">
          {t('achv.count', { done: total, total: ACHIEVEMENTS.length })}
        </span>
      </span>
      {ids.map((id) => t(`achv.${id}.name` as MessageKey)).join('・')}
      {tierOf(total) > tierOf(total - ids.length) && (
        <span className="achv-toast__tier">
          {t('achv.tierUp', { tier: t(`achv.tierName.${tierOf(total)}` as MessageKey) })}
        </span>
      )}
    </button>
  );
}
