import { freeNames, type GameState } from '@ichimon/sim';
import { useI18n } from '../i18n';
import { bashoName, rankLabel } from '../format';
import { FamilyTree } from './FamilyTree';
import { ShareTree } from './ShareTree';
import { Alumni } from './Alumni';

/** 一門の系譜: 歴代の親方・部屋の親方衆・家訓・名跡の空き */
export function LineageTab({ game }: { game: GameState }) {
  const { t } = useI18n();
  const staff = game.oyakata.filter((o) => o.stableId === game.player.stableId);
  return (
    <div className="stack">
      <section className="panel">
        <h2>{t('lineage.title')}</h2>
        <ol className="lineage">
          {game.player.lineage.map((l) => (
            <li key={l.generation} className="lineage__item">
              <div className="lineage__head">
                <span className="lineage__gen">{t('lineage.generation', { n: l.generation })}</span>
                <strong>{t('lineage.oyakata', { name: l.name, shikona: l.shikona })}</strong>
              </div>
              <div className="lineage__period">
                {bashoName(t, l.fromBashoIndex)} 〜{' '}
                {l.toBashoIndex === null ? t('lineage.now') : bashoName(t, l.toBashoIndex)}
              </div>
              <div className="lineage__stats">
                {t('lineage.stats', {
                  sekitori: l.sekitori,
                  sanyaku: l.sanyaku,
                  yokozuna: l.yokozuna,
                  yusho: l.makuuchiYusho,
                })}
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="panel">
        <h2>{t('family.title')}</h2>
        <p className="note">{t('family.note')}</p>
        <ShareTree game={game} />
        <FamilyTree game={game} />
      </section>

      <Alumni game={game} />

      <section className="panel">
        <h2>{t('lineage.staff')}</h2>
        <ul className="plain-list">
          {staff.map((o) => (
            <li key={o.id}>
              <strong>
                {o.role === 'waiting'
                  ? t('lineage.waitingName', { shikona: o.shikona })
                  : t('lineage.oyakata', { name: o.name, shikona: o.shikona })}
              </strong>
              <span className="tag">{t(`role.${o.role}`)}</span>
              <span className="muted">
                {t('lineage.staffMeta', {
                  age: o.age,
                  style: t(`style.${o.style}`),
                  highest: o.highestRank ? rankLabel(t, o.highestRank) : '—',
                })}
              </span>
            </li>
          ))}
        </ul>
        <p className="note">{t('lineage.successorNote', { free: freeNames(game).length })}</p>
      </section>

      <section className="panel">
        <h2>{t('lineage.kakun')}</h2>
        {game.player.kakun.length === 0 ? (
          <p className="note">{t('lineage.kakunEmpty')}</p>
        ) : (
          <ul className="plain-list">
            {game.player.kakun.map((k) => (
              <li key={k}>
                <strong>{t(`kakun.${k}.name`)}</strong>
                <span className="muted">{t(`kakun.${k}.desc`)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
