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
import { withMood } from '../art/look';
import { KIMARITE_DESC } from '../kimariteBook';
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
  spoil = false,
  onSpoil,
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
  /** 今日の一番の結果を伏せない（この場所は伏せない、を選んだ） */
  spoil?: boolean;
  onSpoil?: () => void;
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
  // 今日の一番の結果を明かした日（伏せている間は、その日で星取りを止める）
  const [shownDay, setShownDay] = useState(from - 1);
  // 取組を見ている間は伏せたまま。閉じたら明かす
  const [revealOnClose, setRevealOnClose] = useState(false);
  useEffect(() => {
    if (revealOnClose && !paused) {
      setShownDay(day);
      setRevealOnClose(false);
    }
  }, [revealOnClose, paused, day]);
  const pick = who && day >= from ? todayBout(rows, day, honmei) : null;
  const hiddenId =
    onWatch && !spoil && pick && !pick.bout.fusen && shownDay < day ? pick.row.id : null;
  /** 行ごとに見せてよい日（伏せている今日の一番の弟子は前の日まで） */
  const seen = (r: TickerEntry) => (r.id === hiddenId ? day - 1 : day);
  useEffect(() => {
    if (settings.sound) playSound('drum');
  }, [settings.sound]);
  useEffect(() => {
    if (day >= to || paused || hiddenId !== null) return;
    const id = setTimeout(() => setDay((d) => Math.min(to, d + 1)), day < from ? 380 : DAY_MS);
    return () => clearTimeout(id);
  }, [day, from, to, paused, hiddenId]);
  // 札が入った日に、小さな木の音。勝ち越しが決まった日は拍手（行ごとに、見せてよい日で数える）
  const sek = (r: TickerEntry) => r.rank !== null && isSekitori(r.rank);
  const kkToday = rows.filter((r) => {
    const e = seen(r);
    return (
      e >= from &&
      decidedUntil(r, e, sek(r)) === 'kachikoshi' &&
      decidedUntil(r, e - 1, sek(r)) !== 'kachikoshi'
    );
  });
  // 目標に届いた日（勝ち越しと同じく褒める）
  for (const r of rows) {
    const e = seen(r);
    if (
      r.target &&
      r.target.kind !== 'kachikoshi' &&
      e >= from &&
      reached(r.target, tallyUntil(r, e).wins) &&
      !reached(r.target, tallyUntil(r, e - 1).wins) &&
      !kkToday.includes(r)
    )
      kkToday.push(r);
  }
  const kkIds = new Set(kkToday.map((r) => r.id));
  // 本命の勝ち越しが決まった日（拍手に歓声を重ねる）・全勝が決まった日（いちばん褒める）
  const cheerIds = rows
    .filter((r) => {
      const e = seen(r);
      if (e < from) return false;
      const honmeiHit =
        r.id === honmei &&
        decidedUntil(r, e, sek(r)) === 'kachikoshi' &&
        decidedUntil(r, e - 1, sek(r)) !== 'kachikoshi';
      return honmeiHit || zenshoDay(r, sek(r)) === e;
    })
    .map((r) => r.id);
  const markIds = rows
    .filter((r) => seen(r) >= from && r.marks[seen(r) - 1] != null)
    .map((r) => r.id);
  // 同じ行の同じ日の音は1回だけ（明かしたときに鳴らし、次の日にもう一度鳴らさない）
  const played = useRef(new Set<string>());
  const soundKey = rows.map((r) => `${r.id}:${seen(r)}`).join(',');
  useEffect(() => {
    const fresh = (id: number) => {
      const r = rows.find((x) => x.id === id)!;
      const k = `${id}:${seen(r)}`;
      return !played.current.has(k);
    };
    const cheer = cheerIds.some(fresh);
    const clap = [...kkIds].some(fresh);
    const tick = markIds.some(fresh);
    for (const r of rows) played.current.add(`${r.id}:${seen(r)}`);
    if (!settings.sound || reduced) return;
    if (cheer) playSound('cheer');
    if (clap) playSound('clap');
    else if (tick) playSound('tick');
    // 見せる日が変わったときだけ鳴らす
    // eslint-disable-next-line react-hooks/exhaustive-deps -- その日の札で1回だけ
  }, [soundKey]);
  const done = day >= to;
  // 見終えたら、少し間をおいて次へ（押せばすぐ）。動きを減らす設定では待つ
  const next = useRef(onDone);
  next.current = onDone;
  useEffect(() => {
    if (!done || reduced || paused || hiddenId !== null) return;
    const id = setTimeout(() => next.current(), AUTO_NEXT_MS);
    return () => clearTimeout(id);
  }, [done, reduced, paused, hiddenId]);
  const days = Array.from({ length: BASHO_DAYS }, (_, i) => i + 1);
  return (
    <div className="modal" role="dialog" aria-modal="true" aria-labelledby="ticker-title">
      <div className="modal__box modal__box--wide ticker">
        <h2 id="ticker-title">{title}</h2>
        <p className="ticker__day" aria-live="polite">
          {day < from ? t('ticker.ready') : dayLabel(t, day)}
        </p>
        {who && day >= from && (
          <TodayBout
            rows={rows}
            day={day}
            honmei={honmei}
            who={who}
            hidden={hiddenId !== null}
            onWatch={
              onWatch &&
              ((b) => {
                onWatch(b);
                if (hiddenId !== null) setRevealOnClose(true);
              })
            }
            onReveal={() => setShownDay(day)}
            onSpoil={onSpoil}
          />
        )}
        {rows.length === 0 ? (
          <p className="note">{t('report.noneMine')}</p>
        ) : (
          <ul className="ticker__list">
            {rows.map((r) => {
              const e = seen(r);
              const tally = tallyUntil(r, e);
              const decided = decidedUntil(r, e, sek(r));
              return (
                <li
                  key={r.id}
                  className={`ticker__row ${kkIds.has(r.id) ? 'is-kk' : ''} ${r.id === honmei ? 'is-honmei' : ''}`}
                >
                  <div className="ticker__who">
                    {r.look && (
                      <span className="ticker__face">
                        <PixelPortrait
                          look={withMood(
                            r.look,
                            decided === 'kachikoshi' ? 'joy' : decided ? 'grit' : null,
                          )}
                          size={28}
                        />
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
                      return z !== null && e >= z ? (
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
                      const m = d <= e ? r.marks[d - 1]! : null;
                      const fresh = d === e && d >= from;
                      const veiled = d === day && d > e;
                      return (
                        <span
                          key={d}
                          aria-hidden="true"
                          className={[
                            'ticker__mark',
                            veiled
                              ? 'is-veiled'
                              : m
                                ? `is-${m}`
                                : d <= day
                                  ? 'is-none'
                                  : 'is-ahead',
                            fresh && m ? 'is-fresh' : '',
                            d === 8 ? 'is-nakabi' : '',
                          ].join(' ')}
                        >
                          {veiled ? '？' : m ? SIGN[m] : d <= day ? '・' : ''}
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
            <button
              className="button"
              data-dismiss
              onClick={() => {
                setShownDay(to);
                setDay(to);
              }}
            >
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
  hidden,
  onWatch,
  onReveal,
  onSpoil,
}: {
  rows: TickerEntry[];
  day: number;
  honmei: number | null;
  who: WhoOf;
  /** 結果を伏せている（取組を見る・結果を見るを選ぶまで） */
  hidden: boolean;
  onWatch?: (b: BoutResult) => void;
  onReveal: () => void;
  onSpoil?: () => void;
}) {
  const { t } = useI18n();
  const pick = todayBout(rows, day, honmei);
  if (!pick) return null;
  const { row: r, bout: b } = pick;
  const won = b.winnerId === r.id;
  const opp = who(b.eastId === r.id ? b.westId : b.eastId);
  return (
    <div
      className={`today ${hidden ? 'is-hidden' : won ? 'is-win' : 'is-loss'}`}
      aria-live="polite"
    >
      <span className="today__label">{t('ticker.today')}</span>
      <div className="today__pair">
        <span className="today__side">
          {r.look && (
            <PixelPortrait
              look={withMood(r.look, hidden ? null : won ? 'joy' : 'grit')}
              size={40}
            />
          )}
          <strong>{r.name}</strong>
        </span>
        {hidden ? (
          <span className="today__result">
            <span className="today__mark" aria-hidden="true">
              ？
            </span>
            <span>{t('ticker.hidden')}</span>
          </span>
        ) : (
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
        )}
        <span className="today__side">
          {opp.look && (
            <PixelPortrait
              look={withMood(opp.look, hidden ? null : won ? 'grit' : 'joy')}
              size={40}
            />
          )}
          <span>
            {opp.name}
            <small className="muted">（{opp.stable}）</small>
          </span>
        </span>
      </div>
      {!hidden && !b.fusen && KIMARITE_DESC.has(b.kimarite) && (
        <p className="today__desc">{t(`kimarite.desc.${b.kimarite}` as MessageKey)}</p>
      )}
      {hidden ? (
        <div className="today__actions">
          {onWatch && (
            <button className="button" onClick={() => onWatch(b)}>
              {t('bigBout.watch')}
            </button>
          )}
          <button className="button button--primary" autoFocus onClick={onReveal}>
            {t('ticker.reveal')}
          </button>
          {onSpoil && (
            <button className="today__spoil" onClick={onSpoil}>
              {t('ticker.spoil')}
            </button>
          )}
        </div>
      ) : (
        onWatch &&
        !b.fusen && (
          <button className="button today__watch" onClick={() => onWatch(b)}>
            {t('bigBout.watch')}
          </button>
        )
      )}
    </div>
  );
}
