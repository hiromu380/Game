/**
 * 今日の出来事（日ごとのイベント）: 2日目以降の朝に、候補から1つ選ぶダイアログと、選んだ後の表示
 * 効果量は RunConfig の dayEvents から埋め込む（balance/events.ts を変えれば文言も追従する）
 */
import { activeEvent, type DayEventId, type RunState } from '@chain-factory/sim';
import { useI18n, type TranslateFn } from '../i18n';

/** イベントの説明文 */
export function describeEvent(t: TranslateFn, run: RunState, id: DayEventId): string {
  const e = run.config.dayEvents;
  if (!e) return '';
  return t(`event.${id}.desc`, {
    budget: e.suppliesBudget,
    discount: e.saleDiscount,
    percent: id === 'clearance' ? e.clearanceRefundPercent : e.rollUpSleevesQuotaPercent,
    multiplier: e.overtimePayPercent / 100,
    count: e.floorAddsCount,
    add: run.config.rules.floorParams?.addAmount,
  });
}

interface Props {
  run: RunState;
  onChoose: (index: number) => void;
}

export function DayEventDialog({ run, onChoose }: Props) {
  const { t } = useI18n();
  const event = run.dayEvent;
  if (!event) return null;
  return (
    <div className="modal" role="dialog" aria-modal="true">
      <div className="modal__body panel day-event">
        <h2 className="panel__title">{t('event.chooseTitle', { day: event.day + 1 })}</h2>
        <p className="panel__hint">{t('event.chooseHint')}</p>
        <div className="day-event__choices">
          {event.choices.map((id, index) => (
            <button
              key={id}
              className="day-event__choice"
              onClick={() => onChoose(index)}
              autoFocus={index === 0}
            >
              <span className="day-event__sender">{t(`event.${id}.sender`)}</span>
              <strong>{t(`event.${id}.name`)}</strong>
              <span className="day-event__story">{t(`event.${id}.story`)}</span>
              <span>{describeEvent(t, run, id)}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/** 選んだイベントの表示（その日のあいだ、盤面の上・右の列の先頭に出す） */
export function DayEventNotice({ run }: { run: RunState }) {
  const { t } = useI18n();
  const id = activeEvent(run);
  if (!id) return null;
  const sample = run.dayEvent?.samplePart;
  return (
    <div className="boss-notice day-event-notice">
      <span className="boss-notice__label">{t('event.today')}</span>
      <strong>
        {t(`event.${id}.sender`)} / {t(`event.${id}.name`)}
      </strong>
      <span className="boss-notice__story">{t(`event.${id}.story`)}</span>
      <span className="boss-notice__desc">
        {id === 'sample' && sample
          ? t('event.sampleGot', { part: t(`part.${sample}.name`) })
          : describeEvent(t, run, id)}
      </span>
    </div>
  );
}
