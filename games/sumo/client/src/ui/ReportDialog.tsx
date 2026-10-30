import { useState } from 'react';
import {
  sumMoney,
  type BashoReport,
  type BoutResult,
  type Division,
  type GameState,
  type Rank,
} from '@ichimon/sim';
import { useI18n, type MessageKey } from '../i18n';
import { bashoName, money, rankLabel, recordLabel } from '../format';
import { useSettings } from '../settings';
import { BoutViewer } from './BoutViewer';

const DIVS: Division[] = ['makuuchi', 'juryo', 'makushita', 'sandanme', 'jonidan', 'jonokuchi'];
const DIV_ORDER = new Map(DIVS.map((d, i) => [d, i]));
const TITLE_ORDER: Record<string, number> = { Y: 0, O: 1, S: 2, K: 3, M: 4 };

/** 地位の高さ（小さいほど上）。番付の上がり下がりの矢印に使う */
function rankValue(r: Rank): number {
  return (
    DIV_ORDER.get(r.division)! * 1000 +
    (r.title ? TITLE_ORDER[r.title]! * 100 : 0) +
    r.number * 2 +
    (r.side === 'W' ? 1 : 0)
  );
}

/** 場所の結果: 昇進・星取表（取組を見る）・番付発表・巡業・各段の優勝・引退・お金 */
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
  const { settings } = useSettings();
  const [watching, setWatching] = useState<BoutResult | null>(null);
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
  const sorted = [...report.mine].sort(
    (a, b) => rankValue(a.record.rank) - rankValue(b.record.rank),
  );

  if (watching) {
    return (
      <BoutViewer
        game={game}
        bout={watching}
        sound={settings.sound}
        onClose={() => setWatching(null)}
      />
    );
  }

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

        <h3>{t('report.hoshitori')}</h3>
        {sorted.length === 0 ? (
          <p className="note">{t('report.noneMine')}</p>
        ) : (
          <>
            <p className="note">{t('report.hoshitoriNote')}</p>
            <ul className="hoshitori">
              {sorted.map((m) => {
                const kk = m.record.wins * 2 > m.record.wins + m.record.losses + m.record.absences;
                return (
                  <li key={m.id} className="hoshitori__row">
                    <div className="hoshitori__head">
                      <span className="hoshitori__rank">{rankLabel(t, m.record.rank)}</span>
                      <strong>{nameOf(m.id)}</strong>
                      <span>{recordLabel(t, m.record)}</span>
                      <span className={`tag ${kk ? 'tag--good' : ''}`}>
                        {kk ? t('report.kachikoshi') : t('report.makekoshi')}
                      </span>
                      {m.record.yusho && <span className="tag tag--gold">{t('report.yusho')}</span>}
                    </div>
                    <div className="hoshitori__bouts">
                      {m.bouts.map((b) => {
                        const won = b.winnerId === m.id;
                        const opp = b.eastId === m.id ? b.westId : b.eastId;
                        return (
                          <button
                            key={b.day}
                            className={`star ${won ? 'star--win' : 'star--loss'}`}
                            onClick={() => setWatching(b)}
                            aria-label={t('report.boutAria', {
                              day: b.day,
                              result: won ? t('report.win') : t('report.loss'),
                              opponent: nameOf(opp),
                              kimarite: t(`kimarite.${b.kimarite}` as MessageKey),
                            })}
                          >
                            {won ? '○' : '●'}
                          </button>
                        );
                      })}
                      {Array.from({ length: m.record.absences }, (_, i) => (
                        <span
                          key={`a${i}`}
                          className="star star--absent"
                          aria-label={t('report.absent')}
                        >
                          ■
                        </span>
                      ))}
                    </div>
                  </li>
                );
              })}
            </ul>
          </>
        )}

        {report.banzukeChanges.length > 0 && (
          <>
            <h3>{t('report.banzuke')}</h3>
            <ul className="plain-list changes">
              {report.banzukeChanges.map((c) => {
                const dir =
                  c.to === null
                    ? 0
                    : rankValue(c.to) < rankValue(c.from)
                      ? 1
                      : rankValue(c.to) > rankValue(c.from)
                        ? -1
                        : 0;
                return (
                  <li key={c.id} className="changes__item">
                    <strong>{nameOf(c.id)}</strong>
                    <span className={dir > 0 ? 'up' : dir < 0 ? 'down' : ''}>
                      {dir > 0 ? t('report.up') : dir < 0 ? t('report.down') : t('report.same')}
                    </span>
                    <span className="changes__ranks">
                      {rankLabel(t, c.from)} →{' '}
                      {c.to ? rankLabel(t, c.to) : t('report.retiredShort')}
                    </span>
                  </li>
                );
              })}
            </ul>
          </>
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
        {report.jungyo && <p className="callout">{t(`jungyo.${report.jungyo}` as MessageKey)}</p>}

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
        {report.playoff && (
          <p>{t('report.playoff', { names: report.playoff.map(nameOf).join('・') })}</p>
        )}

        <h3>{t('report.sansho')}</h3>
        <ul className="plain-list">
          {(['shukun', 'kanto', 'gino'] as const).map((k) => (
            <li key={k}>
              <span className="muted">{t(`sansho.${k}`)}</span>{' '}
              {report.sansho[k].length === 0
                ? t('report.sanshoNone')
                : report.sansho[k].map((id) => (
                    <span key={id} className={mineIds.has(id) ? 'is-mine-text' : ''}>
                      {nameOf(id)}
                      <span className="muted">
                        （{stableName.get(byId.get(id)?.stableId ?? -1) ?? '—'}）
                      </span>
                    </span>
                  ))}
            </li>
          ))}
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
