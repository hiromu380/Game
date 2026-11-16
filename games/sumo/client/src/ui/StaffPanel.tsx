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
  URAGATA_CAP,
  URAGATA_ROLES,
  uragataCount,
  uragataOf,
  type GameState,
  type StaffRole,
} from '@ichimon/sim';
import { useI18n } from '../i18n';
import { rankName } from '../format';
import { Lore } from './Glossary';
import { sprite } from '../art/sprites';

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
    <section className="panel" id="staff-panel">
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

      <h3 className="panel__sub">{t('uragata.title')}</h3>
      <ul className="plain-list">
        {URAGATA_ROLES.map((role) => {
          const u = uragataOf(game, role);
          const pic = sprite(`person_${role}`);
          return (
            <li key={role} className="row">
              {pic && (
                <img
                  className={`uragata__pic ${u ? '' : 'is-vacant'}`}
                  src={pic.url}
                  alt=""
                  aria-hidden="true"
                  width={pic.size[0] * 2}
                  height={pic.size[1] * 2}
                />
              )}
              <div className="row__main">
                <strong>{t(`uragata.${role}.name`)}</strong>
                <span className="muted">{t(`uragata.${role}.desc`)}</span>
                <span>
                  {u
                    ? t('uragata.current', {
                        name: u.name,
                        age: u.age,
                        years: Math.floor((game.bashoIndex - u.since) / 6) + 1,
                      })
                    : t('uragata.vacant')}
                </span>
                <span className="muted">
                  {t('uragata.cap', { count: uragataCount(game, role), cap: URAGATA_CAP[role] })}
                </span>
              </div>
            </li>
          );
        })}
      </ul>
      <Lore id="uragata" />

      <h3 className="panel__sub">{t('heyatsuki.title')}</h3>
      {(() => {
        const now = game.oyakata.filter(
          (o) => o.stableId === game.player.stableId && o.role === 'heyatsuki',
        );
        return now.length === 0 ? (
          <p>{t('heyatsuki.vacant')}</p>
        ) : (
          <ul className="plain-list">
            {now.map((o) => (
              <li key={o.id}>
                {t('heyatsuki.current', { name: o.name, shikona: o.shikona, age: o.age })}
              </li>
            ))}
          </ul>
        );
      })()}
      <p className="muted">{t('heyatsuki.note')}</p>

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
              <button data-dismiss className="button" onClick={() => setChoosing(null)}>
                {t('common.cancel')}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
