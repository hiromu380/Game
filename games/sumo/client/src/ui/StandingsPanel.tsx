import { stableStandings, type GameState } from '@ichimon/sim';
import { useI18n } from '../i18n';

/** 何位まで並べるか（自分の部屋が下なら、その行も足す） */
const TOP = 5;

/** 部屋の力の番付（全部屋。番付の地位の点の合計） */
export function StandingsPanel({ game }: { game: GameState }) {
  const { t } = useI18n();
  const rows = stableStandings(game);
  const name = new Map(game.stables.map((s) => [s.id, s.name]));
  const mine = rows.find((r) => r.stableId === game.player.stableId);
  const shown = rows.slice(0, TOP);
  const rivalId = game.rival?.stableId;
  return (
    <section className="panel" aria-labelledby="standing-title">
      <h2 id="standing-title">{t('standing.title')}</h2>
      <ol className="standing">
        {shown.map((r) => (
          <Row
            key={r.stableId}
            r={r}
            name={name.get(r.stableId) ?? '—'}
            me={r === mine}
            rival={r.stableId === rivalId}
          />
        ))}
        {mine && !shown.includes(mine) && (
          <>
            <li className="standing__gap" aria-hidden="true">
              ⋮
            </li>
            <Row r={mine} name={name.get(mine.stableId) ?? '—'} me rival={false} />
          </>
        )}
      </ol>
      <p className="note">{t('standing.note', { total: rows.length })}</p>
    </section>
  );
}

function Row({
  r,
  name,
  me,
  rival,
}: {
  r: { place: number; strength: number };
  name: string;
  me: boolean;
  rival: boolean;
}) {
  const { t } = useI18n();
  return (
    <li className={`standing__row ${me ? 'is-mine' : ''}`}>
      <span className="standing__place">{t('standing.place', { place: r.place })}</span>
      <span className="standing__name">
        {name}
        {me && <span className="tag tag--gold">{t('standing.mine')}</span>}
        {rival && <span className="tag">{t('standing.rival')}</span>}
      </span>
      <span className="standing__pts">
        {t('standing.points', { n: Math.round(r.strength * 10) / 10 })}
      </span>
    </li>
  );
}
