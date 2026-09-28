/**
 * デイリーのランキング表示（上位・自分の周辺・上位○%）
 */
import type { RankingEntry, RankingResponse } from '@chain-factory/shared';
import { useEffect, useState } from 'react';
import { useI18n } from '../../i18n';
import { api, OnlineError } from '../../online/api';

interface Props {
  dailyId: string;
  number: number;
  onBack: () => void;
  /** 自分の結果があれば、その上位○% を知らせる */
  onRanked?: (topPercent: number) => void;
}

export function RankingView({ dailyId, number, onBack, onRanked }: Props) {
  const { t } = useI18n();
  const [ranking, setRanking] = useState<RankingResponse | null>(null);
  const [error, setError] = useState<OnlineError['code'] | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .getRanking(dailyId)
      .then((r) => !cancelled && setRanking(r))
      .catch((e: unknown) => !cancelled && setError(e instanceof OnlineError ? e.code : 'network'));
    return () => {
      cancelled = true;
    };
  }, [dailyId]);

  useEffect(() => {
    if (ranking?.me) onRanked?.(ranking.me.topPercent);
  }, [ranking, onRanked]);

  return (
    <div className="ranking">
      <h2 className="panel__title">{t('ranking.title', { number })}</h2>
      {error && <p className="panel__hint">{t(`error.online.${error}`)}</p>}
      {!ranking && !error && <p className="panel__hint">{t('daily.loading')}</p>}
      {ranking && (
        <>
          <p className="ranking__me">
            {ranking.me
              ? t('ranking.me', {
                  rank: ranking.me.rank,
                  total: ranking.total,
                  percent: ranking.me.topPercent,
                })
              : t('ranking.notJoined')}
          </p>
          {ranking.total === 0 ? (
            <p className="panel__hint">{t('ranking.empty')}</p>
          ) : (
            <>
              <h3 className="ranking__heading">{t('ranking.top')}</h3>
              <RankingList entries={ranking.top} />
              {ranking.me && ranking.me.rank > ranking.top.length && (
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

function RankingList({ entries }: { entries: RankingEntry[] }) {
  const { t, formatScore } = useI18n();
  return (
    <ol className="ranking__list">
      {entries.map((e) => (
        <li key={e.rank} className={`ranking__row ${e.isMe ? 'is-me' : ''}`}>
          <span className="ranking__rank">{e.rank}</span>
          <span className="ranking__name">{e.displayName || t('online.defaultName')}</span>
          <span className="ranking__detail">
            {t('ranking.shifts', { count: e.shiftsCleared })} ·{' '}
            {t('ranking.chain', { count: e.maxChain })}
          </span>
          <span className="ranking__score">{formatScore(e.score)}</span>
        </li>
      ))}
    </ol>
  );
}
