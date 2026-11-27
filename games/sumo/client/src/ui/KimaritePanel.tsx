import type { GameState, KimariteGroup } from '@ichimon/sim';
import { useI18n, type MessageKey } from '../i18n';
import { KIMARITE_DESC, kimariteBook, kimariteCollected } from '../kimariteBook';

const GROUPS: KimariteGroup[] = ['kihon', 'nage', 'kake', 'sori', 'hineri', 'tokushu', 'hiwaza'];

/** 決まり手帳（一門タブ）: 部屋の力士が決めた決まり手。まだのものは「？？？」 */
export function KimaritePanel({ game }: { game: GameState }) {
  const { t } = useI18n();
  const book = kimariteBook(game);
  const { got, total } = kimariteCollected(game);
  return (
    <section className="panel" aria-labelledby="kimarite-book-title">
      <h2 id="kimarite-book-title">
        {t('kimariteBook.title')}{' '}
        <span className="muted">{t('achv.count', { done: got, total })}</span>
      </h2>
      {GROUPS.map((g) => {
        const rows = book.filter((e) => e.group === g);
        const n = rows.filter((e) => e.count > 0).length;
        return (
          <details key={g} className="kbook__group">
            <summary>
              {t(`kimarite.group.${g}` as MessageKey)}{' '}
              <span className="muted">{t('achv.count', { done: n, total: rows.length })}</span>
            </summary>
            <ul className="achv__list">
              {rows.map((e) => (
                <li key={e.id} className={`achv__item ${e.count > 0 ? 'is-done' : ''}`}>
                  <span>
                    {e.count > 0 ? t(`kimarite.${e.id}` as MessageKey) : t('kimariteBook.unknown')}
                    {e.count > 0 && KIMARITE_DESC.has(e.id) && (
                      <small className="achv__hint">
                        {t(`kimarite.desc.${e.id}` as MessageKey)}
                      </small>
                    )}
                    {e.best && (
                      <small className="achv__hint">
                        {t('kimariteBook.best', { name: e.best.name, n: e.count })}
                      </small>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </details>
        );
      })}
    </section>
  );
}
