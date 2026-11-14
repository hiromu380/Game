import type { GameState } from '@ichimon/sim';
import { useI18n } from '../i18n';
import { useSettings } from '../settings';
import { doneSteps, GUIDE_STEPS, showGuide, withTip, type TipTab } from '../guide';

/** 親方の手引き（最初の場所でやること）。済んだ手順に印、全部済むか閉じると出なくなる */
export function GuideCard({ game }: { game: GameState }) {
  const { t } = useI18n();
  const { settings, update } = useSettings();
  if (!showGuide(game, settings.guide)) return null;
  const done = doneSteps(game, settings.guide);
  return (
    <section className="panel guide" aria-labelledby="guide-title">
      <h2 id="guide-title">{t('guide.title')}</h2>
      <p className="note">{t('guide.lead')}</p>
      <ol className="guide__steps">
        {GUIDE_STEPS.map((s) => (
          <li key={s} className={done.has(s) ? 'is-done' : ''}>
            <span className="guide__mark" aria-hidden="true">
              {done.has(s) ? '✓' : '・'}
            </span>
            <span>
              {t(`guide.step.${s}`)}
              {done.has(s) && <span className="visually-hidden">{t('guide.doneAria')}</span>}
            </span>
          </li>
        ))}
      </ol>
      <button
        className="button"
        onClick={() => update({ guide: { ...settings.guide, dismissed: true } })}
      >
        {t('guide.dismiss')}
      </button>
    </section>
  );
}

/** タブを初めて開いたときの短い案内 */
export function TabTip({ tab }: { tab: TipTab }) {
  const { t } = useI18n();
  const { settings, update } = useSettings();
  if (settings.guide.tips.includes(tab)) return null;
  return (
    <aside className="tabtip" role="note">
      <p>{t(`guide.tip.${tab}`)}</p>
      <button className="button" onClick={() => update({ guide: withTip(settings.guide, tab) })}>
        {t('guide.tipOk')}
      </button>
    </aside>
  );
}
