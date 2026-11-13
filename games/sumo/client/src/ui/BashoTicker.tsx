import { useEffect, useRef, useState } from 'react';
import { isSekitori, type Rank } from '@ichimon/sim';
import { useI18n } from '../i18n';
import { dayLabel, rankLabel } from '../format';
import { useSettings } from '../settings';
import { playSound } from '../sound';
import { BASHO_DAYS, decidedUntil, tallyUntil, type Mark, type TickerRow } from '../ticker';

/** 1日を見せる間隔（ミリ秒） */
const DAY_MS = 520;
/** 見終えてから次へ進むまで（ミリ秒） */
const AUTO_NEXT_MS = 1400;

const SIGN: Record<Exclude<Mark, null>, string> = {
  win: '○',
  loss: '●',
  fusenWin: '□',
  fusenLoss: '■',
};

export interface TickerEntry extends TickerRow {
  name: string;
  rank: Rank | null;
  /** 休場している弟子: 休み始めた日（初日からなら 0）。出ていれば省く */
  absentFrom?: number;
}

/**
 * 本場所を1日ずつ見せる星取表: from 日目から to 日目まで、自分の弟子の白星・黒星が1日ずつ入っていく。
 * 飛ばせる。動きを減らす設定では、はじめから全部見せる
 */
export function BashoTicker({
  title,
  rows,
  from,
  to,
  doneLabel,
  onDone,
}: {
  title: string;
  rows: TickerEntry[];
  from: number;
  to: number;
  doneLabel: string;
  onDone: () => void;
}) {
  const { t } = useI18n();
  const { settings } = useSettings();
  const reduced =
    typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  // 見せ終わった日（from - 1 から始めて、to まで）
  const [day, setDay] = useState(reduced ? to : from - 1);
  useEffect(() => {
    if (settings.sound) playSound('drum');
  }, [settings.sound]);
  useEffect(() => {
    if (day >= to) return;
    const id = setTimeout(() => setDay((d) => Math.min(to, d + 1)), day < from ? 380 : DAY_MS);
    return () => clearTimeout(id);
  }, [day, from, to]);
  // 札が入った日に、小さな木の音。勝ち越しが決まった日は拍手
  const anyMark = day >= from && rows.some((r) => r.marks[day - 1] != null);
  const kkToday = rows.filter((r) => {
    const sekitori = r.rank !== null && isSekitori(r.rank);
    return (
      day >= from &&
      decidedUntil(r, day, sekitori) === 'kachikoshi' &&
      decidedUntil(r, day - 1, sekitori) !== 'kachikoshi'
    );
  });
  const kkIds = new Set(kkToday.map((r) => r.id));
  useEffect(() => {
    if (!settings.sound || reduced) return;
    if (kkIds.size > 0) playSound('clap');
    else if (anyMark) playSound('tick');
    // 日が進んだときだけ鳴らす
  }, [day]);
  const done = day >= to;
  // 見終えたら、少し間をおいて次へ（押せばすぐ）。動きを減らす設定では待つ
  const next = useRef(onDone);
  next.current = onDone;
  useEffect(() => {
    if (!done || reduced) return;
    const id = setTimeout(() => next.current(), AUTO_NEXT_MS);
    return () => clearTimeout(id);
  }, [done, reduced]);
  const days = Array.from({ length: BASHO_DAYS }, (_, i) => i + 1);
  return (
    <div className="modal" role="dialog" aria-modal="true" aria-labelledby="ticker-title">
      <div className="modal__box modal__box--wide ticker">
        <h2 id="ticker-title">{title}</h2>
        <p className="ticker__day" aria-live="polite">
          {day < from ? t('ticker.ready') : dayLabel(t, day)}
        </p>
        {rows.length === 0 ? (
          <p className="note">{t('report.noneMine')}</p>
        ) : (
          <ul className="ticker__list">
            {rows.map((r) => {
              const tally = tallyUntil(r, day);
              const decided = decidedUntil(r, day, r.rank !== null && isSekitori(r.rank));
              return (
                <li key={r.id} className={`ticker__row ${kkIds.has(r.id) ? 'is-kk' : ''}`}>
                  <div className="ticker__who">
                    <span className="ticker__rank">{rankLabel(t, r.rank)}</span>
                    <strong>{r.name}</strong>
                    <span className="ticker__tally">
                      {t('race.record', { wins: tally.wins, losses: tally.losses })}
                    </span>
                    {r.absentFrom !== undefined && day >= Math.max(from, r.absentFrom) && (
                      <span className="tag tag--warn">{t('ticker.absent')}</span>
                    )}
                    {decided && (
                      <span className={`tag ${decided === 'kachikoshi' ? 'tag--good' : ''}`}>
                        {t(decided === 'kachikoshi' ? 'report.kachikoshi' : 'report.makekoshi')}
                      </span>
                    )}
                  </div>
                  <div
                    className="ticker__marks"
                    aria-label={t('ticker.rowAria', {
                      name: r.name,
                      wins: tally.wins,
                      losses: tally.losses,
                    })}
                  >
                    {days.map((d) => {
                      const m = d <= day ? r.marks[d - 1]! : null;
                      const fresh = d === day && d >= from;
                      return (
                        <span
                          key={d}
                          aria-hidden="true"
                          className={[
                            'ticker__mark',
                            m ? `is-${m}` : d <= day ? 'is-none' : 'is-ahead',
                            fresh && m ? 'is-fresh' : '',
                            d === 8 ? 'is-nakabi' : '',
                          ].join(' ')}
                        >
                          {m ? SIGN[m] : d <= day ? '・' : ''}
                        </span>
                      );
                    })}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        <p className="note">{t('ticker.legend')}</p>
        <div className="modal__actions">
          {done ? (
            <button className="button button--primary" onClick={onDone}>
              {doneLabel}
            </button>
          ) : (
            <button className="button" onClick={() => setDay(to)}>
              {t('ticker.skip')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
