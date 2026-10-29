import { useState } from 'react';
import {
  chooseSuccessor,
  chooseTakeOver,
  GAME,
  pickKakun,
  type GameState,
  type KakunId,
} from '@ichimon/sim';
import { useI18n } from '../i18n';
import { rankLabel } from '../format';

/** 定年: 跡継ぎを選ぶ */
export function SuccessorDialog({
  game,
  setGame,
}: {
  game: GameState;
  setGame: (g: GameState) => void;
}) {
  const { t } = useI18n();
  const master = game.oyakata.find((o) => o.id === game.player.oyakataId)!;
  const candidates = game.oyakata.filter((o) => game.pending.successor!.includes(o.id));
  return (
    <div className="modal" role="dialog" aria-modal="true" aria-labelledby="succ-title">
      <div className="modal__box">
        <h2 id="succ-title">{t('successor.title')}</h2>
        <p>{t('successor.body', { name: master.name, age: master.age })}</p>
        <ul className="plain-list">
          {candidates.map((o) => (
            <li key={o.id} className="row">
              <div className="row__main">
                <strong>{t('lineage.oyakata', { name: o.name, shikona: o.shikona })}</strong>
                <span className="muted">
                  {t('lineage.staffMeta', {
                    age: o.age,
                    style: t(`style.${o.style}`),
                    highest: o.highestRank ? rankLabel(t, o.highestRank) : '—',
                  })}
                </span>
              </div>
              <button
                className="button button--primary"
                onClick={() => setGame(chooseSuccessor(game, o.id))}
              >
                {t('successor.choose')}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/** 代替わり: 家訓を書き加える */
export function KakunDialog({
  game,
  setGame,
}: {
  game: GameState;
  setGame: (g: GameState) => void;
}) {
  const { t } = useI18n();
  const [picked, setPicked] = useState<KakunId | null>(null);
  const full = game.player.kakun.length >= GAME.kakunSlots;
  return (
    <div className="modal" role="dialog" aria-modal="true" aria-labelledby="kakun-title">
      <div className="modal__box">
        <h2 id="kakun-title">{t('kakun.title')}</h2>
        <p>{t('kakun.body', { generation: game.player.generation })}</p>
        <ul className="plain-list">
          {game.pending.kakun!.map((k) => (
            <li key={k} className="row">
              <div className="row__main">
                <strong>{t(`kakun.${k}.name`)}</strong>
                <span className="muted">{t(`kakun.${k}.desc`)}</span>
              </div>
              <button
                className={`button ${picked === k ? 'button--primary' : ''}`}
                aria-pressed={picked === k}
                onClick={() => (full ? setPicked(k) : setGame(pickKakun(game, k)))}
              >
                {t('kakun.pick')}
              </button>
            </li>
          ))}
        </ul>
        {full && picked && (
          <>
            <p>{t('kakun.replace')}</p>
            <ul className="plain-list">
              {game.player.kakun.map((k, i) => (
                <li key={k} className="row">
                  <strong className="row__main">{t(`kakun.${k}.name`)}</strong>
                  <button className="button" onClick={() => setGame(pickKakun(game, picked, i))}>
                    {t('kakun.replaceThis')}
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
        <div className="modal__actions">
          <button className="button" onClick={() => setGame(pickKakun(game, null))}>
            {t('kakun.skip')}
          </button>
        </div>
      </div>
    </div>
  );
}

/** 本家の跡継ぎがいない: 分家を継ぐ */
export function TakeOverDialog({
  game,
  setGame,
}: {
  game: GameState;
  setGame: (g: GameState) => void;
}) {
  const { t } = useI18n();
  const master = game.oyakata.find((o) => o.id === game.player.oyakataId)!;
  const branches = game.stables.filter((s) => game.pending.takeOver!.includes(s.id));
  return (
    <div className="modal" role="dialog" aria-modal="true" aria-labelledby="take-title">
      <div className="modal__box">
        <h2 id="take-title">{t('takeOver.title')}</h2>
        <p>{t('takeOver.body', { name: master.name, age: master.age })}</p>
        <ul className="plain-list">
          {branches.map((s) => (
            <li key={s.id} className="row">
              <div className="row__main">
                <strong>{t('top.stable', { name: s.name })}</strong>
                <span className="muted">
                  {t('takeOver.meta', {
                    shikona: s.branch!.masterShikona,
                    age: s.branch!.masterAge,
                    count: game.rikishi.filter((r) => r.stableId === s.id).length,
                  })}
                </span>
              </div>
              <button
                className="button button--primary"
                onClick={() => setGame(chooseTakeOver(game, s.id))}
              >
                {t('takeOver.choose')}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
