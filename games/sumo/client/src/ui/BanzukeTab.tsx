import { useState } from 'react';
import { divisionCounts, type Division, type GameState, type Rank } from '@ichimon/sim';
import { useI18n } from '../i18n';
import { rankName, recordLabel } from '../format';

const DIVS: Division[] = ['makuuchi', 'juryo', 'makushita', 'sandanme', 'jonidan', 'jonokuchi'];

/** 番付表（段ごと。東西を並べ、自分の部屋の力士に印） */
export function BanzukeTab({ game, ranks }: { game: GameState; ranks: ReadonlyMap<number, Rank> }) {
  const { t } = useI18n();
  const [division, setDivision] = useState<Division>('makuuchi');
  const counts = divisionCounts(game.banzuke.length);
  let start = 0;
  for (const d of DIVS) {
    if (d === division) break;
    start += counts[d];
  }
  const ids = game.banzuke.slice(start, start + counts[division]);
  const byId = new Map(game.rikishi.map((r) => [r.id, r]));
  const stableName = new Map(game.stables.map((s) => [s.id, s.name]));
  // 東西の組（同じ枚目を1行に）
  const rowsMap = new Map<string, { east?: number; west?: number; key: string }>();
  for (const id of ids) {
    const rank = ranks.get(id)!;
    const key = `${rank.title ?? ''}-${rank.number}`;
    const row = rowsMap.get(key) ?? { key };
    if (rank.side === 'E') row.east = id;
    else row.west = id;
    rowsMap.set(key, row);
  }
  const rows = [...rowsMap.values()];

  const cell = (id: number | undefined) => {
    if (id === undefined) return <td className="banzuke__cell banzuke__cell--empty" />;
    const r = byId.get(id)!;
    const mine = r.stableId === game.player.stableId;
    const last = r.recent[0];
    return (
      <td className={`banzuke__cell ${mine ? 'is-mine' : ''}`}>
        <span className="banzuke__name">
          {mine && (
            <span className="mark" aria-label={t('banzuke.mine')}>
              ◆
            </span>
          )}
          {r.name}
        </span>
        <span className="banzuke__sub">
          {t('banzuke.stable', { name: stableName.get(r.stableId)! })}
          {last ? ` ${recordLabel(t, last)}` : ''}
        </span>
      </td>
    );
  };

  return (
    <section className="panel">
      <div className="segmented" role="tablist" aria-label={t('banzuke.division')}>
        {DIVS.map((d) => (
          <button
            key={d}
            role="tab"
            aria-selected={division === d}
            className={`segmented__btn ${division === d ? 'is-active' : ''}`}
            onClick={() => setDivision(d)}
          >
            {t(`rank.division.${d}`)}
          </button>
        ))}
      </div>
      <div className="banzuke__crest" aria-hidden="true">
        {t('banzuke.crest')}
      </div>
      <p className="note">{t('banzuke.note')}</p>
      <table className="banzuke">
        <thead>
          <tr>
            <th scope="col">{t('rank.side.E')}</th>
            <th scope="col" className="banzuke__rank">
              {t('banzuke.rank')}
            </th>
            <th scope="col">{t('rank.side.W')}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const any = (row.east ?? row.west)!;
            const rank = ranks.get(any)!;
            return (
              <tr key={row.key}>
                {cell(row.east)}
                <th scope="row" className="banzuke__rank">
                  {rankName(t, rank)}
                </th>
                {cell(row.west)}
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}
