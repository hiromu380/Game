/**
 * デバッグ表示（開発・調整用）
 * - ランのシード・試運転回数などの内部状態
 * - 直近の再生結果: tick ごとのイベント一覧、パーツ別の発動回数と上限
 */
import {
  computeActivationLimits,
  getCurrentRules,
  type RunState,
  type SimResult,
} from '@chain-factory/sim';
import { useI18n } from '../i18n';
import { countActivations } from '../playback/breaks';
import { eventToText } from '../playback/eventText';
import { groupEventsByTick } from '../playback/timeline';

interface Props {
  run: RunState;
  /** 直近に再生した結果（なければ null） */
  result: SimResult | null;
}

export function DebugPanel({ run, result }: Props) {
  const { t } = useI18n();
  const limits = computeActivationLimits(run.board, getCurrentRules(run));
  const activations = result ? countActivations(result.events) : new Map();

  return (
    <section className="panel debug">
      <h2 className="panel__title">{t('debug.title')}</h2>
      <p className="debug__meta">
        seed={run.seed} shift={run.shiftIndex} trial={run.trialCount} reroll={run.rerollCount}
      </p>

      <h3>{t('debug.activations')}</h3>
      <table className="debug__table">
        <tbody>
          {run.board.cells.map((part, index) => {
            if (!part) return null;
            const x = index % run.board.width;
            const y = Math.floor(index / run.board.width);
            const used = activations.get(`${x},${y}`)?.count ?? 0;
            const limit = limits[index];
            return (
              <tr key={index}>
                <td>
                  ({x},{y})
                </td>
                <td>{t(`part.${part.id}.name`)}</td>
                <td>
                  {used} / {limit === null ? '∞' : limit}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <h3>{t('debug.ticks')}</h3>
      {result ? (
        <ol className="debug__ticks" start={0}>
          {groupEventsByTick(result.events).map((events, tick) => (
            <li key={tick}>{events.map(eventToText).join('  ')}</li>
          ))}
        </ol>
      ) : (
        <p className="panel__hint">{t('debug.noResult')}</p>
      )}
    </section>
  );
}
