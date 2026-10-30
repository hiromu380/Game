import { useState } from 'react';
import { danpatsuPlan, type Alumnus, type GameState } from '@ichimon/sim';
import { useI18n } from '../i18n';
import { bashoName, rankLabel } from '../format';
import { lookOfAlumnus } from '../art/Portraits';
import { Figure } from '../art/Figure';
import { RikishiDetail } from './RikishiDetail';

/** 部屋の歴代の力士（最高位の高い順）。押すと詳細 */
export function Alumni({ game }: { game: GameState }) {
  const { t } = useI18n();
  const [open, setOpen] = useState<Alumnus | null>(null);
  const list = [...game.player.alumni].sort(
    (a, b) =>
      a.career.highestOrder - b.career.highestOrder || a.retiredBashoIndex - b.retiredBashoIndex,
  );
  return (
    <section className="panel">
      <h2>{t('alumni.title', { count: list.length })}</h2>
      {list.length === 0 ? (
        <p className="note">{t('alumni.empty')}</p>
      ) : (
        <ul className="alumni">
          {list.map((a) => (
            <li key={a.id}>
              <button className="alumni__item" onClick={() => setOpen(a)}>
                <Figure look={lookOfAlumnus(a, game.player.stableId)} variant="bust" size={48} />
                <span className="alumni__main">
                  <strong>{a.name}</strong>
                  <span className="muted">
                    {t('alumni.meta', {
                      highest: a.career.highestRank ? rankLabel(t, a.career.highestRank) : '—',
                      wins: a.career.wins,
                      losses: a.career.losses,
                      basho: bashoName(t, a.retiredBashoIndex),
                    })}
                  </span>
                </span>
                {a.becameOyakata && <span className="tag">{t('alumni.oyakata')}</span>}
                <DanpatsuTag a={a} now={game.bashoIndex} />
                {a.career.makuuchiYusho > 0 && (
                  <span className="tag tag--gold">
                    {t('alumni.yusho', { n: a.career.makuuchiYusho })}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
      {open && (
        <RikishiDetail
          subject={{
            name: open.name,
            look: lookOfAlumnus(open, game.player.stableId),
            rank: null,
            age: open.retiredAge,
            foreign: open.foreign,
            career: open.career,
            track: open.track,
            retiredNote: t('alumni.retiredNote', {
              basho: bashoName(t, open.retiredBashoIndex),
              age: open.retiredAge,
            }),
          }}
          onClose={() => setOpen(null)}
        />
      )}
    </section>
  );
}

/** 断髪式がまだなら、いつ行うか */
function DanpatsuTag({ a, now }: { a: Alumnus; now: number }) {
  const { t } = useI18n();
  const plan = danpatsuPlan(a);
  if (!plan || plan.bashoIndex < now) return null;
  return (
    <span className="tag">
      {t(plan.venue === 'kokugikan' ? 'alumni.danpatsuKokugikan' : 'alumni.danpatsu', {
        basho: bashoName(t, plan.bashoIndex),
      })}
    </span>
  );
}
