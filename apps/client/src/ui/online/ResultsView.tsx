/**
 * 週替わりの結果発表（確定した前週以前のランキング）
 *
 * - 参加していれば 順位・上位○%・ベスト・クリアしたシフト数・参加日数 を演出つきで出し、共有できる。
 *   参加していなければ上位の一覧だけ
 * - 集計中（締め切りの直後）は待機表示にし、間隔を空けて自動で取り直す（上限あり）
 * - まだ結果のある週がなければ（初週）「結果発表は来週」
 * - 過去週（保存期間内で確定済みの週）に切り替えられる
 * 見た週は既読として端末に記録する（タイトルの未読バッジ）。
 */
import type { WeeklyResultsResponse } from '@chain-factory/shared';
import { useEffect, useState } from 'react';
import { WEEKLY_UI_CONFIG } from '../../config/weekly';
import { useI18n } from '../../i18n';
import { api, OnlineError, type OnlineErrorCode } from '../../online/api';
import { markResultsSeen } from '../../online/resultsSeen';
import { ResultsShare } from '../share/WeeklyShare';
import { RankingList } from './RankingView';

interface Props {
  /** 最初に開く週（ふつうは先週） */
  weekId: string;
  /** 結果発表として開いた（演出をつける） */
  announce?: boolean;
  onBack: () => void;
  /** 確定した自分の上位○%（上位の実績の判定に使う） */
  onRanked: (topPercent: number) => void;
}

type Status =
  | { kind: 'loading' }
  | { kind: 'tallying'; retries: number }
  | { kind: 'none' }
  | { kind: 'error'; code: OnlineErrorCode }
  | { kind: 'loaded'; results: WeeklyResultsResponse };

export function ResultsView({ weekId: initialWeek, announce = false, onBack, onRanked }: Props) {
  const { t } = useI18n();
  const [weekId, setWeekId] = useState(initialWeek);
  const [status, setStatus] = useState<Status>({ kind: 'loading' });
  const [weeks, setWeeks] = useState<string[]>([]);

  // 過去週の一覧（確定済みの週）
  useEffect(() => {
    let cancelled = false;
    api
      .getLatest()
      .then((r) => !cancelled && setWeeks(r.finished.slice(0, WEEKLY_UI_CONFIG.pastWeeks)))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  // 結果を取る（集計中なら間隔を空けて取り直す）
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const load = (retries: number) => {
      api
        .getResults(weekId)
        .then((results) => {
          if (cancelled) return;
          setStatus({ kind: 'loaded', results });
          markResultsSeen(weekId);
          if (results.me) onRanked(results.me.topPercent);
        })
        .catch((e: unknown) => {
          if (cancelled) return;
          const code = e instanceof OnlineError ? e.code : 'network';
          if (code === 'tallying') {
            setStatus({ kind: 'tallying', retries });
            if (retries < WEEKLY_UI_CONFIG.tallyingRetries) {
              timer = setTimeout(() => load(retries + 1), WEEKLY_UI_CONFIG.tallyingRetryMs);
            }
          } else if (code === 'notFound' || code === 'notPublished') {
            setStatus({ kind: 'none' });
          } else {
            setStatus({ kind: 'error', code });
          }
        });
    };
    load(0);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [weekId, onRanked]);

  const choices = weeks.includes(weekId) ? weeks : [weekId, ...weeks];

  return (
    <div className="ranking results">
      <h2 className="panel__title">
        {status.kind === 'loaded'
          ? t('results.title', { number: status.results.number })
          : t('results.titlePlain')}
        {status.kind === 'loaded' && (
          <span className="ranking__badge ranking__badge--final">{t('results.final')}</span>
        )}
      </h2>
      {choices.length > 1 && (
        <div className="settings__row results__weeks">
          <label htmlFor="results-week">{t('results.week')}</label>
          <select
            id="results-week"
            value={weekId}
            onChange={(e) => {
              setStatus({ kind: 'loading' });
              setWeekId(e.target.value);
            }}
          >
            {choices.map((id) => (
              <option key={id} value={id}>
                {t('results.weekOption', { week: id })}
              </option>
            ))}
          </select>
        </div>
      )}

      {status.kind === 'loading' && <p className="panel__hint">{t('weekly.loading')}</p>}
      {status.kind === 'tallying' && (
        <p className="panel__hint results__tallying" role="status">
          {status.retries < WEEKLY_UI_CONFIG.tallyingRetries
            ? t('results.tallying')
            : t('results.tallyingLater')}
        </p>
      )}
      {status.kind === 'none' && <p className="panel__hint">{t('results.none')}</p>}
      {status.kind === 'error' && <p className="panel__hint">{t(`error.online.${status.code}`)}</p>}
      {status.kind === 'loaded' && <Results results={status.results} announce={announce} />}

      <div className="button-row">
        <button onClick={onBack} data-close>
          {t('ranking.back')}
        </button>
      </div>
    </div>
  );
}

function Results({ results, announce }: { results: WeeklyResultsResponse; announce: boolean }) {
  const { t, formatScore } = useI18n();
  const { me } = results;
  return (
    <>
      {me ? (
        <div className={`results__me ${announce ? 'results__me--reveal' : ''}`}>
          <p className="results__rank">
            {t('results.rank', { rank: me.rank, total: results.total })}
          </p>
          <p className="results__percent">{t('results.percent', { percent: me.topPercent })}</p>
          <dl className="stats">
            <dt>{t('results.best')}</dt>
            <dd className="stats__score">{formatScore(me.score)}</dd>
            <dt>{t('results.shifts')}</dt>
            <dd>{t('ranking.shifts', { count: me.shiftsCleared })}</dd>
            <dt>{t('results.days')}</dt>
            <dd>{t('ranking.days', { count: me.daysPlayed })}</dd>
          </dl>
        </div>
      ) : (
        <p className="ranking__me">{t('results.notJoined')}</p>
      )}
      <p className="panel__hint">{t('ranking.participants', { count: results.total })}</p>
      {results.total === 0 ? (
        <p className="panel__hint">{t('results.empty')}</p>
      ) : (
        <>
          <h3 className="ranking__heading">{t('ranking.top')}</h3>
          <RankingList entries={results.top} showDays />
          {me && me.rank > results.top.length && results.around.length > 0 && (
            <>
              <h3 className="ranking__heading">{t('ranking.around')}</h3>
              <RankingList entries={results.around} showDays />
            </>
          )}
        </>
      )}
      {me && (
        <section className="results__share">
          <h3 className="ranking__heading">{t('shareCard.title')}</h3>
          <ResultsShare
            data={{
              weekId: results.weekId,
              weekNumber: results.number,
              rank: me.rank,
              topPercent: me.topPercent,
              bestScore: formatScore(me.score),
              shiftsCleared: me.shiftsCleared,
              daysPlayed: me.daysPlayed,
              provisional: false,
            }}
          />
        </section>
      )}
      <p className="weekly__commitment">
        {t('results.secret', { secret: results.weekSecret.slice(0, 16) })}
      </p>
    </>
  );
}
