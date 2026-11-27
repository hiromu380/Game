import type { GameState } from '@ichimon/sim';
import { useI18n, type MessageKey } from '../i18n';
import { yearPlan } from '../calendar';

/** 年間予定表（今年の6場所と前後の行事。今の場所に ▶） */
export function YearPlan({ game }: { game: GameState }) {
  const { t } = useI18n();
  const rows = yearPlan(game.bashoIndex);
  return (
    <section className="panel" aria-labelledby="plan-title">
      <h2 id="plan-title">{t('plan.title', { year: Math.floor(game.bashoIndex / 6) + 1 })}</h2>
      <ol className="plan">
        {rows.map((r) => (
          <li
            key={r.slot}
            className={`plan__row is-${r.state}`}
            aria-current={r.state === 'now' ? 'step' : undefined}
          >
            <span className="plan__mark" aria-hidden="true">
              {r.state === 'now' ? '▶' : r.state === 'past' ? '✓' : ''}
            </span>
            <span className="plan__basho">
              <strong>{t(`basho.${r.slot}` as MessageKey)}</strong>
              <small>{t(`plan.where.${r.slot}` as MessageKey)}</small>
            </span>
            <span className="plan__events">
              {r.before.map((e) => (
                <span key={e} className="tag">
                  {t(`plan.ev.${e}` as MessageKey)}
                </span>
              ))}
              <span className="plan__sep" aria-hidden="true">
                →
              </span>
              <span className="visually-hidden">{t('plan.afterSr')}</span>
              {r.after.length === 0 ? (
                <span className="muted">—</span>
              ) : (
                r.after.map((e) => (
                  <span key={e} className="tag tag--gold">
                    {t(`plan.ev.${e}` as MessageKey)}
                  </span>
                ))
              )}
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}
