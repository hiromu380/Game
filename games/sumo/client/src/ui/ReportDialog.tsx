import { sumMoney, type BashoReport, type Division, type GameState } from '@ichimon/sim';
import { useI18n, type MessageKey } from '../i18n';
import { bashoName, money, rankLabel, recordLabel } from '../format';

const DIVS: Division[] = ['makuuchi', 'juryo', 'makushita', 'sandanme', 'jonidan', 'jonokuchi'];

/** 場所の結果: 自分の弟子の成績・昇進・各段の優勝・引退・お金 */
export function ReportDialog({
  game,
  report,
  onClose,
}: {
  game: GameState;
  report: BashoReport;
  onClose: () => void;
}) {
  const { t, lang } = useI18n();
  const byId = new Map(game.rikishi.map((r) => [r.id, r]));
  const stableName = new Map(game.stables.map((s) => [s.id, s.name]));
  const nameOf = (id: number) =>
    byId.get(id)?.name ?? report.retired.find((r) => r.id === id)?.name ?? '?';
  const mineIds = new Set(report.mine.map((m) => m.id));
  const myPromotions = report.promotions.filter(
    (p) => byId.get(p.id)?.stableId === game.player.stableId,
  );
  const topPromotions = report.promotions.filter(
    (p) => (p.to === 'Y' || p.to === 'O') && !mineIds.has(p.id),
  );
  const myRetired = report.retired.filter((r) => r.stableId === game.player.stableId);
  const net = sumMoney(report.income) - sumMoney(report.expenses);
  const sorted = [...report.mine].sort((a, b) => b.record.wins - a.record.wins);

  return (
    <div className="modal" role="dialog" aria-modal="true" aria-labelledby="report-title">
      <div className="modal__box modal__box--wide">
        <h2 id="report-title">{t('report.title', { basho: bashoName(t, report.bashoIndex) })}</h2>

        {myPromotions.length > 0 && (
          <div className="callout">
            {myPromotions.map((p) => (
              <p key={p.id}>
                {t(`report.promotion.${p.to}` as MessageKey, { name: nameOf(p.id) })}
              </p>
            ))}
          </div>
        )}

        <h3>{t('report.mine')}</h3>
        {sorted.length === 0 ? (
          <p className="note">{t('report.noneMine')}</p>
        ) : (
          <table className="results">
            <tbody>
              {sorted.map((m) => {
                const kk = m.record.wins * 2 > m.record.wins + m.record.losses + m.record.absences;
                return (
                  <tr key={m.id}>
                    <th scope="row">{rankLabel(t, m.record.rank)}</th>
                    <td>{nameOf(m.id)}</td>
                    <td>
                      {recordLabel(t, m.record)}
                      <span className={`tag ${kk ? 'tag--good' : ''}`}>
                        {kk ? t('report.kachikoshi') : t('report.makekoshi')}
                      </span>
                      {m.record.yusho && <span className="tag tag--gold">{t('report.yusho')}</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        {report.injuries.length > 0 && (
          <p className="warn">
            {t('report.injuries', { names: report.injuries.map(nameOf).join('・') })}
          </p>
        )}
        {myRetired.length > 0 && (
          <p>
            {myRetired.map((r) => (
              <span key={r.id} className="block">
                {r.becameOyakata
                  ? t('report.retiredOyakata', { name: r.name })
                  : t('report.retired', { name: r.name })}
              </span>
            ))}
          </p>
        )}

        <h3>{t('report.champions')}</h3>
        <ul className="plain-list">
          {DIVS.map((d) =>
            report.yusho[d] !== undefined ? (
              <li key={d}>
                <span className="muted">{t(`rank.division.${d}`)}</span> {nameOf(report.yusho[d]!)}
                <span className="muted">
                  （{stableName.get(byId.get(report.yusho[d]!)?.stableId ?? -1) ?? '—'}）
                </span>
              </li>
            ) : null,
          )}
        </ul>
        {topPromotions.map((p) => (
          <p key={p.id}>{t(`report.promotion.${p.to}` as MessageKey, { name: nameOf(p.id) })}</p>
        ))}

        <p className="ledger__net">{t('report.money', { value: money(t, net, lang) })}</p>
        <div className="modal__actions">
          <button className="button button--primary" onClick={onClose} autoFocus>
            {t('common.close')}
          </button>
        </div>
      </div>
    </div>
  );
}
