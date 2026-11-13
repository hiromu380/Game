import { useState } from 'react';
import {
  atWall,
  chooseTreatment,
  sekitoriGain,
  setIntensity,
  setPlayHurt,
  setPolicy,
  stableCapacity,
  styleOf,
  type GameState,
  type Rank,
} from '@ichimon/sim';
import { useI18n } from '../i18n';
import { rankLabel } from '../format';
import { lookOfRikishi } from '../art/Portraits';
import { RikishiDetail } from './RikishiDetail';
import { knownTraits, RikishiCard } from './RikishiCard';
import { targetOf, targetText } from '../targets';
import { withStep } from '../guide';
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
  const order = new Map(game.banzuke.map((id, i) => [id, i]));
  const mine = game.rikishi
    .filter((r) => r.stableId === game.player.stableId)
    .sort((a, b) => (order.get(a.id) ?? 1e9) - (order.get(b.id) ?? 1e9));
  const cap = stableCapacity(game);
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
                  {r.injury > 0 && <span className="tag tag--warn">{t('prep.hurt')}</span>}
                  {game.pending.treatment.includes(r.id) && (
                    <span className="tag tag--warn">{t('deshi.ask')}</span>
                  )}
                </span>
                <span className="deshi__sub">
                  {t(`style.${styleOf(r.abilities)}`)}・{t(`policy.${r.policy}`)}
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
