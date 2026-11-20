/**
 * メタ進行の表示: 今回新しく解放されたもの ＋ 解放の目標と達成度
 *
 * 解放条件は balance/ の meta を読み、達成度は sim の conditionProgress で計算する。
 */
import {
  BALANCE,
  conditionProgress,
  isConditionMet,
  type MetaCondition,
  type MetaProgress,
  type Unlock,
} from '@chain-factory/sim';
import { useI18n, type ScoreFormatter, type TranslateFn } from '../i18n';
import { PartIcon } from './PartIcon';
import { UiIcon } from './UiIcon';

interface Props {
  meta: MetaProgress;
  /** 直前のランで新しく解放されたもの */
  unlocks: Unlock[];
  /** 目標を、届きそうなものからこの数だけ出し、残りは畳む（省略時はすべて並べる） */
  limit?: number;
}

interface Goal {
  key: string;
  icon: React.ReactNode;
  label: string;
  condition: string;
  progress: number;
  done: boolean;
}

/** 解放条件の文言（パーツ一覧でも使う） */
export function describeCondition(
  t: TranslateFn,
  formatScore: ScoreFormatter,
  condition: MetaCondition,
): string {
  const value =
    condition.kind === 'totalShipped' || condition.kind === 'bestShiftScore'
      ? formatScore(String(condition.value))
      : condition.value;
  return t(`meta.condition.${condition.kind}`, { value });
}

/** 盤面の一辺の長さ（工場拡張の段階から） */
const boardSizeAt = (level: number) => BALANCE.board.width + level;

export function MetaPanel({ meta, unlocks, limit }: Props) {
  const { t, formatScore } = useI18n();
  const goals: Goal[] = [
    ...BALANCE.meta.partUnlocks.map(({ partId, condition }) => {
      const done = meta.unlockedParts.includes(partId);
      return {
        key: partId,
        icon: <PartIcon partId={partId} size={28} />,
        label: t(`part.${partId}.name`),
        condition: describeCondition(t, formatScore, condition),
        progress: done ? 1 : conditionProgress(meta.records, condition),
        done,
      };
    }),
    ...BALANCE.meta.boardExpansions.map((condition, i) => {
      const done = meta.boardLevel > i || isConditionMet(meta.records, condition);
      return {
        key: `board-${i}`,
        icon: <UiIcon name="expand" size={28} />,
        label: t('meta.boardGoal', { size: boardSizeAt(i + 1) }),
        condition: describeCondition(t, formatScore, condition),
        progress: done ? 1 : conditionProgress(meta.records, condition),
        done,
      };
    }),
  ];
  // まだの目標を、届きそうな順に（達成度の高い順）
  const open = goals.filter((g) => !g.done).sort((a, b) => b.progress - a.progress);
  const nearest = open.slice(0, limit ?? open.length);
  const shown = new Set(nearest.map((g) => g.key));
  const rest = goals.filter((g) => !shown.has(g.key));
  const renderGoal = ({ key, ...g }: Goal) => <GoalRow key={key} {...g} />;

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
              ) : u.kind === 'ascension' ? (
                <li key={`ascension-${u.level}`}>
                  <UiIcon name="expand" size={32} />
                  {t('meta.newAscension', { level: u.level })}
                </li>
              ) : (
                <li key={`board-${u.level}`}>
                  <UiIcon name="expand" size={32} />
                  {t('meta.newBoard', { size: boardSizeAt(u.level) })}
                </li>
              ),
            )}
          </ul>
        </div>
      )}

      <h2 className="meta__title">{t('meta.goalsTitle')}</h2>
      {limit === undefined ? (
        <ul className="meta__goals">{goals.map(renderGoal)}</ul>
      ) : (
        <>
          {/* もうすぐ届く目標だけを先に出し、残りは畳む（ラン終了画面で圧迫しないように） */}
          <ul className="meta__goals">{nearest.map(renderGoal)}</ul>
          {rest.length > 0 && (
            <details className="meta__more">
              <summary>{t('meta.allGoals', { count: goals.length })}</summary>
              <ul className="meta__goals">{rest.map(renderGoal)}</ul>
            </details>
          )}
        </>
      )}
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
