/**
 * 再生後の結果表示（試運転 / 本番）
 */
import {
  BALANCE,
  getCurrentShift,
  isUnmeasurable,
  overshootBonus,
  scoreCompare,
  scoreOf,
  scoreToString,
  type RunState,
  type SimResult,
  type VanishReason,
} from '@chain-factory/sim';
import { BOLT_BODY_ASSETS } from '../assets/manifest';
import { useI18n } from '../i18n';
import type { Playback } from '../state/gameReducer';
import { summarizeBreaks } from '../playback/breaks';
import { biggestShipBreakdown, describeChange } from '../playback/breakdown';
import { getRocketProgress, ROCKET_PARTS } from '../state/rocket';
import { destinationName } from './RocketProgress';

interface Props {
  playback: Playback;
  run: RunState;
  onClose: () => void;
}

export function PlaybackPanel({ playback, run, onClose }: Props) {
  const { t, formatScore, formatCompact, formatMeasured } = useI18n();
  if (!playback.finished) {
    return <div className="playback-banner">{t('playback.playing')}</div>;
  }

  const { score, stats } = playback.result;
  const quota = getCurrentShift(run).quota;
  const met = scoreCompare(score, scoreOf(quota)) >= 0;
  // 超過手当（ノルマを桁で超えた分、次のシフトの予算に足す）。試運転では「本番ならこれだけ」の目安
  const bonus = met ? overshootBonus(score, quota, run.config.economy.overshoot) : 0;
  const perDigit = run.config.economy.overshoot?.perDigit ?? 1;

  // 本番で次に進むときのボタン文言
  const closeLabel =
    playback.mode === 'trial'
      ? t('playback.close')
      : playback.nextRun.phase === 'building'
        ? t('playback.nextShift')
        : t('playback.toResult');

  return (
    <div className="playback-panel">
      {/* ボルトの反応（全身）: 達成でガッツポーズ、未達でしょんぼり */}
      <img
        className="playback-panel__bolt"
        src={met ? BOLT_BODY_ASSETS.guts : BOLT_BODY_ASSETS.sad}
        alt=""
      />
      <h2>{playback.mode === 'trial' ? t('playback.trialTitle') : t('playback.commitTitle')}</h2>
      <div className={`playback-panel__verdict ${met ? 'is-met' : 'is-missed'}`}>
        {met ? t('playback.quotaMet') : t('playback.quotaMissed')}
      </div>
      {!met && (
        <p className="playback-panel__short">
          {t('playback.shortBy', {
            amount: formatCompact((BigInt(quota) - BigInt(scoreToString(score))).toString()),
          })}
        </p>
      )}
      <RocketLine playback={playback} run={run} />
      <dl className="stats">
        <dt>{t('playback.score')}</dt>
        <dd className="stats__score">
          {formatMeasured(score)}
          {isUnmeasurable(score) && (
            <span className="stats__note">
              {t('unmeasurable.note', {
                limit: formatScore(`1${'0'.repeat(BALANCE.unmeasurable.digits - 1)}`),
              })}
            </span>
          )}
        </dd>
        <dt>{t('playback.quota')}</dt>
        <dd>{formatScore(String(quota))}</dd>
        <dt>{t('playback.chain')}</dt>
        <dd>{stats.chainCount}</dd>
        <dt>{t('playback.maxValue')}</dt>
        <dd>{formatMeasured(scoreToString(stats.maxValue))}</dd>
        {playback.result.income > 0 && (
          <>
            <dt>{t('playback.income')}</dt>
            <dd>{t('playback.incomePop', { amount: playback.result.income })}</dd>
          </>
        )}
        {bonus > 0 && (
          <>
            <dt>{t('playback.overshoot')}</dt>
            <dd>
              {t('playback.overshootValue', {
                amount: bonus,
                times: formatScore(`1${'0'.repeat(bonus / perDigit)}`),
              })}
            </dd>
          </>
        )}
      </dl>
      <ShipBreakdownLine result={playback.result} />
      <BreakList result={playback.result} run={run} />
      <button className="button--primary" onClick={onClose}>
        {closeLabel}
      </button>
    </div>
  );
}

/** 本番でノルマを達成したとき: ロケットの部品が増えた・発射できる・行き先に届いたことを知らせる */
function RocketLine({ playback, run }: { playback: Playback; run: RunState }) {
  const { t } = useI18n();
  if (playback.mode !== 'commit') return null;
  const before = getRocketProgress(run);
  const after = getRocketProgress(playback.nextRun);
  if (after.destinations > before.destinations) {
    return (
      <div className="playback-panel__rocket">
        {t('rocket.arrived', { name: destinationName(t, after.destinations) ?? '' })}
      </div>
    );
  }
  if (after.launched && !before.launched) {
    return <div className="playback-panel__rocket">{t('rocket.readyToLaunch')}</div>;
  }
  if (after.parts <= before.parts) return null;
  return (
    <div className="playback-panel__rocket">
      {t('rocket.partBuilt', { parts: after.parts, total: ROCKET_PARTS })}
    </div>
  );
}

/** 計算の内訳に並べる段の数の上限（多いときは真ん中を「…」でまとめる） */
const BREAKDOWN_MAX_CHIPS = 7;

/** いちばん大きい出荷の計算の内訳: 1 → ギア ×2 → ×2床 → … = 出荷量 */
function ShipBreakdownLine({ result }: { result: SimResult }) {
  const { t, formatCompact } = useI18n();
  const breakdown = biggestShipBreakdown(result.events);
  if (!breakdown || (breakdown.steps.length === 0 && breakdown.sync === 1)) return null;
  const chips: { key: string; label: string; kind: 'part' | 'floor' }[] = [];
  breakdown.steps.forEach((step, i) => {
    if (step.floor) {
      const change = describeChange(step.before, step.afterFloor);
      if (change)
        chips.push({ key: `f${i}`, label: `${t('breakdown.floor')} ${change}`, kind: 'floor' });
    }
    const change = describeChange(step.afterFloor, step.after);
    if (change)
      chips.push({
        key: `p${i}`,
        label: `${t(`part.${step.partId}.name`)} ${change}`,
        kind: 'part',
      });
  });
  if (breakdown.sync > 1)
    chips.push({
      key: 'sync',
      label: t('breakdown.sync', { count: breakdown.sync }),
      kind: 'floor',
    });
  const shown =
    chips.length > BREAKDOWN_MAX_CHIPS
      ? [
          ...chips.slice(0, 2),
          {
            key: 'more',
            label: t('breakdown.more', { count: chips.length - 5 }),
            kind: 'part' as const,
          },
          ...chips.slice(-3),
        ]
      : chips;
  return (
    <div className="breakdown">
      <div className="breakdown__title">{t('breakdown.title')}</div>
      <ol className="breakdown__chain">
        <li className="breakdown__start">{formatCompact(breakdown.start)}</li>
        {shown.map((chip) => (
          <li key={chip.key} className={`breakdown__chip breakdown__chip--${chip.kind}`}>
            <span className="breakdown__arrow" aria-hidden>
              →
            </span>
            <span className="breakdown__label">{chip.label}</span>
          </li>
        ))}
        <li className="breakdown__total">= {formatCompact(breakdown.shipped)}</li>
      </ol>
    </div>
  );
}

/** 連鎖が途切れた理由の内訳（盤面にはマーカーで場所を表示している） */
function BreakList({ result, run }: { result: SimResult; run: RunState }) {
  const { t } = useI18n();
  const summary = summarizeBreaks(result.events, run.board);
  const reasons = Object.keys(summary.counts) as VanishReason[];
  if (reasons.length === 0 && !summary.haltReason) return null;
  return (
    <div className="break-list">
      <div className="break-list__title">{t('break.title')}</div>
      <ul>
        {reasons.map((reason) => (
          <li key={reason}>
            <span className={`break-chip break-chip--${reason}`}>{t(`break.short.${reason}`)}</span>
            {t(`break.long.${reason}`)} ×{summary.counts[reason]}
          </li>
        ))}
        {summary.haltReason && (
          <li>{t(`break.halted.${summary.haltReason}`, { count: summary.haltedSignals })}</li>
        )}
      </ul>
    </div>
  );
}
