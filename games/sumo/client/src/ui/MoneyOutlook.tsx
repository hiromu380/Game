import { projectLedger, type GameState } from '@ichimon/sim';
import { useI18n } from '../i18n';
import { money } from '../format';

/** この場所の収支の見込み（部屋の口座・親方の貯金）と、このままだとお金が尽きるまでの場所の数 */
export function MoneyOutlook({ game }: { game: GameState }) {
  const { t, lang } = useI18n();
  const p = projectLedger(game);
  const yen = (n: number) => (n >= 0 ? '+' : '−') + money(t, Math.abs(n), lang);
  return (
    <div className="outlook" role="group" aria-label={t('outlook.title')}>
      <span className="outlook__label">{t('outlook.title')}</span>
      <span className={p.stableNet < 0 ? 'down' : 'up'}>
        {t('outlook.stable', { yen: yen(p.stableNet) })}
      </span>
      <span className={p.personalNet < 0 ? 'down' : 'up'}>
        {t('outlook.personal', { yen: yen(p.personalNet) })}
      </span>
      {p.runway !== null && (
        <span className="tag tag--warn outlook__runway">
          {t('outlook.runway', { n: p.runway })}
        </span>
      )}
    </div>
  );
}
