/**
 * 残業レベルの選択（ラン終了画面）: 次のランのレベルを選ぶ。選んだレベルまでの条件をまとめて見せる
 */
import { ascensionEffects, BALANCE, type AscensionEffect } from '@chain-factory/sim';
import { useI18n, type TranslateFn } from '../i18n';

/** Lv level までの条件を「ノルマ ×2.34 ／ 予算 −2」のように1行ずつ */
export function describeAscension(t: TranslateFn, level: number): string[] {
  const effects = ascensionEffects(level, BALANCE);
  const sum = (key: keyof AscensionEffect) => effects.reduce((n, e) => n + (e[key] ?? 0), 0);
  const quota = effects.reduce((n, e) => n * ((e.quotaPercent ?? 100) / 100), 1);
  const lines: string[] = [];
  if (quota !== 1) lines.push(t('ascension.effect.quota', { value: quota.toFixed(2) }));
  const budget = sum('budgetDelta');
  if (budget) lines.push(t('ascension.effect.budget', { value: budget }));
  const price = sum('priceDelta');
  if (price) lines.push(t('ascension.effect.price', { value: price }));
  const reroll = sum('rerollStepDelta');
  if (reroll) lines.push(t('ascension.effect.reroll', { value: reroll }));
  const floor = sum('bonusFloorDelta');
  if (floor) lines.push(t('ascension.effect.bonusFloor', { value: floor }));
  const relic = sum('relicChoicesDelta');
  if (relic) lines.push(t('ascension.effect.relicChoices', { value: relic }));
  const event = sum('eventChoicesDelta');
  if (event) lines.push(t('ascension.effect.eventChoices', { value: event }));
  return lines;
}

interface Props {
  unlocked: number;
  selected: number;
  onSelect: (level: number) => void;
}

export function AscensionPicker({ unlocked, selected, onSelect }: Props) {
  const { t } = useI18n();
  if (unlocked <= 0) return null;
  const effects = describeAscension(t, selected);
  return (
    <section className="ascension" aria-label={t('ascension.title')}>
      <h2>{t('ascension.title')}</h2>
      <div className="ascension__picker">
        <button
          className="button--small"
          disabled={selected <= 0}
          onClick={() => onSelect(selected - 1)}
          aria-label={t('ascension.lower')}
        >
          ◀
        </button>
        <strong className="ascension__level">
          {selected === 0 ? t('ascension.none') : t('ascension.label', { level: selected })}
        </strong>
        <button
          className="button--small"
          disabled={selected >= unlocked}
          onClick={() => onSelect(selected + 1)}
          aria-label={t('ascension.higher')}
        >
          ▶
        </button>
      </div>
      {selected > 0 && (
        <>
          <p className="ascension__name">{t(`ascension.name.${selected}` as `ascension.name.1`)}</p>
          <ul className="ascension__effects">
            {effects.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
