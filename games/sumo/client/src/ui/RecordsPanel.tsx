import { useState } from 'react';
import { tokuiWaza, type Alumnus, type GameState } from '@ichimon/sim';
import { useI18n, type MessageKey, type TranslateFn } from '../i18n';
import { bashoName, money, rankLabel } from '../format';
import { lookOfAlumnus } from '../art/Portraits';
import { Figure } from '../art/Figure';
import { fameReasons, hallOfFame, stableRecords, type RecordKey } from '../records';
import { RikishiDetail } from './RikishiDetail';

/** 記録の値を文にする（稼ぎはお金の書き方） */
export function recordValue(
  t: TranslateFn,
  lang: 'ja' | 'en',
  key: RecordKey,
  value: number,
): string {
  if (key === 'earnings') return money(t, value, lang);
  return t(`records.unit.${key}` as MessageKey, { n: value });
}

/** 部屋の殿堂（横綱・大関・幕内優勝・三賞の多い元弟子） */
export function HallOfFame({ game }: { game: GameState }) {
  const { t } = useI18n();
  const [open, setOpen] = useState<Alumnus | null>(null);
  const list = hallOfFame(game);
  return (
    <section className="panel">
      <h2>{t('fame.title', { count: list.length })}</h2>
      <p className="note">{t('fame.note')}</p>
      {list.length === 0 ? (
        <p className="note">{t('fame.empty')}</p>
      ) : (
        <ul className="fame">
          {list.map((a) => {
            const waza = tokuiWaza(a.career);
            return (
              <li key={a.id}>
                <button className="fame__card" onClick={() => setOpen(a)}>
                  <Figure look={lookOfAlumnus(a, game.player.stableId)} variant="bust" size={64} />
                  <span className="fame__main">
                    <strong className="fame__name">{a.name}</strong>
                    <span>
                      {t('fame.meta', {
                        highest: a.career.highestRank ? rankLabel(t, a.career.highestRank) : '—',
                        wins: a.career.wins,
                        losses: a.career.losses,
                      })}
                    </span>
                    <span className="muted">
                      {t('fame.era', {
                        generation: a.generation,
                        basho: bashoName(t, a.retiredBashoIndex),
                      })}
                      {waza && t('fame.tokui', { waza: t(`kimarite.${waza}` as MessageKey) })}
                    </span>
                    <span>
                      {fameReasons(a).map((r) => (
                        <span key={r} className="tag tag--gold">
                          {t(`fame.reason.${r}` as MessageKey, {
                            n:
                              r === 'yusho'
                                ? a.career.makuuchiYusho
                                : a.career.sansho.shukun +
                                  a.career.sansho.kanto +
                                  a.career.sansho.gino,
                          })}
                        </span>
                      ))}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
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

/** 部屋の歴代記録（項目ごとに上位3人。今の弟子には印） */
export function RecordsPanel({ game }: { game: GameState }) {
  const { t, lang } = useI18n();
  const rows = stableRecords(game).filter((r) => r.holders.length > 0);
  return (
    <section className="panel">
      <h2>{t('records.title')}</h2>
      {rows.length === 0 ? (
        <p className="note">{t('records.empty')}</p>
      ) : (
        <dl className="records">
          {rows.map((row) => (
            <div key={row.key} className="records__row">
              <dt>{t(`records.key.${row.key}` as MessageKey)}</dt>
              <dd>
                <ol className="records__holders">
                  {row.holders.map((h, i) => (
                    <li key={h.id} className={i === 0 ? 'records__top' : undefined}>
                      <span className="records__rank">{t('records.place', { n: i + 1 })}</span>
                      <span className="records__name">{h.name}</span>
                      <span className="records__value">
                        {recordValue(t, lang, row.key, h.value)}
                      </span>
                      {h.active && <span className="tag">{t('records.active')}</span>}
                    </li>
                  ))}
                </ol>
              </dd>
            </div>
          ))}
        </dl>
      )}
      <p className="note">{t('records.note')}</p>
    </section>
  );
}
