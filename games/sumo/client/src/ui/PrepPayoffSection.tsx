import type { BashoReport, Rikishi } from '@ichimon/sim';
import { useI18n } from '../i18n';
import { recordLabel } from '../format';
import { signedPoints } from '../points';
import { RikishiPortrait } from '../art/Portraits';
import { prepPayoff, type Outcome } from '../prepPayoff';

const TAG: Record<Outcome, string> = { kachi: 'tag--good', make: '', kyujo: 'tag--warn' };

/** 場所の結果: 場所前に稽古をつけた弟子の伸びと、本場所の成績を並べる（稽古が勝ちにつながったか） */
export function PrepPayoffSection({
  report,
  byId,
  nameOf,
}: {
  report: BashoReport;
  byId: ReadonlyMap<number, Rikishi>;
  nameOf: (id: number) => string;
}) {
  const { t } = useI18n();
  const p = prepPayoff(report);
  if (!p) return null;
  return (
    <section className="payoff" aria-labelledby="payoff-title">
      <h3 id="payoff-title">{t('payoff.title')}</h3>
      <p className="payoff__lead">
        {t('payoff.lead', { n: p.trained.n, kachi: p.trained.kachi })}
        {p.others.n > 0 && (
          <span className="muted">
            {' '}
            {t('payoff.others', { n: p.others.n, kachi: p.others.kachi })}
          </span>
        )}
      </p>
      <ul className="payoff__list">
        {p.rows.map((x) => {
          const r = byId.get(x.id);
          return (
            <li key={x.id} className="payoff__row">
              {r ? <RikishiPortrait r={r} rank={x.record.rank} size={28} /> : <span />}
              <span className="payoff__name">{nameOf(x.id)}</span>
              <span className="payoff__gain">
                {t('payoff.gain')}
                <span className="cut__up"> {signedPoints(x.gain)}</span>
              </span>
              <span className="payoff__record">{recordLabel(t, x.record)}</span>
              <span className={`tag ${TAG[x.outcome]}`}>{t(`payoff.outcome.${x.outcome}`)}</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
