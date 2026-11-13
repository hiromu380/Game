import { useI18n, type MessageKey } from '../i18n';
import { money } from '../format';
import type { RewardLine } from '../rewards';

/** 場所の結果の「報酬と罰」: 成績が経営に返ってきたものを、原因つきで1行ずつ */
export function RewardsSection({ lines }: { lines: RewardLine[] }) {
  const { t, lang } = useI18n();
  const yen = (n: number) => (n >= 0 ? '+' : '−') + money(t, Math.abs(n), lang);
  const text = (x: RewardLine): string => {
    switch (x.kind) {
      case 'prestige':
        return t('rewards.prestige', { delta: (x.delta > 0 ? '+' : '') + x.delta });
      case 'patrons':
        return t(x.cause ? `rewards.patrons.${x.cause.result}` : 'rewards.patrons.cold', {
          name: x.cause?.name ?? '',
          count: x.count,
          delta: (x.delta > 0 ? '+' : '') + x.delta,
        } as Record<string, string | number>);
      case 'patronJoin':
      case 'patronLeave':
        return t(`rewards.${x.kind}`, {
          name: t(`patron.kind.${x.patron.kind}` as MessageKey, { surname: x.patron.surname }),
        });
      case 'sekitoriUp':
      case 'sekitoriDown':
        return t(`rewards.${x.kind}`, { name: x.name, yen: yen(x.perBasho) });
      case 'injury':
        return t('rewards.injury', { name: x.name, basho: x.basho });
      case 'henka':
        return t('rewards.henka', { name: x.name });
      case 'vsOutlook':
        return t('rewards.vsOutlook', { yen: yen(x.delta) });
    }
  };
  return (
    <>
      <h3>{t('rewards.title')}</h3>
      {lines.length === 0 ? (
        <p className="rewards__none">{t('rewards.none')}</p>
      ) : (
        <ul className="rewards">
          {lines.map((x, i) => (
            <li key={i} className={`rewards__line is-${x.tone}`}>
              <span className="rewards__mark" aria-hidden="true">
                {x.tone === 'good' ? '▲' : '▼'}
              </span>
              <span className="visually-hidden">
                {t(x.tone === 'good' ? 'rewards.good' : 'rewards.bad')}
              </span>
              {text(x)}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
