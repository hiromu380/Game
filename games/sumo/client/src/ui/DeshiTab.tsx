import { useState } from 'react';
import {
  atWall,
  chooseTreatment,
  inKyoshujo,
  sekitoriGain,
  setIntensity,
  setPlayHurt,
  setPolicy,
  stableCapacity,
  stableRoles,
  styleOf,
  type GameState,
  type Rank,
} from '@ichimon/sim';
import { useI18n } from '../i18n';
import { Lore } from './Glossary';
import { ownYokozuna, yumitoriOf } from '../ceremony';
import { rankLabel } from '../format';
import { lookOfRikishi } from '../art/Portraits';
import { RikishiDetail } from './RikishiDetail';
import { knownTraits, RikishiCard } from './RikishiCard';
import { targetOf, targetText } from '../targets';
import { withStep } from '../guide';
import { RosterTable } from './RosterTable';
import { useSettings } from '../settings';

/**
 * 弟子: 1人1行の一覧（地位・名前・型と方針・疲れ・札・近い目標）。押すと、その弟子のカード（稽古の方針・量・けがの扱い）を窓で開く
 */
export function DeshiTab({
  game,
  ranks,
  setGame,
}: {
  game: GameState;
  ranks: ReadonlyMap<number, Rank>;
  setGame: (g: GameState) => void;
}) {
  const { t } = useI18n();
  const { settings, update } = useSettings();
  const [open, setOpen] = useState<number | null>(null);
  const [detail, setDetail] = useState<number | null>(null);
  const [view, setView] = useState<'list' | 'table'>('list');
  const order = new Map(game.banzuke.map((id, i) => [id, i]));
  const mine = game.rikishi
    .filter((r) => r.stableId === game.player.stableId)
    .sort((a, b) => (order.get(a.id) ?? 1e9) - (order.get(b.id) ?? 1e9));
  const cap = stableCapacity(game);
  const roles = stableRoles(game, ranks);
  const nameOf = (id: number) => game.rikishi.find((x) => x.id === id)?.name ?? '?';
  const cooks = roles.cooks.size;
  const yumitori = yumitoriOf(game);
  const yokozunaName = nameOf(ownYokozuna(game)[0] ?? -1);
  /** 役目の1行（関取は付け人の名前） */
  const roleText = (id: number): string => {
    const role = roles.of.get(id);
    if (role === 'sekitori') {
      const att = roles.attendants.get(id) ?? [];
      return att.length > 0
        ? t('role.desc.sekitori', { names: att.map(nameOf).join('・') })
        : t('role.desc.sekitoriNone');
    }
    if (role === 'tsukebito')
      return t('role.desc.tsukebito', { name: nameOf(roles.serves.get(id)!) });
    if (role === 'chankoban') return t('role.desc.chankoban', { n: cooks });
    return role ? t(`role.desc.${role}`) : '';
  };
  const card = open === null ? undefined : mine.find((r) => r.id === open);
  const shown = detail === null ? undefined : mine.find((r) => r.id === detail);
  // 十両が目標の弟子は、関取になったら部屋の口座がいくら変わるかを添える
  const juryoGain = (id: number): number | null => {
    const r = mine.find((x) => x.id === id);
    const info = r ? targetOf(game, r, ranks) : null;
    return info?.target.kind === 'up' && info.target.to === 'juryo' ? sekitoriGain(game, id) : null;
  };
  return (
    <section className="panel deshi" aria-labelledby="mine-title">
      <h2 id="mine-title">{t('stable.title', { count: mine.length, cap })}</h2>
      {mine.length === 0 && <p className="note">{t('stable.empty')}</p>}
      {mine.length > 0 && (
        <div className="segmented deshi__view" role="group" aria-label={t('roster.view')}>
          {(['list', 'table'] as const).map((v) => (
            <button
              key={v}
              className={`segmented__btn ${view === v ? 'is-active' : ''}`}
              aria-pressed={view === v}
              onClick={() => setView(v)}
            >
              {t(`roster.${v}`)}
            </button>
          ))}
        </div>
      )}
      {view === 'table' && <RosterTable mine={mine} ranks={ranks} onOpen={setOpen} />}
      {view === 'list' && (
        <ul className="deshi__list">
          {mine.map((r) => {
            const info = targetOf(game, r, ranks);
            return (
              <li key={r.id}>
                <button
                  className="deshi__row"
                  onClick={() => setOpen(r.id)}
                  aria-label={t('deshi.open', { name: r.name })}
                >
                  <span className="deshi__rank">{rankLabel(t, ranks.get(r.id) ?? null)}</span>
                  <span className="deshi__name">
                    {r.name}
                    {atWall(r) && <span className="tag tag--wall">{t('prep.wall')}</span>}
                    {inKyoshujo(r) && <span className="tag">{t('deshi.kyoshujo')}</span>}
                    {r.living && <span className="tag">{t(`living.${r.living}`)}</span>}
                    {r.id === yumitori && <span className="tag">{t('role.yumitori')}</span>}
                    {r.injury > 0 && <span className="tag tag--warn">{t('prep.hurt')}</span>}
                    {(() => {
                      const role = roles.of.get(r.id);
                      return role && role !== 'sekitori' && role !== 'injured' ? (
                        <span className={`tag tag--role is-${role}`}>{t(`role.${role}`)}</span>
                      ) : null;
                    })()}
                    {game.pending.treatment.includes(r.id) && (
                      <span className="tag tag--warn">{t('deshi.ask')}</span>
                    )}
                  </span>
                  <span className="deshi__sub">
                    {t('deshi.sub', {
                      style: t(`style.${styleOf(r.abilities)}`),
                      policy: t(`policy.${r.policy}`),
                    })}
                  </span>
                  <span className="deshi__goal">{info ? targetText(t, info.target) : ''}</span>
                  <span
                    className="deshi__fatigue"
                    aria-label={`${t('talk.fatigue')} ${Math.round(r.fatigue)}`}
                  >
                    <span className="bar" aria-hidden="true">
                      <span
                        className={`bar__fill ${r.fatigue >= 70 ? 'bar__fill--warn' : ''}`}
                        style={{ width: `${Math.min(100, r.fatigue)}%` }}
                      />
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {card && (
        <div className="modal" role="dialog" aria-modal="true" aria-label={card.name}>
          <div className="modal__box deshi__sheet">
            <ul className="rikishi-list">
              <RikishiCard
                r={card}
                rank={ranks.get(card.id) ?? null}
                target={targetOf(game, card, ranks)}
                sekitoriYen={juryoGain(card.id)}
                onPolicy={(p) => {
                  setGame(setPolicy(game, card.id, p));
                  update({ guide: withStep(settings.guide, 'policy') });
                }}
                onIntensity={(i) => setGame(setIntensity(game, card.id, i))}
                onPlayHurt={(play) => setGame(setPlayHurt(game, card.id, play))}
                askTreatment={game.pending.treatment.includes(card.id)}
                onTreatment={(tr) => setGame(chooseTreatment(game, card.id, tr))}
                onDetail={() => setDetail(card.id)}
              />
            </ul>
            <div className="role-box">
              <h3>
                {t('role.title')}: {t(`role.${roles.of.get(card.id) ?? 'injured'}`)}
              </h3>
              <p>{roleText(card.id)}</p>
              {roles.noCook && <p className="role-box__warn">{t('role.desc.noCook')}</p>}
              {card.living && <p>{t(`living.${card.living}.desc`)}</p>}
              {card.id === yumitori && <p>{t('role.desc.yumitori', { name: yokozunaName })}</p>}
              <Lore
                id={
                  card.living
                    ? 'kurashi'
                    : roles.of.get(card.id) === 'chankoban' || roles.of.get(card.id) === 'upper'
                      ? 'chankoban'
                      : 'tsukebito'
                }
              />
            </div>
            <div className="modal__actions">
              <button className="button button--primary" data-dismiss onClick={() => setOpen(null)}>
                {t('deshi.close')}
              </button>
            </div>
          </div>
        </div>
      )}
      {shown && (
        <RikishiDetail
          subject={{
            name: shown.name,
            look: lookOfRikishi(shown, ranks.get(shown.id) ?? null),
            rank: ranks.get(shown.id) ?? null,
            age: shown.age,
            height: shown.height,
            weight: shown.weight,
            abilities: shown.abilities,
            foreign: shown.foreign,
            career: shown.career,
            track: shown.track,
            traits: knownTraits(shown),
          }}
          onClose={() => setDetail(null)}
        />
      )}
    </section>
  );
}
