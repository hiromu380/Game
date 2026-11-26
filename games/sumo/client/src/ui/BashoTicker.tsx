import { useEffect, useRef, useState } from 'react';
import { isSekitori, type BoutResult, type Rank } from '@ichimon/sim';
import { useI18n, type MessageKey } from '../i18n';
import { dayLabel, rankLabel } from '../format';
import { useSettings } from '../settings';
import { playSound } from '../sound';
import {
  BASHO_DAYS,
  decidedUntil,
  tallyUntil,
  zenshoDay,
  type Mark,
  type TickerRow,
  todayBout,
} from '../ticker';
import { PixelPortrait } from '../art/PixelPortrait';
import type { Look } from '../art/look';
import { reached, reachedText, targetText, targetWins, type Target } from '../targets';

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
  /** この場所の近い目標 */
  target?: Target;
  /** 顔の絵（なければ出さない） */
  look?: Look;
  /** その場所の取組（今日の一番に使う。なければ出さない） */
  bouts?: readonly BoutResult[];
}

/** 今日の一番の相手（名前・部屋・顔の絵） */
export type WhoOf = (id: number) => { name: string; stable: string; look?: Look };

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
  honmei = null,
  who,
  onWatch,
  paused = false,
}: {
  title: string;
  rows: TickerEntry[];
  /** 本命（応援予想）の弟子 */
  honmei?: number | null;
  /** 相手の名前と顔（あれば今日の一番を出す） */
  who?: WhoOf;
  /** 今日の一番を見る（渡すと「取組を見る」を出す） */
  onWatch?: (b: BoutResult) => void;
  /** 取組を見ている間は止める（日を進めない・次へ進まない） */
  paused?: boolean;
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
    if (day >= to || paused) return;
    const id = setTimeout(() => setDay((d) => Math.min(to, d + 1)), day < from ? 380 : DAY_MS);
    return () => clearTimeout(id);
  }, [day, from, to, paused]);
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
  // 目標に届いた日（勝ち越しと同じく褒める）
  for (const r of rows) {
    if (
      r.target &&
      r.target.kind !== 'kachikoshi' &&
      day >= from &&
      reached(r.target, tallyUntil(r, day).wins) &&
      !reached(r.target, tallyUntil(r, day - 1).wins) &&
      !kkToday.includes(r)
    )
      kkToday.push(r);
  }
  const kkIds = new Set(kkToday.map((r) => r.id));
  // 本命の勝ち越しが決まった日（拍手に歓声を重ねる）
  const honmeiRow = rows.find((r) => r.id === honmei);
  const honmeiHit =
    honmeiRow !== undefined &&
    day >= from &&
    decidedUntil(honmeiRow, day, honmeiRow.rank !== null && isSekitori(honmeiRow.rank)) ===
      'kachikoshi' &&
    decidedUntil(honmeiRow, day - 1, honmeiRow.rank !== null && isSekitori(honmeiRow.rank)) !==
      'kachikoshi';
  // 全勝が決まった日（最後の番の日）。いちばん褒める
  const sek = (r: TickerEntry) => r.rank !== null && isSekitori(r.rank);
  const zenshoToday = day >= from && rows.some((r) => zenshoDay(r, sek(r)) === day);
  useEffect(() => {
    if (!settings.sound || reduced) return;
    if (honmeiHit || zenshoToday) playSound('cheer');
    if (kkIds.size > 0) playSound('clap');
    else if (anyMark) playSound('tick');
    // 日が進んだときだけ鳴らす
    // eslint-disable-next-line react-hooks/exhaustive-deps -- その日の札で1回だけ
  }, [day]);
  const done = day >= to;
  // 見終えたら、少し間をおいて次へ（押せばすぐ）。動きを減らす設定では待つ
  const next = useRef(onDone);
  next.current = onDone;
  useEffect(() => {
    if (!done || reduced || paused) return;
    const id = setTimeout(() => next.current(), AUTO_NEXT_MS);
    return () => clearTimeout(id);
  }, [done, reduced, paused]);
  const days = Array.from({ length: BASHO_DAYS }, (_, i) => i + 1);
  return (
    <div className="modal" role="dialog" aria-modal="true" aria-labelledby="ticker-title">
      <div className="modal__box modal__box--wide ticker">
        <h2 id="ticker-title">{title}</h2>
        <p className="ticker__day" aria-live="polite">
          {day < from ? t('ticker.ready') : dayLabel(t, day)}
        </p>
        {who && day >= from && (
          <TodayBout rows={rows} day={day} honmei={honmei} who={who} onWatch={onWatch} />
        )}
        {rows.length === 0 ? (
          <p className="note">{t('report.noneMine')}</p>
        ) : (
          <ul className="ticker__list">
            {rows.map((r) => {
              const tally = tallyUntil(r, day);
              const decided = decidedUntil(r, day, r.rank !== null && isSekitori(r.rank));
              return (
                <li
                  key={r.id}
                  className={`ticker__row ${kkIds.has(r.id) ? 'is-kk' : ''} ${r.id === honmei ? 'is-honmei' : ''}`}
                >
                  <div className="ticker__who">
                    {r.look && (
                      <span className="ticker__face">
                        <PixelPortrait look={r.look} size={28} />
                      </span>
                    )}
                    <span className="ticker__rank">{rankLabel(t, r.rank)}</span>
                    <strong>
                      {r.id === honmei && (
                        <span className="honmei-mark" title={t('honmei.label')}>
                          ◎<span className="visually-hidden">{t('honmei.label')}</span>
                        </span>
                      )}
                      {r.name}
                    </strong>
                    <span className="ticker__tally">
                      {t('race.record', { wins: tally.wins, losses: tally.losses })}
                    </span>
                    {r.absentFrom !== undefined && day >= Math.max(from, r.absentFrom) && (
                      <span className="tag tag--warn">{t('ticker.absent')}</span>
                    )}
                    {r.target &&
                      r.absentFrom !== 0 &&
                      (reached(r.target, tally.wins)
                        ? // 勝ち越し・カド番脱出は下の札で出すので、上の段・大関の目標だけ
                          r.target.kind !== 'kachikoshi' &&
                          r.target.kind !== 'kadoban' && (
                            <span className="tag tag--gold">{reachedText(t, r.target)}</span>
                          )
                        : targetWins(r.target) !== null &&
                          // 勝ち越しが決まった後も、上の段の目標は残す
                          !(decided && r.target.kind === 'kachikoshi') && (
                            <span className="ticker__goal">{targetText(t, r.target)}</span>
                          ))}
                    {(() => {
                      const z = zenshoDay(r, sek(r));
                      return z !== null && day >= z ? (
                        <span className="tag tag--gold">{t('ticker.zensho')}</span>
                      ) : null;
                    })()}
                    {decided === 'kachikoshi' && r.id === honmei && (
                      <span className="tag tag--gold">{t('honmei.hit')}</span>
                    )}
                    {decided && (
                      <span className={`tag ${decided === 'kachikoshi' ? 'tag--good' : ''}`}>
                        {t(
                          decided !== 'kachikoshi'
                            ? 'ticker.makekoshi'
                            : r.target?.kind === 'kadoban'
                              ? 'ticker.kadobanOut'
                              : 'ticker.kachikoshi',
                        )}
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
          {/* Esc でも押せる（飛ばす → 次へ） */}
          {done ? (
            <button className="button button--primary" data-dismiss onClick={onDone}>
              {doneLabel}
            </button>
          ) : (
            <button className="button" data-dismiss onClick={() => setDay(to)}>
              {t('ticker.skip')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * 今日の一番: その日に取組のあった弟子のうち、本命（いなければ番付のいちばん上）の一番を、顔・相手・決まり手で見せる。
 * 表を眺めるだけにしない（毎日ひとつ、見せ場を作る）
 */
function TodayBout({
  rows,
  day,
  honmei,
  who,
  onWatch,
}: {
  rows: TickerEntry[];
  day: number;
  honmei: number | null;
  who: WhoOf;
  onWatch?: (b: BoutResult) => void;
}) {
  const { t } = useI18n();
  const pick = todayBout(rows, day, honmei);
  if (!pick) return null;
  const { row: r, bout: b } = pick;
  const won = b.winnerId === r.id;
  const opp = who(b.eastId === r.id ? b.westId : b.eastId);
  return (
    <div className={`today ${won ? 'is-win' : 'is-loss'}`} aria-live="polite">
      <span className="today__label">{t('ticker.today')}</span>
      <div className="today__pair">
        <span className="today__side">
          {r.look && <PixelPortrait look={r.look} size={40} />}
          <strong>{r.name}</strong>
        </span>
        <span className="today__result">
          <span className="today__mark" aria-hidden="true">
            {won ? '○' : '●'}
          </span>
          <span>
            {b.fusen
              ? t(won ? 'ticker.fusenWin' : 'ticker.fusenLoss')
              : t(`kimarite.${b.kimarite}` as MessageKey)}
          </span>
          <span className="visually-hidden">{t(won ? 'report.win' : 'report.loss')}</span>
        </span>
        <span className="today__side">
          {opp.look && <PixelPortrait look={opp.look} size={40} />}
          <span>
            {opp.name}
            <small className="muted">（{opp.stable}）</small>
          </span>
        </span>
      </div>
      {onWatch && !b.fusen && (
        <button className="button today__watch" onClick={() => onWatch(b)}>
          {t('bigBout.watch')}
        </button>
      )}
    </div>
  );
}
