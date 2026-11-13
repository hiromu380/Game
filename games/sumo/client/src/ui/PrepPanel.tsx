import { useState } from 'react';
import {
  canPrep,
  doPrep,
  KOENKAI,
  PREP,
  prepLeft,
  SCOUT_TRIP_IDS,
  SCOUT_TRIPS,
  type GameState,
  type PrepAction,
  type Rank,
  type Rikishi,
  type WeekResult,
} from '@ichimon/sim';
import { useI18n, type MessageKey, type TranslateFn } from '../i18n';
import { money, rankLabel } from '../format';
import { signed } from './TrainingSection';

type Menu = 'coach' | 'spar' | 'degeiko' | 'rest' | 'visit' | 'scout' | 'usual';
const MENUS: Menu[] = ['coach', 'spar', 'degeiko', 'rest', 'visit', 'scout', 'usual'];
/** 相手を選ぶ行動（押すと右に一覧が出る）。ほかは押すとすぐ行う */
const PICKS: ReadonlySet<Menu> = new Set(['coach', 'spar', 'visit', 'scout']);

/** 週の結果を1行に */
export function weekLine(t: TranslateFn, game: GameState, w: WeekResult): string {
  const name = (id: number) => game.rikishi.find((r) => r.id === id)?.name ?? '?';
  const a = w.action;
  const gains = w.gains
    .slice(0, 2)
    .map((g) => {
      const parts = (['oshi', 'yotsu', 'waza'] as const)
        .filter((k) => g[k] !== 0)
        .map((k) => `${t(`style.${k}`)}${signed(g[k])}`);
      if (g.weight !== 0) parts.push(`${t('report.training.weight')}${signed(g.weight)}`);
      if (g.fatigue !== 0) parts.push(`${t('talk.fatigue')}${signed(g.fatigue)}`);
      return `${name(g.id)} ${parts.join(' ')}`.trim();
    })
    .join(' / ');
  const hurt = w.injured.map((id) => t('prep.log.injured', { name: name(id) })).join(' ');
  let head: string;
  switch (a.kind) {
    case 'coach':
      head = t('prep.log.coach');
      break;
    case 'spar':
      head = t('prep.log.spar');
      break;
    case 'degeiko':
      return t('prep.log.degeiko', { n: w.gains.length });
    case 'rest':
      return t('prep.log.rest');
    case 'visit': {
      const p = game.player.koenkai.patrons.find((x) => x.id === a.patronId);
      return t('prep.log.visit', {
        name: p ? t(`patron.kind.${p.kind}` as MessageKey, { surname: p.surname }) : '?',
      });
    }
    case 'scout':
      return t(w.met ? 'prep.log.scout' : 'prep.log.scoutNone', {
        trip: t(`scout.${a.trip}.name` as MessageKey),
        n: w.met ?? 0,
      });
    case 'usual':
      return t('prep.log.usual');
  }
  return [head, gains, hurt].filter(Boolean).join(' ');
}

/** 場所前の4週間: 毎週1つ、親方の行動をコマンドで選ぶ */
export function PrepPanel({
  game,
  ranks,
  setGame,
}: {
  game: GameState;
  ranks: ReadonlyMap<number, Rank>;
  setGame: (g: GameState) => void;
}) {
  const { t, lang } = useI18n();
  const [menu, setMenu] = useState<Menu | null>(null);
  const [first, setFirst] = useState<number | null>(null);
  const left = prepLeft(game);
  const week = game.prep.week + 1;
  const act = (a: PrepAction) => {
    setGame(doPrep(game, a));
    setMenu(null);
    setFirst(null);
  };
  const order = new Map(game.banzuke.map((id, i) => [id, i]));
  const mine = game.rikishi
    .filter((r) => r.stableId === game.player.stableId)
    .sort((a, b) => (order.get(a.id) ?? 1e9) - (order.get(b.id) ?? 1e9));
  const cost: Partial<Record<Menu, number>> = {
    degeiko: PREP.degeiko.cost,
    visit: KOENKAI.visitCost,
  };
  /** そのコマンドを、いま選べるか（相手を選ぶものは、選べる相手が1つでもあるか） */
  const usable = (m: Menu): boolean => {
    switch (m) {
      case 'coach':
        return mine.some((r) => canPrep(game, { kind: 'coach', id: r.id }));
      case 'spar':
        return mine.filter((r) => r.injury === 0).length >= 2 && canPrep(game, { kind: 'usual' });
      case 'visit':
        return game.player.koenkai.patrons.some((p) =>
          canPrep(game, { kind: 'visit', patronId: p.id }),
        );
      case 'scout':
        return SCOUT_TRIP_IDS.some((id) => canPrep(game, { kind: 'scout', trip: id }));
      default:
        return canPrep(game, { kind: m });
    }
  };
  const who = (r: Rikishi) => (
    <>
      <span className="prep__rank">{rankLabel(t, ranks.get(r.id) ?? null)}</span>
      <span className="prep__name">{r.name}</span>
      <span className="prep__sub">
        {r.injury > 0
          ? t('prep.hurt')
          : `${t(`policy.${r.policy}`)}・${t('talk.fatigue')}${Math.round(r.fatigue)}`}
      </span>
    </>
  );

  return (
    <section className="panel prep" id="prep-panel" aria-labelledby="prep-title">
      <h2 id="prep-title">
        {t('prep.title')}
        <span className="prep__weeks" aria-label={t('prep.left', { n: left })}>
          {Array.from({ length: PREP.weeks }, (_, i) => (
            <span
              key={i}
              aria-hidden="true"
              className={`prep__pip ${i < game.prep.week ? 'is-done' : i === game.prep.week ? 'is-now' : ''}`}
            />
          ))}
        </span>
      </h2>
      {left === 0 ? (
        <p className="prep__done">{t('prep.done')}</p>
      ) : (
        <div className="prep__body">
          <div className="prep__menu" role="group" aria-label={t('prep.week', { n: week })}>
            <p className="prep__week">{t('prep.week', { n: week })}</p>
            {MENUS.map((m) => (
              <button
                key={m}
                className={`prep__cmd ${menu === m ? 'is-selected' : ''}`}
                aria-pressed={PICKS.has(m) ? menu === m : undefined}
                disabled={!usable(m)}
                onClick={() => {
                  setFirst(null);
                  if (PICKS.has(m)) setMenu(menu === m ? null : m);
                  else act({ kind: m } as PrepAction);
                }}
              >
                <span>{t(`prep.cmd.${m}`)}</span>
                {cost[m] !== undefined && (
                  <span className="prep__cost">{money(t, cost[m]!, lang)}</span>
                )}
              </button>
            ))}
          </div>
          {!menu && (
            <div className="prep__pick prep__roster" aria-label={t('prep.roster')}>
              <p className="prep__week">{t('prep.roster')}</p>
              <ul>
                {mine.map((r) => (
                  <li key={r.id}>
                    <span className="prep__rank">{rankLabel(t, ranks.get(r.id) ?? null)}</span>
                    <span className="prep__name">{r.name}</span>
                    {r.injury > 0 ? (
                      <span className="tag tag--warn">{t('prep.hurt')}</span>
                    ) : (
                      <span
                        className="prep__fatigue"
                        aria-label={`${t('talk.fatigue')} ${Math.round(r.fatigue)}`}
                      >
                        <span className="bar" aria-hidden="true">
                          <span
                            className={`bar__fill ${r.fatigue >= 70 ? 'bar__fill--warn' : ''}`}
                            style={{ width: `${Math.min(100, r.fatigue)}%` }}
                          />
                        </span>
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {menu && (
            <div className="prep__pick" role="group" aria-label={t(`prep.cmd.${menu}`)}>
              <p className="prep__week">
                {menu === 'spar' && first !== null
                  ? t('prep.pick.sparSecond', {
                      name: mine.find((r) => r.id === first)?.name ?? '',
                    })
                  : t(`prep.pick.${menu}` as MessageKey)}
              </p>
              {menu === 'coach' &&
                mine.map((r) => (
                  <button
                    key={r.id}
                    className="prep__cmd"
                    disabled={!canPrep(game, { kind: 'coach', id: r.id })}
                    onClick={() => act({ kind: 'coach', id: r.id })}
                  >
                    {who(r)}
                  </button>
                ))}
              {menu === 'spar' &&
                mine.map((r) => (
                  <button
                    key={r.id}
                    className={`prep__cmd ${first === r.id ? 'is-selected' : ''}`}
                    aria-pressed={first === r.id}
                    disabled={r.injury > 0}
                    onClick={() => {
                      if (first === null) setFirst(r.id);
                      else if (first === r.id) setFirst(null);
                      else act({ kind: 'spar', a: first, b: r.id });
                    }}
                  >
                    {who(r)}
                  </button>
                ))}
              {menu === 'visit' &&
                game.player.koenkai.patrons.map((p) => (
                  <button
                    key={p.id}
                    className="prep__cmd"
                    disabled={!canPrep(game, { kind: 'visit', patronId: p.id })}
                    onClick={() => act({ kind: 'visit', patronId: p.id })}
                  >
                    <span className="prep__name">
                      {t(`patron.kind.${p.kind}` as MessageKey, { surname: p.surname })}
                    </span>
                    <span className="prep__sub">
                      {t('koenkai.favorAria', { favor: Math.round(p.favor) })}
                    </span>
                  </button>
                ))}
              {menu === 'scout' &&
                SCOUT_TRIP_IDS.map((id) => (
                  <button
                    key={id}
                    className="prep__cmd"
                    disabled={!canPrep(game, { kind: 'scout', trip: id })}
                    onClick={() => act({ kind: 'scout', trip: id })}
                  >
                    <span className="prep__name">{t(`scout.${id}.name` as MessageKey)}</span>
                    <span className="prep__cost">{money(t, SCOUT_TRIPS[id].cost, lang)}</span>
                    <span className="prep__sub">{t(`scout.${id}.desc` as MessageKey)}</span>
                  </button>
                ))}
            </div>
          )}
        </div>
      )}
      {game.prep.log.length > 0 && (
        <ol className="prep__log" aria-label={t('prep.logAria')}>
          {game.prep.log.map((w) => (
            <li key={w.week} className={w.injured.length > 0 ? 'is-hurt' : undefined}>
              <span className="prep__logweek">{t('prep.week', { n: w.week })}</span>
              {t(`prep.cmd.${w.action.kind}`)}
              <span className="prep__logtext">{weekLine(t, game, w)}</span>
            </li>
          ))}
        </ol>
      )}
      {left > 0 && (
        <div className="prep__foot">
          <button
            className="button"
            onClick={() => {
              let g = game;
              while (prepLeft(g) > 0 && canPrep(g, { kind: 'usual' }))
                g = doPrep(g, { kind: 'usual' });
              setGame(g);
              setMenu(null);
            }}
          >
            {t('prep.fill')}
          </button>
        </div>
      )}
    </section>
  );
}
