/**
 * レリック: 夜のシフトをクリアした次のシフトに、3つの候補から1つ選ぶダイアログと、持っているレリックの列
 * 効果量は RunConfig の relics から埋め込む（balance/relics.ts を変えれば文言も追従する）
 */
import type { RelicId, RelicParams, RunState } from '@chain-factory/sim';
import { RELIC_ICONS } from '../assets/manifest';
import { useI18n, type TranslateFn } from '../i18n';
import { RarityTag, relicRarity } from './RarityTag';

/** レリックの説明文（ランが持つ効果量で） */
export function describeRelic(t: TranslateFn, run: RunState, id: RelicId): string {
  const p = run.config.relics?.params;
  return p ? describeRelicWith(t, p, id) : '';
}

/** レリックの説明文（効果量を指定。コレクションでは balance/ の基準値） */
export function describeRelicWith(t: TranslateFn, params: RelicParams, id: RelicId): string {
  return t(`relic.${id}.desc`, { ...params });
}

interface Props {
  run: RunState;
  onPick: (index: number) => void;
}

export function RelicDialog({ run, onPick }: Props) {
  const { t } = useI18n();
  const choice = run.relicChoice;
  if (!choice) return null;
  return (
    <div className="modal" role="dialog" aria-modal="true">
      <div className="modal__body panel day-event relic-dialog">
        <h2 className="panel__title">{t('relic.chooseTitle')}</h2>
        <p className="panel__hint">{t('relic.chooseHint')}</p>
        <div className="day-event__choices">
          {choice.choices.map((id, index) => (
            <button
              key={id}
              className={`day-event__choice relic-dialog__choice rarity-frame rarity-frame--${relicRarity(run, id)}`}
              onClick={() => onPick(index)}
              autoFocus={index === 0}
            >
              <img className="day-event__icon" src={RELIC_ICONS[id]} alt="" />
              <span className="day-event__text">
                <strong>
                  {t(`relic.${id}.name`)} <RarityTag rarity={relicRarity(run, id)} />
                </strong>
                <span>{describeRelic(t, run, id)}</span>
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/** 持っているレリック（アイコンの列。タップで開くと名前と効果） */
export function RelicStrip({ run }: { run: RunState }) {
  const { t } = useI18n();
  const relics = run.relics ?? [];
  if (relics.length === 0) return null;
  return (
    <details className="relic-strip">
      <summary className="relic-strip__summary">
        <span className="relic-strip__label">{t('relic.owned')}</span>
        {relics.map((id, index) => (
          <img
            key={id}
            src={RELIC_ICONS[id]}
            alt={t(`relic.${id}.name`)}
            // 手に入れたばかりのレリック（いちばん後ろ）は、ぽんと出てくる
            className={index === relics.length - 1 ? 'relic-strip__newest' : undefined}
          />
        ))}
      </summary>
      <ul className="relic-strip__list">
        {relics.map((id) => (
          <li key={id}>
            <strong>{t(`relic.${id}.name`)}</strong> {describeRelic(t, run, id)}
          </li>
        ))}
      </ul>
    </details>
  );
}
