import { isSekitori, masterOf, type GameState, type Rank } from '@ichimon/sim';
import { useI18n } from '../i18n';
import { OyakataPortrait } from '../art/Portraits';
import { bashoName } from '../format';

/** ライバルの部屋（同期の親方の部屋）: 関取の数と直接対決の通算 */
export function RivalPanel({ game, ranks }: { game: GameState; ranks: ReadonlyMap<number, Rank> }) {
  const { t } = useI18n();
  const rival = game.rival && game.stables.find((s) => s.id === game.rival!.stableId);
  if (!game.rival || !rival) return null;
  const master = masterOf(game, rival.id);
  const ichimon = game.ichimon.find((i) => i.id === rival.ichimonId);
  const count = (stableId: number) => {
    const rs = game.rikishi.filter((r) => r.stableId === stableId);
    return {
      all: rs.length,
      sekitori: rs.filter((r) => ranks.has(r.id) && isSekitori(ranks.get(r.id)!)).length,
    };
  };
  const mine = count(game.player.stableId);
  const theirs = count(rival.id);
  const { wins, losses } = game.rival;
  return (
    <section className="panel rival">
      <h2>{t('rival.title')}</h2>
      <div className="rival__head">
        {master && <OyakataPortrait o={master} size={56} />}
        <div>
          <strong className="rival__name">{t('top.stable', { name: rival.name })}</strong>
          <span className="muted">
            {t('rival.sub', {
              ichimon: ichimon ? t('assoc.ichimon', { name: ichimon.name }) : '',
              master: master
                ? t('lineage.oyakata', { name: master.name, shikona: master.shikona })
                : '—',
              age: master?.age ?? '—',
              since: bashoName(t, game.rival.since),
            })}
          </span>
        </div>
      </div>
      <dl className="tiles">
        <div className="tile">
          <dt>{t('rival.h2h')}</dt>
          <dd>{t('rival.record', { wins, losses })}</dd>
        </div>
        <div className="tile">
          <dt>{t('rival.sekitori')}</dt>
          <dd>{t('rival.versus', { mine: mine.sekitori, theirs: theirs.sekitori })}</dd>
        </div>
        <div className="tile">
          <dt>{t('rival.size')}</dt>
          <dd>{t('rival.versus', { mine: mine.all, theirs: theirs.all })}</dd>
        </div>
      </dl>
      <p className="note">{t('rival.note')}</p>
    </section>
  );
}
