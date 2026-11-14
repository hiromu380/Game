import { OFFICE, type GameState } from '@ichimon/sim';
import { useI18n } from '../i18n';
import { bashoName, money } from '../format';

/** 理事会の顔ぶれと、自分の親方の協会での役職 */
export function BoardPanel({ game }: { game: GameState }) {
  const { t, lang } = useI18n();
  const rank = game.player.office.rank;
  const nameOf = (id: number) => {
    const o = game.oyakata.find((x) => x.id === id);
    if (!o) return '—';
    const stable = game.stables.find((s) => s.id === o.stableId);
    const ichimon = game.ichimon.find((i) => i.id === stable?.ichimonId);
    return t('board.member', {
      name: o.name,
      ichimon: ichimon ? t('assoc.ichimon', { name: ichimon.name }) : '',
      me: o.id === game.player.oyakataId ? t('board.you') : '',
    });
  };
  const b = game.board;
  return (
    <section className="panel">
      <h2>{t('board.title')}</h2>
      <p>
        {t('board.yourOffice', {
          office: t(`office.${rank}`),
          pay: money(t, OFFICE.monthly[rank], lang),
        })}
      </p>
      {b ? (
        <dl className="board">
          <div>
            <dt>{t('office.rijicho')}</dt>
            <dd>{b.rijicho !== null ? nameOf(b.rijicho) : '—'}</dd>
          </div>
          <div>
            <dt>{t('office.riji')}</dt>
            <dd>
              {b.riji
                .filter((id) => id !== b.rijicho)
                .map((id) => (
                  <span key={id} className="block">
                    {nameOf(id)}
                  </span>
                ))}
            </dd>
          </div>
          <div>
            <dt>{t('office.fukuRiji')}</dt>
            <dd>
              {b.fukuRiji.map((id) => (
                <span key={id} className="block">
                  {nameOf(id)}
                </span>
              ))}
            </dd>
          </div>
        </dl>
      ) : null}
      <p className="note">
        {b ? t('board.electedAt', { basho: bashoName(t, b.electedAt) }) : t('board.none')}{' '}
        {t('board.note')}
      </p>
    </section>
  );
}
