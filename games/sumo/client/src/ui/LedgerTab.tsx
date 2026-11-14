import { sumMoney, type GameState, type MoneyLine } from '@ichimon/sim';
import { useI18n, type MessageKey } from '../i18n';
import { money } from '../format';
import { Facilities } from './Facilities';
import { StaffPanel } from './StaffPanel';
import { KoenkaiPanel } from './KoenkaiPanel';

/** 帳簿: 直近の場所の収入・支出・親方個人の収支（金額の出典は docs/realism.md） */
export function LedgerTab({ game, setGame }: { game: GameState; setGame: (g: GameState) => void }) {
  const { t, lang } = useI18n();
  const report = game.lastReport;
  const table = (title: string, lines: MoneyLine[], sign: 1 | -1) => (
    <table className="ledger">
      <caption>{title}</caption>
      <tbody>
        {lines.map((l) => (
          <tr key={l.key}>
            <th scope="row">{t(`money.line.${l.key}` as MessageKey)}</th>
            <td>{money(t, l.amount * sign, lang)}</td>
          </tr>
        ))}
        <tr className="ledger__total">
          <th scope="row">{t('ledger.total')}</th>
          <td>{money(t, sumMoney(lines) * sign, lang)}</td>
        </tr>
      </tbody>
    </table>
  );
  return (
    <div className="stack">
      <KoenkaiPanel game={game} setGame={setGame} />
      <StaffPanel game={game} setGame={setGame} />
      <Facilities game={game} setGame={setGame} />
      <section className="panel">
        <h2>{t('ledger.title')}</h2>
        {!report ? (
          <p className="note">{t('ledger.empty')}</p>
        ) : (
          <div className="stack">
            {table(t('ledger.income'), report.income, 1)}
            {table(t('ledger.expenses'), report.expenses, -1)}
            <p className="ledger__net">
              {t('ledger.net', {
                value: money(t, sumMoney(report.income) - sumMoney(report.expenses), lang),
              })}
            </p>
            {table(t('ledger.personal'), report.personal, 1)}
          </div>
        )}
        <p className="note">{t('ledger.note')}</p>
      </section>
    </div>
  );
}
