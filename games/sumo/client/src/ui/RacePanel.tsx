import { useState } from 'react';
import type { BashoReport, BoutResult, GameState, YushoRace } from '@ichimon/sim';
import { useI18n, type TranslateFn } from '../i18n';
import { bashoName, dayLabel } from '../format';
import { useSettings } from '../settings';
import { BoutViewer } from './BoutViewer';

function decidedText(t: TranslateFn, race: YushoRace): string {
  return race.decidedDay > 15
    ? t('race.decidedPlayoff')
    : t('race.decided', { day: dayLabel(t, race.decidedDay) });
}

/** 力士の名前（引退した力士は場所の結果から） */
function useNames(game: GameState, report: BashoReport) {
  const byId = new Map(game.rikishi.map((r) => [r.id, r]));
  const stable = new Map(game.stables.map((s) => [s.id, s.name]));
  return {
    name: (id: number) =>
      byId.get(id)?.name ?? report.retired.find((r) => r.id === id)?.name ?? '?',
    stable: (id: number) => {
      const sid = byId.get(id)?.stableId ?? report.retired.find((r) => r.id === id)?.stableId;
      return sid === undefined ? '—' : (stable.get(sid) ?? '—');
    },
    mine: (id: number) =>
      (byId.get(id)?.stableId ?? report.retired.find((r) => r.id === id)?.stableId) ===
      game.player.stableId,
  };
}

/** 場所の結果の「幕内の優勝争い」: 日ごとの先頭と、結びの一番 */
export function RaceSection({
  game,
  report,
  onWatch,
}: {
  game: GameState;
  report: BashoReport;
  onWatch: (b: BoutResult) => void;
}) {
  const { t } = useI18n();
  const race = report.race;
  const n = useNames(game, report);
  if (!race) return null;
  const sameBout =
    race.deciding !== null &&
    race.musubi !== null &&
    race.deciding.eastId === race.musubi.eastId &&
    race.deciding.westId === race.musubi.westId;
  return (
    <>
      <h3>{t('race.title')}</h3>
      <p>{decidedText(t, race)}</p>
      <table className="race">
        <tbody>
          {race.leaders.map((l) => (
            <tr key={l.day} className={l.day === race.decidedDay ? 'is-decided' : undefined}>
              <th scope="row">
                {dayLabel(t, l.day)}
                {l.day === race.decidedDay && <span aria-hidden="true"> ★</span>}
              </th>
              <td className="race__record">
                {t('race.record', { wins: l.wins, losses: l.losses })}
              </td>
              <td>
                {l.ids.map((id, i) => (
                  <span key={id} className={n.mine(id) ? 'is-mine-text' : undefined}>
                    {i > 0 && '・'}
                    {n.name(id)}
                    {n.mine(id) && <span className="visually-hidden">{t('race.mine')}</span>}
                  </span>
                ))}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="race__actions">
        {race.musubi && (
          <button className="button" onClick={() => onWatch(race.musubi!)}>
            {t('race.musubi', {
              east: n.name(race.musubi.eastId),
              west: n.name(race.musubi.westId),
            })}
          </button>
        )}
        {race.deciding && !sameBout && (
          <button className="button" onClick={() => onWatch(race.deciding!)}>
            {t('race.deciding')}
          </button>
        )}
      </div>
    </>
  );
}

/** 場所の見せ場: 自分の弟子が優勝の目を残して千秋楽を迎えた */
export function RaceCard({
  game,
  report,
  id,
  counter,
  last,
  onNext,
}: {
  game: GameState;
  report: BashoReport;
  id: number;
  counter: string;
  last: boolean;
  onNext: () => void;
}) {
  const { t } = useI18n();
  const { settings } = useSettings();
  const [watching, setWatching] = useState<BoutResult | null>(null);
  const n = useNames(game, report);
  const race = report.race;
  if (!race) return null;
  const winner = report.yusho.makuuchi;
  const finalBout = report.mine
    .find((m) => m.id === id)
    ?.bouts.find((b) => b.day === 15 && !b.fusen);
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
    <div className="modal" role="dialog" aria-modal="true" aria-labelledby="highlight-title">
      <div className="modal__box highlight">
        <h2 id="highlight-title" className="highlight__title">
          {t('race.cardTitle')}
        </h2>
        <p className="highlight__basho">
          {bashoName(t, report.bashoIndex)}
          {counter}
        </p>
        <p className="highlight__body">{t('race.after14')}</p>
        <ul className="plain-list race__contenders">
          {race.contenders.map((c) => (
            <li key={c.id} className={n.mine(c.id) ? 'is-mine-text' : undefined}>
              <strong>{n.name(c.id)}</strong>
              <span className="muted">（{n.stable(c.id)}）</span>{' '}
              {t('race.record', { wins: c.wins, losses: c.losses })}
              {n.mine(c.id) && <span className="tag">{t('race.mine')}</span>}
            </li>
          ))}
        </ul>
        {winner !== undefined && (
          <p className="highlight__body">
            {decidedText(t, race)}
            {t('race.winner', { name: n.name(winner) })}
          </p>
        )}
        <div className="modal__actions">
          {finalBout && (
            <button className="button" onClick={() => setWatching(finalBout)}>
              {t('race.watchMine', { name: n.name(id) })}
            </button>
          )}
          <button className="button button--primary" onClick={onNext}>
            {last ? t('highlight.toReport') : t('highlight.next')}
          </button>
        </div>
      </div>
    </div>
  );
}
