import { useState } from 'react';
import { useSettings } from '../settings';
import { playSound } from '../sound';
import {
  atWall,
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
import { signedPoints } from '../points';
import { MoneyOutlook } from './MoneyOutlook';

type Menu = 'coach' | 'spar' | 'mune' | 'degeiko' | 'rest' | 'visit' | 'scout' | 'usual';
const MENUS: Menu[] = ['coach', 'spar', 'mune', 'degeiko', 'rest', 'visit', 'scout', 'usual'];
/** 相手を選ぶ行動（押すと右に一覧が出る）。ほかは押すとすぐ行う */
const PICKS: ReadonlySet<Menu> = new Set(['coach', 'spar', 'mune', 'visit', 'scout']);
/** 1行の説明に添える、けがの確率（%） */
const RISK: Partial<Record<Menu, number>> = {
  spar: Math.round(PREP.spar.injury * 100),
  mune: Math.round(PREP.mune.injury * 100),
};

/** 疲れは整数で持つので、小数をつけずに出す */
const signedInt = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${-n}` : '±0');

/** 週の結果を1行に */
export function weekLine(t: TranslateFn, game: GameState, w: WeekResult): string {
  const name = (id: number) => game.rikishi.find((r) => r.id === id)?.name ?? '?';
  const a = w.action;
  const gains = w.gains
    .slice(0, 2)
    .map((g) => {
      const parts = (['oshi', 'yotsu', 'waza'] as const)
        .filter((k) => g[k] !== 0)
        .map((k) => `${t(`style.${k}`)}${signedPoints(g[k])}`);
      if (g.weight !== 0) parts.push(`${t('report.training.weight')}${signed(g.weight)}`);
      if (g.fatigue !== 0) parts.push(`${t('talk.fatigue')}${signedInt(g.fatigue)}`);
      return `${name(g.id)} ${parts.join(' ')}`.trim();
    })
    .join(' / ');
  const hurt = w.injured.map((id) => t('prep.log.injured', { name: name(id) })).join(' ');
  const broke = (w.walls ?? []).map((x) => t('prep.log.broke', { name: name(x.id) })).join(' ');
  let head: string;
  switch (a.kind) {
    case 'coach':
      head = t('prep.log.coach');
      break;
    case 'spar':
      head = t('prep.log.spar');
      break;
    case 'mune':
      head = t('prep.log.mune');
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
  return [head, gains, broke, hurt].filter(Boolean).join(' ');
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
  // 選んだが、まだ決めていない行動（押し間違えないよう、「決定」で行う）。fill は残りの週をいつも通りに
  const [draft, setDraft] = useState<PrepAction | { kind: 'fill' } | null>(null);
  // 指している（フォーカスのある）コマンド。1行の説明に出す
  const [pointed, setPointed] = useState<Menu | null>(null);
  const { settings } = useSettings();
  const left = prepLeft(game);
  const week = game.prep.week + 1;
  const act = (a: PrepAction) => {
    const next = doPrep(game, a);
    // 稽古は当たる音、壁を破ったら太鼓、けがは落ちる音
    if (settings.sound && next !== game) {
      const done = next.prep.log[next.prep.log.length - 1];
      if ((done?.injured.length ?? 0) > 0) playSound('fall');
      else if ((done?.walls?.length ?? 0) > 0) playSound('drum');
      else if (a.kind === 'coach' || a.kind === 'spar' || a.kind === 'mune' || a.kind === 'degeiko')
        playSound('hit');
      else playSound('tick');
    }
    setGame(next);
    setMenu(null);
    setFirst(null);
    setDraft(null);
  };
  /** 残りの週をいつも通りにする */
  const fill = () => {
    let g = game;
    while (prepLeft(g) > 0 && canPrep(g, { kind: 'usual' })) g = doPrep(g, { kind: 'usual' });
    setGame(g);
    setMenu(null);
    setFirst(null);
    setDraft(null);
  };
  /** 決める前の確かめの1行（何を・だれに） */
  const draftText = (d: PrepAction | { kind: 'fill' }): string => {
    const nameOf = (id: number) => game.rikishi.find((r) => r.id === id)?.name ?? '?';
    switch (d.kind) {
      case 'fill':
        return t('prep.confirm.fill', { n: left });
      case 'coach':
      case 'mune':
        return t('prep.confirm.who', { cmd: t(`prep.cmd.${d.kind}`), who: nameOf(d.id) });
      case 'spar':
        return t('prep.confirm.who', {
          cmd: t('prep.cmd.spar'),
          who: t('prep.confirm.pair', { a: nameOf(d.a), b: nameOf(d.b) }),
        });
      case 'visit': {
        const p = game.player.koenkai.patrons.find((x) => x.id === d.patronId);
        return t('prep.confirm.who', {
          cmd: t('prep.cmd.visit'),
          who: p ? t(`patron.kind.${p.kind}` as MessageKey, { surname: p.surname }) : '?',
        });
      }
      case 'scout':
        return t('prep.confirm.who', {
          cmd: t('prep.cmd.scout'),
          who: t(`scout.${d.trip}.name` as MessageKey),
        });
      default:
        return t('prep.confirm.cmd', { cmd: t(`prep.cmd.${d.kind}`) });
    }
  };
  // 先週の行動で動いた量（弟子の疲れの横に出す）
  const lastWeek = game.prep.log[game.prep.log.length - 1];
  const gainOf = (id: number): { text: string; tone: 'up' | 'hurt' | 'wall' } | null => {
    if (!lastWeek) return null;
    if (lastWeek.injured.includes(id)) return { text: t('prep.hurt'), tone: 'hurt' };
    if (lastWeek.walls?.some((x) => x.id === id)) return { text: t('prep.broke'), tone: 'wall' };
    const g = lastWeek.gains.find((x) => x.id === id);
    if (!g) return null;
    const best = (['oshi', 'yotsu', 'waza'] as const)
      .filter((k) => g[k] > 0)
      .sort((a, b) => g[b] - g[a])[0];
    if (best) return { text: `${t(`style.${best}`)}${signedPoints(g[best])}`, tone: 'up' };
    if (g.fatigue < 0) return { text: `${t('talk.fatigue')}${signedInt(g.fatigue)}`, tone: 'up' };
    return null;
  };
  const order = new Map(game.banzuke.map((id, i) => [id, i]));
  const mine = game.rikishi
    .filter((r) => r.stableId === game.player.stableId)
    .sort((a, b) => (order.get(a.id) ?? 1e9) - (order.get(b.id) ?? 1e9));
  const cost: Partial<Record<Menu, number>> = {
    mune: PREP.mune.cost,
    degeiko: PREP.degeiko.cost,
    visit: KOENKAI.visitCost,
  };
  /** そのコマンドを、いま選べるか（相手を選ぶものは、選べる相手が1つでもあるか） */
  const usable = (m: Menu): boolean => {
    switch (m) {
      case 'coach':
      case 'mune':
        return mine.some((r) => canPrep(game, { kind: m, id: r.id }));
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
  /** 素質の壁に当たっている印（負荷をかけると素質が上がる） */
  const wallTag = (r: Rikishi) =>
    atWall(r) && (
      <span className="tag tag--wall" title={t('prep.wallDesc')}>
        {t('prep.wall')}
      </span>
    );
  const who = (r: Rikishi) => (
    <>
      <span className="prep__rank">{rankLabel(t, ranks.get(r.id) ?? null)}</span>
      <span className="prep__name">
        {r.name}
        {wallTag(r)}
      </span>
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
      <MoneyOutlook game={game} />
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
                onPointerEnter={() => setPointed(m)}
                onFocus={() => setPointed(m)}
                onClick={() => {
                  setFirst(null);
                  if (PICKS.has(m)) {
                    setMenu(menu === m ? null : m);
                    setDraft(null);
                  } else {
                    setMenu(m);
                    setDraft({ kind: m } as PrepAction);
                  }
                }}
              >
                <span>{t(`prep.cmd.${m}`)}</span>
                {cost[m] !== undefined && (
                  <span className="prep__cost">{money(t, cost[m]!, lang)}</span>
                )}
              </button>
            ))}
            <p className="prep__help" aria-live="polite">
              {t(`prep.desc.${pointed ?? menu ?? 'none'}` as MessageKey)}
              {RISK[pointed ?? menu ?? 'usual'] !== undefined && (
                <span className="prep__risk">
                  {t('prep.risk', { n: RISK[(pointed ?? menu)!]! })}
                </span>
              )}
            </p>
          </div>
          {draft && (
            <div className="prep__pick prep__confirm" role="group" aria-label={t('prep.decide')}>
              <p className="prep__week">{t('prep.confirm.title')}</p>
              <p className="prep__confirmtext" aria-live="polite">
                {draftText(draft)}
              </p>
              <div className="prep__confirmbtns">
                <button className="button" onClick={() => setDraft(null)}>
                  {t('prep.back')}
                </button>
                <button
                  className="button button--primary"
                  // 開いたら決定へフォーカスを移す（もう一度 Enter で行う）
                  autoFocus
                  onClick={() => (draft.kind === 'fill' ? fill() : act(draft))}
                >
                  {t('prep.decide')}
                </button>
              </div>
            </div>
          )}
          {!menu && !draft && (
            <div className="prep__pick prep__roster" aria-label={t('prep.roster')}>
              <p className="prep__week">{t('prep.roster')}</p>
              <ul>
                {mine.map((r) => (
                  <li key={r.id}>
                    <span className="prep__rank">{rankLabel(t, ranks.get(r.id) ?? null)}</span>
                    <span className="prep__name">
                      {r.name}
                      {wallTag(r)}
                    </span>
                    {(() => {
                      const g = gainOf(r.id);
                      return (
                        <span
                          key={`${game.bashoIndex}:${game.prep.week}`}
                          className={`prep__gain ${g ? `is-new is-${g.tone}` : ''}`}
                        >
                          {g?.text ?? ''}
                        </span>
                      );
                    })()}
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
          {menu && !draft && PICKS.has(menu) && (
            <div className="prep__pick" role="group" aria-label={t(`prep.cmd.${menu}`)}>
              <p className="prep__week">
                {menu === 'spar' && first !== null
                  ? t('prep.pick.sparSecond', {
                      name: mine.find((r) => r.id === first)?.name ?? '',
                    })
                  : t(`prep.pick.${menu}` as MessageKey)}
              </p>
              {(menu === 'coach' || menu === 'mune') &&
                mine.map((r) => (
                  <button
                    key={r.id}
                    className="prep__cmd"
                    disabled={!canPrep(game, { kind: menu, id: r.id })}
                    onClick={() => setDraft({ kind: menu, id: r.id })}
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
                      else setDraft({ kind: 'spar', a: first, b: r.id });
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
                    onClick={() => setDraft({ kind: 'visit', patronId: p.id })}
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
                    onClick={() => setDraft({ kind: 'scout', trip: id })}
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
              setMenu(null);
              setDraft({ kind: 'fill' });
            }}
          >
            {t('prep.fill')}
          </button>
        </div>
      )}
    </section>
  );
}
