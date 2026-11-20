import { useMemo, useState } from 'react';
import type { GameState, JournalEntry } from '@ichimon/sim';
import { useI18n, type MessageKey } from '../i18n';
import { isMilestone, journalGroup, journalText, type JournalGroup } from '../journal';
import { SavePanel } from './SavePanel';

const FILTERS: (JournalGroup | 'all')[] = ['all', 'stable', 'lineage', 'business'];
/** 最初に見せる年数・「もっと前」で足す年数 */
const YEARS_FIRST = 5;
const YEARS_MORE = 10;

/** 部屋の日誌（新しい年から）とセーブの書き出し・読み込み */
export function JournalTab({
  game,
  setGame,
}: {
  game: GameState;
  setGame: (g: GameState) => void;
}) {
  const { t } = useI18n();
  const [filter, setFilter] = useState<JournalGroup | 'all'>('all');
  const [years, setYears] = useState(YEARS_FIRST);
  const byYear = useMemo(() => {
    const map = new Map<number, JournalEntry[]>();
    for (const e of game.journal) {
      const g = journalGroup(e);
      if (filter !== 'all' && g !== null && g !== filter) continue;
      const y = Math.floor(e.bashoIndex / 6);
      if (!map.has(y)) map.set(y, []);
      map.get(y)!.push(e);
    }
    return [...map.entries()].sort((a, b) => b[0] - a[0]);
  }, [game.journal, filter]);
  const shown = byYear.slice(0, years);

  return (
    <div className="stack">
      <section className="panel">
        <h2>{t('journal.title')}</h2>
        <p className="note">{t('journal.note')}</p>
        <div className="segmented" role="group" aria-label={t('journal.filter')}>
          {FILTERS.map((f) => (
            <button
              key={f}
              className={`segmented__btn ${filter === f ? 'is-active' : ''}`}
              aria-pressed={filter === f}
              onClick={() => {
                setFilter(f);
                setYears(YEARS_FIRST);
              }}
            >
              {t(`journal.filter.${f}`)}
            </button>
          ))}
        </div>
        {shown.length === 0 && <p>{t('journal.empty')}</p>}
        {shown.map(([year, entries]) => (
          <section key={year} className="journal-year">
            <h3>{t('journal.year', { year: year + 1 })}</h3>
            <ol className="journal">
              {[...entries].reverse().map((e, i) => (
                <li key={i} className={isMilestone(e) ? 'is-milestone' : ''}>
                  <span className="journal__when">
                    {t(`basho.${e.bashoIndex % 6}` as MessageKey)}
                  </span>
                  <span className="journal__text">
                    {isMilestone(e) && <span aria-hidden="true">★ </span>}
                    {journalText(t, e)}
                  </span>
                </li>
              ))}
            </ol>
          </section>
        ))}
        {byYear.length > years && (
          <button className="button" onClick={() => setYears(years + YEARS_MORE)}>
            {t('journal.more')}
          </button>
        )}
      </section>
      <SavePanel game={game} setGame={setGame} />
    </div>
  );
}
