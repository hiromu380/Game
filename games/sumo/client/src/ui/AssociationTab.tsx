import { useState } from 'react';
import { freeNames, isSekitori, masterOf, type GameState, type Rank } from '@ichimon/sim';
import { useI18n } from '../i18n';
import { RivalPanel } from './RivalPanel';
import { BoardPanel } from './BoardPanel';
import { OyakataPortrait } from '../art/Portraits';

/** 協会: 一門ごとの部屋（師匠・力士・関取の数）と、年寄名跡の空き */
export function AssociationTab({
  game,
  ranks,
}: {
  game: GameState;
  ranks: ReadonlyMap<number, Rank>;
}) {
  const { t } = useI18n();
  const mineIchimon = game.stables.find((s) => s.isPlayer)!.ichimonId;
  const [open, setOpen] = useState<number>(mineIchimon);
  const free = freeNames(game);
  const count = (stableId: number) => {
    const rs = game.rikishi.filter((r) => r.stableId === stableId);
    return {
      all: rs.length,
      sekitori: rs.filter((r) => ranks.has(r.id) && isSekitori(ranks.get(r.id)!)).length,
    };
  };
  const ichimon = [...game.ichimon].sort((a, b) =>
    a.id === mineIchimon ? -1 : b.id === mineIchimon ? 1 : a.id - b.id,
  );
  return (
    <div className="stack">
      <RivalPanel game={game} ranks={ranks} />
      <BoardPanel game={game} />
      <section className="panel">
        <h2>{t('assoc.title')}</h2>
        <p className="note">{t('assoc.note')}</p>
        <dl className="assoc-stats">
          <div>
            <dt>{t('assoc.stables')}</dt>
            <dd>{game.stables.length}</dd>
          </div>
          <div>
            <dt>{t('assoc.oyakata')}</dt>
            <dd>{game.oyakata.filter((o) => o.role !== 'waiting').length}</dd>
          </div>
          <div>
            <dt>{t('assoc.names')}</dt>
            <dd>
              {t('assoc.namesValue', {
                held: game.names.length - free.length,
                total: game.names.length,
              })}
            </dd>
          </div>
        </dl>
        <p>{free.length === 0 ? t('assoc.noFree') : t('assoc.free', { names: free.join('・') })}</p>
      </section>

      {ichimon.map((i) => {
        const stables = game.stables
          .filter((s) => s.ichimonId === i.id)
          .sort(
            (a, b) =>
              count(b.id).sekitori - count(a.id).sekitori || count(b.id).all - count(a.id).all,
          );
        const totals = stables.reduce(
          (n, s) => {
            const c = count(s.id);
            return { all: n.all + c.all, sekitori: n.sekitori + c.sekitori };
          },
          { all: 0, sekitori: 0 },
        );
        const isMine = i.id === mineIchimon;
        return (
          <section key={i.id} className={`panel ${isMine ? 'panel--mine' : ''}`}>
            <button
              className="assoc-head"
              aria-expanded={open === i.id}
              onClick={() => setOpen(open === i.id ? -1 : i.id)}
            >
              <span className="assoc-head__name">{t('assoc.ichimon', { name: i.name })}</span>
              {isMine && <span className="tag tag--gold">{t('assoc.mine')}</span>}
              <span className="muted">
                {t('assoc.ichimonStats', {
                  stables: stables.length,
                  all: totals.all,
                  sekitori: totals.sekitori,
                })}
              </span>
            </button>
            {open === i.id && (
              <ul className="assoc-list">
                {stables.map((s) => {
                  const m = masterOf(game, s.id);
                  const c = count(s.id);
                  const staff = game.oyakata.filter(
                    (o) => o.stableId === s.id && o.role !== 'master',
                  ).length;
                  return (
                    <li key={s.id} className={s.isPlayer ? 'is-mine' : ''}>
                      {m && <OyakataPortrait o={m} size={40} />}
                      <span className="assoc-list__main">
                        <strong>
                          {t('top.stable', { name: s.name })}
                          {s.isPlayer && <span className="tag">{t('assoc.yours')}</span>}
                          {s.branch && <span className="tag">{t('assoc.branch')}</span>}
                        </strong>
                        <span className="muted">
                          {t('assoc.stableStats', {
                            master: m
                              ? t('lineage.oyakata', { name: m.name, shikona: m.shikona })
                              : '—',
                            age: m?.age ?? '—',
                            all: c.all,
                            sekitori: c.sekitori,
                            staff,
                          })}
                        </span>
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}
