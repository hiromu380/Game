import { useState } from 'react';
import {
  alumnusAge,
  DIET_IDS,
  DIETS,
  dismissStaff,
  hireStaff,
  setDiet,
  staffCandidates,
  staffOf,
  staffSkill,
  STAFF_IDS,
  type GameState,
  type StaffRole,
} from '@ichimon/sim';
import { useI18n } from '../i18n';
import { rankName } from '../format';

function Skill({ skill }: { skill: number }) {
  const { t } = useI18n();
  return (
    <span className="grade" aria-label={t('staff.skillAria', { skill })}>
      {'★'.repeat(skill)}
      <span className="grade__off">{'☆'.repeat(3 - skill)}</span>
    </span>
  );
}

/** 部屋の人（元弟子の若者頭・世話人）とちゃんこの方針 */
export function StaffPanel({
  game,
  setGame,
}: {
  game: GameState;
  setGame: (g: GameState) => void;
}) {
  const { t } = useI18n();
  const [choosing, setChoosing] = useState<StaffRole | null>(null);
  return (
    <section className="panel">
      <h2>{t('staff.title')}</h2>
      <p className="note">{t('staff.note')}</p>
      <ul className="plain-list">
        {STAFF_IDS.map((role) => {
          const s = staffOf(game, role);
          const candidates = staffCandidates(game, role);
          return (
            <li key={role} className="row">
              <div className="row__main">
                <strong>{t(`staff.${role}.name`)}</strong>
                <span className="muted">{t(`staff.${role}.desc`)}</span>
                <span>
                  {s ? (
                    <>
                      {t('staff.current', { name: s.name, age: s.age })} <Skill skill={s.skill} />
                    </>
                  ) : (
                    t('staff.vacant')
                  )}
                </span>
              </div>
              <div className="row__actions">
                <button
                  className="button"
                  disabled={candidates.length === 0}
                  onClick={() => setChoosing(role)}
                >
                  {candidates.length === 0 ? t('staff.noCandidates') : t('staff.choose')}
                </button>
                {s && (
                  <button className="button" onClick={() => setGame(dismissStaff(game, role))}>
                    {t('staff.dismiss')}
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      <h3 className="panel__sub">{t('diet.title')}</h3>
      <div className="segmented" role="group" aria-label={t('diet.title')}>
        {DIET_IDS.map((d) => (
          <button
            key={d}
            className={`segmented__btn ${game.player.diet === d ? 'is-active' : ''}`}
            aria-pressed={game.player.diet === d}
            onClick={() => setGame(setDiet(game, d))}
          >
            {t(`diet.${d}.name`)}
          </button>
        ))}
      </div>
      <p className="muted">
        {t(`diet.${game.player.diet}.desc`)}{' '}
        {t('diet.food', { percent: Math.round(DIETS[game.player.diet].food * 100) })}
      </p>

      {choosing && (
        <div className="modal" role="dialog" aria-modal="true" aria-labelledby="staff-title">
          <div className="modal__box">
            <h2 id="staff-title">
              {t('staff.chooseTitle', { role: t(`staff.${choosing}.name`) })}
            </h2>
            <ul className="plain-list">
              {staffCandidates(game, choosing).map((a) => (
                <li key={a.id} className="row">
                  <div className="row__main">
                    <strong>{a.name}</strong>
                    <span className="muted">
                      {t('staff.candidate', {
                        age: alumnusAge(game, a),
                        highest: a.career.highestRank ? rankName(t, a.career.highestRank) : '',
                        basho: a.career.basho,
                      })}
                    </span>
                    <Skill skill={staffSkill(a)} />
                  </div>
                  <div className="row__actions">
                    <button
                      className="button button--primary"
                      onClick={() => {
                        setGame(hireStaff(game, choosing, a.id));
                        setChoosing(null);
                      }}
                    >
                      {t('staff.hire')}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
            <div className="modal__actions">
              <button className="button" onClick={() => setChoosing(null)}>
                {t('common.cancel')}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
