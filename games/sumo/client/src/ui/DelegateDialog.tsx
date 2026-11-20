import type { GameState } from '@ichimon/sim';
import { useI18n, type MessageKey } from '../i18n';
import { bashoName, money } from '../format';
import type { DelegateResult } from '../delegate';

/** 任せた間の出来事: 場所ごとの勝ち越し・番付・お金・昇進・けがと、止まったわけ */
export function DelegateDialog({
  game,
  result,
  onClose,
}: {
  game: GameState;
  result: DelegateResult;
  onClose: () => void;
}) {
  const { t, lang } = useI18n();
  const name = (id: number) => game.rikishi.find((r) => r.id === id)?.name ?? '?';
  return (
    <div className="modal" role="dialog" aria-modal="true" aria-labelledby="delegate-title">
      <div className="modal__box modal__box--wide">
        <h2 id="delegate-title">{t('delegate.title', { n: result.steps.length })}</h2>
        <ol className="delegate__list">
          {result.steps.map((s) => (
            <li key={s.bashoIndex} className="delegate__row">
              <span className="delegate__basho">{bashoName(t, s.bashoIndex)}</span>
              <span>{t('delegate.kk', { n: s.kachikoshi, total: s.total })}</span>
              <span>{t('delegate.updown', { up: s.up, down: s.down })}</span>
              <span className={s.net < 0 ? 'down' : 'up'}>
                {(s.net >= 0 ? '+' : '') + money(t, s.net, lang)}
              </span>
              {s.promotions.map((p) => (
                <span key={p.id} className="tag tag--gold">
                  {t(`delegate.promo.${p.to}` as MessageKey, { name: name(p.id) })}
                </span>
              ))}
              {s.injuries.map((id) => (
                <span key={id} className="tag tag--warn">
                  {t('delegate.injury', { name: name(id) })}
                </span>
              ))}
            </li>
          ))}
        </ol>
        <p className={`callout ${result.stop ? '' : 'delegate__done'}`}>
          {t(`delegate.stop.${result.stop ?? 'none'}` as MessageKey)}
        </p>
        <div className="modal__actions">
          <button className="button button--primary" data-dismiss onClick={onClose}>
            {t('common.close')}
          </button>
        </div>
      </div>
    </div>
  );
}
