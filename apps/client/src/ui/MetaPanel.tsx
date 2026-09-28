/**
 * メタ進行の表示: 今回新しく解放されたもの ＋ 解放の目標と達成度
 *
 * 解放条件は balance.ts の meta を読み、達成度は sim の conditionProgress で計算する。
 */
import {
  BALANCE,
  conditionProgress,
  isConditionMet,
  type MetaCondition,
  type MetaProgress,
  type Unlock,
} from '@chain-factory/sim';
import { useI18n, type TranslateFn } from '../i18n';
import { formatScore } from './format';
import { PartIcon } from './PartIcon';

interface Props {
  meta: MetaProgress;
  /** 直前のランで新しく解放されたもの */
  unlocks: Unlock[];
}

/** 解放条件の文言 */
function describeCondition(t: TranslateFn, condition: MetaCondition): string {
  const value =
    condition.kind === 'totalShipped' || condition.kind === 'bestShiftScore'
      ? formatScore(String(condition.value))
      : condition.value;
  return t(`meta.condition.${condition.kind}`, { value });
}

/** 盤面の一辺の長さ（工場拡張の段階から） */
const boardSizeAt = (level: number) => BALANCE.board.width + level;

export function MetaPanel({ meta, unlocks }: Props) {
  const { t } = useI18n();

  return (
    <section className="meta">
      {unlocks.length > 0 && (
        <div className="meta__new">
          <h2>{t('meta.newTitle')}</h2>
          <ul>
            {unlocks.map((u) =>
              u.kind === 'part' ? (
                <li key={u.partId}>
                  <PartIcon partId={u.partId} size={32} />
                  {t('meta.newPart', { name: t(`part.${u.partId}.name`) })}
                </li>
              ) : (
                <li key={`board-${u.level}`}>
                  <img src="./icon.svg" width={32} height={32} alt="" />
                  {t('meta.newBoard', { size: boardSizeAt(u.level) })}
                </li>
              ),
            )}
          </ul>
        </div>
      )}

      <h2 className="meta__title">{t('meta.goalsTitle')}</h2>
      <ul className="meta__goals">
        {BALANCE.meta.partUnlocks.map(({ partId, condition }) => {
          const done = meta.unlockedParts.includes(partId);
          return (
            <GoalRow
              key={partId}
              icon={<PartIcon partId={partId} size={28} />}
              label={t(`part.${partId}.name`)}
              condition={describeCondition(t, condition)}
              progress={done ? 1 : conditionProgress(meta.records, condition)}
              done={done}
            />
          );
        })}
        {BALANCE.meta.boardExpansions.map((condition, i) => {
          const done = meta.boardLevel > i || isConditionMet(meta.records, condition);
          return (
            <GoalRow
              key={`board-${i}`}
              icon={<img src="./icon.svg" width={28} height={28} alt="" />}
              label={t('meta.boardGoal', { size: boardSizeAt(i + 1) })}
              condition={describeCondition(t, condition)}
              progress={done ? 1 : conditionProgress(meta.records, condition)}
              done={done}
            />
          );
        })}
      </ul>
    </section>
  );
}

function GoalRow(props: {
  icon: React.ReactNode;
  label: string;
  condition: string;
  progress: number;
  done: boolean;
}) {
  return (
    <li className={`meta__goal ${props.done ? 'is-done' : ''}`}>
      {props.icon}
      <div className="meta__goal-text">
        <div>
          <strong>{props.label}</strong> <span className="meta__condition">{props.condition}</span>
        </div>
        <div className="meta__bar">
          <div
            className="meta__bar-fill"
            style={{ width: `${Math.round(props.progress * 100)}%` }}
          />
        </div>
      </div>
      <span className="meta__check">{props.done ? '✓' : ''}</span>
    </li>
  );
}
