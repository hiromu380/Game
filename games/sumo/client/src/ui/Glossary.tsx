import { useMemo } from 'react';
import type { GameState } from '@ichimon/sim';
import { useI18n, type MessageKey } from '../i18n';
import { GLOSSARY_GROUPS, seenTerms, TERMS } from '../glossary';

/** 相撲の手帖: 出会った言葉と、その説明（まだのものは「？？？」） */
export function GlossaryPanel({ game }: { game: GameState }) {
  const { t } = useI18n();
  const seen = useMemo(() => seenTerms(game), [game]);
  return (
    <section className="panel glossary" aria-labelledby="glossary-title">
      <h2 id="glossary-title">
        {t('glossary.title')}
        <span className="glossary__count">
          {t('glossary.count', { seen: seen.size, total: TERMS.length })}
        </span>
      </h2>
      <p className="note">{t('glossary.note')}</p>
      {GLOSSARY_GROUPS.map((g) => (
        <details key={g} className="glossary__group">
          <summary>
            {t(`glossary.group.${g}` as MessageKey)}（
            {TERMS.filter((x) => x.group === g && seen.has(x.id)).length}/
            {TERMS.filter((x) => x.group === g).length}）
          </summary>
          <dl className="glossary__list">
            {TERMS.filter((x) => x.group === g).map((x) =>
              seen.has(x.id) ? (
                <div key={x.id} className="glossary__item">
                  <dt>{t(`glossary.term.${x.id}.name` as MessageKey)}</dt>
                  <dd>{t(`glossary.term.${x.id}.desc` as MessageKey)}</dd>
                </div>
              ) : (
                <div key={x.id} className="glossary__item is-locked">
                  <dt>{t('glossary.locked')}</dt>
                  <dd>{t('glossary.lockedDesc')}</dd>
                </div>
              ),
            )}
          </dl>
        </details>
      ))}
    </section>
  );
}

/** 窓や見せ場に添える、しきたりの1行（手帖の言葉の説明） */
export function Lore({ id }: { id: string }) {
  const { t } = useI18n();
  return (
    <p className="lore">
      <span className="tag lore__tag">{t('glossary.lore')}</span>
      <strong>{t(`glossary.term.${id}.name` as MessageKey)}</strong>{' '}
      {t(`glossary.term.${id}.desc` as MessageKey)}
    </p>
  );
}
