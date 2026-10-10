/**
 * 週替わりのランキング表示
 *
 * - ProvisionalRanking: 当週の暫定ランキング（並びは少し古いことがある。「暫定」を常に明示する）
 * - RankingList: 上位・自分の周辺の一覧（結果発表と共用）
 */
import type { ProvisionalRankingResponse, RankingEntry } from '@chain-factory/shared';
import { useEffect, useState } from 'react';
import { useI18n } from '../../i18n';
import { api, OnlineError } from '../../online/api';

interface Props {
  weekId: string;
  number: number;
  onBack: () => void;
}

export function ProvisionalRanking({ weekId, number, onBack }: Props) {
  const { t } = useI18n();
  const [ranking, setRanking] = useState<ProvisionalRankingResponse | null>(null);
  const [error, setError] = useState<OnlineError['code'] | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .getProvisional(weekId)
      .then((r) => !cancelled && setRanking(r))
      .catch((e: unknown) => !cancelled && setError(e instanceof OnlineError ? e.code : 'network'));
    return () => {
      cancelled = true;
    };
  }, [weekId]);

  return (
    <div className="ranking">
      <h2 className="panel__title">
        {t('ranking.provisionalTitle', { number })}
        <span className="ranking__badge">{t('ranking.provisional')}</span>
      </h2>
      <p className="panel__hint">{t('ranking.provisionalHint')}</p>
      {error && <p className="panel__hint">{t(`error.online.${error}`)}</p>}
      {!ranking && !error && <p className="panel__hint">{t('weekly.loading')}</p>}
      {ranking && (
        <>
          <p className="ranking__me">
            {ranking.me
              ? t('ranking.meProvisional', {
                  rank: ranking.me.rank,
                  total: ranking.total,
                  percent: ranking.me.topPercent,
                })
              : t('ranking.notJoined')}
          </p>
          <p className="panel__hint">{t('ranking.participants', { count: ranking.total })}</p>
          {ranking.total === 0 ? (
            <p className="panel__hint">{t('ranking.empty')}</p>
          ) : ranking.topMode === 'hidden' ? (
            <p className="panel__hint">{t('ranking.topHidden')}</p>
          ) : (
            <>
              <h3 className="ranking__heading">{t('ranking.top')}</h3>
              <RankingList entries={ranking.top} />
              {ranking.topMode === 'rounded' && (
                <p className="panel__hint">{t('ranking.roundedHint')}</p>
              )}
              {ranking.me && ranking.me.rank > ranking.top.length && ranking.around.length > 0 && (
                <>
                  <h3 className="ranking__heading">{t('ranking.around')}</h3>
                  <RankingList entries={ranking.around} />
                </>
              )}
            </>
          )}
        </>
      )}
      <div className="button-row">
        <button onClick={onBack} data-close>
          {t('ranking.back')}
        </button>
      </div>
    </div>
  );
}

export function RankingList({
  entries,
  showDays = false,
}: {
  entries: RankingEntry[];
  /** 参加日数を出す（確定した結果発表だけ） */
  showDays?: boolean;
}) {
  const { t, formatScore } = useI18n();
  return (
    <ol className="ranking__list">
      {entries.map((e) => (
        <li key={e.rank} className={`ranking__row ${e.isMe ? 'is-me' : ''}`}>
          <span className="ranking__rank">{e.rank}</span>
          <span className="ranking__name">
            {e.displayName || t('online.defaultName')}
            {e.isMe && <span className="ranking__you">{t('ranking.you')}</span>}
          </span>
          <span className="ranking__detail">
            {t('ranking.shifts', { count: e.shiftsCleared })}
            {showDays && <> · {t('ranking.days', { count: e.daysPlayed })}</>}
          </span>
          <span className="ranking__score">{formatScore(e.score)}</span>
        </li>
      ))}
    </ol>
  );
}
