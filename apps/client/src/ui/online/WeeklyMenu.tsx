/**
 * 週替わりチャレンジの画面（モーダル）
 *
 * 今週の条件（特殊ルール）、自分のベスト、挑戦した日（7マス）、次に挑戦できる時刻、
 * 本番・練習のボタン、暫定ランキング・結果発表への入口を出す。
 * - 本番は1日1回（3シフト）。週のベストがランキングに載る
 * - 練習は、今週の本番を1回終えると遊べる（同じ条件で何度でも。ランキング対象外）
 * - 初めての参加時だけ本人確認して登録する（Web 版は人間確認 Turnstile、デスクトップ版は Steam）
 * - 先週の結果発表をまだ見ていなくて、先週に参加していれば、開いたときに結果発表を出す
 * 表示名の変更もここで行う。
 */
import type { WeeklyAttemptView, WeeklyInfo } from '@chain-factory/shared';
import type { RunState } from '@chain-factory/sim';
import { useCallback, useEffect, useState } from 'react';
import { useI18n } from '../../i18n';
import { api, OnlineError, type OnlineErrorCode } from '../../online/api';
import { loadIdentity } from '../../online/identity';
import { hasUnreadResults, loadResultsSeen } from '../../online/resultsSeen';
import { addDays, daysOfWeek, monthDay, weekdayOf } from '../../online/weekDates';
import { buildPracticeRun, buildWeeklyRun } from '../../online/weeklyRun';
import { BOSS_ICONS } from '../../assets/manifest';
import { getPlatform, requestOnScreenKeyboard } from '../../platform';
import { HumanCheck } from './HumanCheck';
import { SteamSignIn } from './SteamSignIn';
import type { PlayMode } from '../../state/gameReducer';
import { describeBoss } from '../BossNotice';
import { ProvisionalRanking } from './RankingView';
import { ResultsView } from './ResultsView';

export type WeeklyView = 'menu' | 'ranking' | 'results';

interface Props {
  /** 最初に開く画面（結果画面から来たときは暫定ランキング、タイトルの「ランキング」からは結果発表） */
  initialView?: WeeklyView;
  onEnter: (run: RunState, mode: PlayMode) => void;
  onClose: () => void;
  /** 確定した結果発表で自分の上位○% を受け取った（上位の実績の判定に使う） */
  onRanked: (topPercent: number) => void;
}

/** 取得した今週の情報と今日の挑戦 */
type Loaded = { info: WeeklyInfo; attempt: WeeklyAttemptView | null };

const MINUTE = 60_000;

async function fetchWeek(): Promise<Loaded> {
  const info = await api.getCurrentWeek();
  const attempt =
    info.me?.today === 'playing' ? await api.getAttempt(info.weekId, info.today) : null;
  return { info, attempt };
}

/** 先週に参加していて、その結果発表をまだ見ていないか */
async function shouldAnnounce(previousWeek: string): Promise<boolean> {
  if (!loadIdentity()) return false;
  const latest = await api.getLatest();
  if (latest.finished[0] !== previousWeek) return false;
  if (!hasUnreadResults(latest.finished[0], loadResultsSeen())) return false;
  const results = await api.getResults(previousWeek);
  return results.me !== null;
}

export function WeeklyMenu({ initialView = 'menu', onEnter, onClose, onRanked }: Props) {
  const { t, formatScore } = useI18n();
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [error, setError] = useState<OnlineErrorCode | null>(null);
  const [view, setView] = useState<WeeklyView>(initialView);
  const [announce, setAnnounce] = useState(false);
  const [busy, setBusy] = useState(false);
  /** 匿名登録済みか（まだなら人間確認を出す） */
  const [registered, setRegistered] = useState(() => loadIdentity() !== null);

  // 今週の情報と今日の挑戦を取得する（開いたとき・再読み込みのとき）
  const load = useCallback(() => {
    fetchWeek()
      .then((result) => {
        setLoaded(result);
        setError(null);
      })
      .catch((e: unknown) => setError(e instanceof OnlineError ? e.code : 'network'));
  }, []);

  useEffect(load, [load]);

  // 先週の結果発表が未読なら、チャレンジ画面を開いたときに出す
  const weekId = loaded?.info.weekId;
  useEffect(() => {
    if (!weekId || initialView !== 'menu') return;
    let cancelled = false;
    shouldAnnounce(addDays(weekId, -7))
      .then((yes) => {
        if (cancelled || !yes) return;
        setAnnounce(true);
        setView('results');
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [weekId, initialView]);

  // 登録できたら進行状況を取り直す（Steam では別の端末で始めた挑戦の続きがあり得る）
  const onRegistered = useCallback(() => {
    setRegistered(true);
    load();
  }, [load]);

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (e) {
      setError(e instanceof OnlineError ? e.code : 'network');
    } finally {
      setBusy(false);
    }
  };

  const playRanked = () =>
    run(async () => {
      const { info } = loaded!;
      const attempt = loaded!.attempt ?? (await api.start(info.weekId));
      onEnter(buildWeeklyRun(info, attempt), {
        kind: 'weekly',
        weekId: info.weekId,
        dayId: attempt.dayId,
        number: info.number,
      });
    });

  const practice = () => {
    const { info } = loaded!;
    onEnter(buildPracticeRun(info), { kind: 'practice', weekId: info.weekId, number: info.number });
  };

  const body = (() => {
    if (!loaded) {
      return (
        <>
          <p className="panel__hint">{error ? t('weekly.offline') : t('weekly.loading')}</p>
          {error && (
            <div className="button-row">
              <button
                onClick={() => {
                  setError(null);
                  load();
                }}
              >
                {t('weekly.retry')}
              </button>
            </div>
          )}
        </>
      );
    }
    const { info, attempt } = loaded;
    if (view === 'ranking') {
      return (
        <ProvisionalRanking
          weekId={info.weekId}
          number={info.number}
          onBack={() => setView('menu')}
        />
      );
    }
    if (view === 'results') {
      return (
        <ResultsView
          weekId={addDays(info.weekId, -7)}
          announce={announce}
          onBack={() => {
            setAnnounce(false);
            setView('menu');
          }}
          onRanked={onRanked}
        />
      );
    }
    const rule = info.config.globalModifier;
    // 表示用の仮ラン（説明文の効果量は RunConfig から埋め込む）
    const preview = buildPracticeRun(info);
    // 残り時間は取得した時点のサーバーの時計で数える（端末の時計のずれに左右されない）
    const weekLeft = Math.max(0, info.closesAt - info.serverNow);
    const nextLeft = Math.max(0, info.nextDayAt - info.serverNow);
    const today = info.me?.today ?? 'none';
    const playedAny = info.me?.days.some((d) => d.status === 'finished') ?? false;
    const nextIsNextWeek = info.nextDayAt >= info.closesAt;

    return (
      <>
        <h2 className="panel__title">{t('weekly.title', { number: info.number })}</h2>
        <p className="panel__hint">{t('weekly.description')}</p>
        {rule && (
          <div className="boss-notice boss-notice--now">
            <img className="boss-notice__icon" src={BOSS_ICONS[rule.id]} alt="" />
            <span className="boss-notice__label">{t('weekly.specialRule')}</span>
            <strong>{t(`boss.${rule.id}.name`)}</strong>
            <span className="boss-notice__desc">{describeBoss(t, preview, rule)}</span>
          </div>
        )}

        <WeekDays info={info} />
        <p className="weekly__best">
          {info.me?.best
            ? t('weekly.best', {
                score: formatScore(info.me.best.score),
                shifts: info.me.best.shiftsCleared,
              })
            : t('weekly.noBest')}
        </p>

        <p className="panel__hint">
          {today === 'finished'
            ? nextIsNextWeek
              ? t('weekly.nextWeek', duration(weekLeft))
              : t('weekly.nextDay', duration(nextLeft))
            : t('weekly.timeLeft', duration(weekLeft))}
        </p>

        {!registered && <SignIn onRegistered={onRegistered} />}
        <div className="button-row weekly__actions">
          {today === 'finished' ? (
            <p className="panel__hint">{t('weekly.finishedToday')}</p>
          ) : (
            <button
              className="button--primary"
              disabled={busy || !registered}
              onClick={() => void playRanked()}
            >
              {attempt ? t('weekly.resume', { shift: attempt.ops.length + 1 }) : t('weekly.start')}
            </button>
          )}
          <button disabled={busy || !playedAny} onClick={practice}>
            {t('weekly.practice')}
          </button>
          <button disabled={busy} onClick={() => setView('ranking')}>
            {t('weekly.ranking')}
          </button>
          <button disabled={busy} onClick={() => setView('results')}>
            {t('weekly.results')}
          </button>
        </div>
        <p className="panel__hint">
          {playedAny ? t('weekly.practiceHint') : t('weekly.practiceLocked')}
        </p>
        {error && <p className="panel__hint weekly__error">{t(`error.online.${error}`)}</p>}

        {registered && <NameEditor />}
        <p className="weekly__commitment">
          {t('weekly.seedCommitment', { hash: info.seedCommitment.slice(0, 16) })}
        </p>
      </>
    );
  })();

  return (
    <div className="modal" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="modal__body panel weekly" onClick={(e) => e.stopPropagation()}>
        {body}
        <div className="button-row">
          <button className="button--ghost" onClick={onClose} data-close>
            {t('weekly.close')}
          </button>
        </div>
      </div>
    </div>
  );
}

/** 残り時間（時間・分）。1日を超えるときは日も出す */
function duration(ms: number) {
  const hoursTotal = Math.floor(ms / (60 * MINUTE));
  return {
    days: Math.floor(hoursTotal / 24),
    hours: hoursTotal % 24,
    minutes: Math.floor((ms % (60 * MINUTE)) / MINUTE),
  };
}

/** 挑戦した日（週の7日。状態は色だけでなく記号と文字でも示す） */
function WeekDays({ info }: { info: WeeklyInfo }) {
  const { t } = useI18n();
  const played = new Map((info.me?.days ?? []).map((d) => [d.dayId, d]));
  return (
    <ol className="weekly__days" aria-label={t('weekly.daysLabel')}>
      {daysOfWeek(info.weekId).map((dayId) => {
        const day = played.get(dayId);
        const state = day
          ? day.status === 'playing'
            ? 'playing'
            : day.shiftsCleared === info.config.shifts.length
              ? 'cleared'
              : 'played'
          : dayId < info.today
            ? 'missed'
            : dayId === info.today
              ? 'today'
              : 'future';
        const { month, day: date } = monthDay(dayId);
        return (
          <li
            key={dayId}
            className={`weekly__day weekly__day--${state} ${dayId === info.today ? 'is-today' : ''}`}
            title={t(`weekly.day.${state}`)}
          >
            <span className="weekly__weekday">{t(`weekly.weekday.${weekdayOf(dayId)}`)}</span>
            <span className="weekly__mark" aria-hidden="true">
              {t(`weekly.dayMark.${state}`)}
            </span>
            <span className="weekly__date">{t('weekly.date', { month, day: date })}</span>
            <span className="visually-hidden">{t(`weekly.day.${state}`)}</span>
          </li>
        );
      })}
    </ol>
  );
}

/** 表示名の変更 */
function NameEditor() {
  const { t } = useI18n();
  const [name, setName] = useState(() => loadIdentity()?.displayName ?? '');
  const [message, setMessage] = useState<string | null>(null);

  const save = async () => {
    try {
      setName(await api.updateName(name));
      setMessage(null);
    } catch (e) {
      setMessage(t(`error.online.${e instanceof OnlineError ? e.code : 'network'}`));
    }
  };

  return (
    <div className="settings__row weekly__name">
      <label htmlFor="weekly-name">{t('online.name')}</label>
      <input
        id="weekly-name"
        value={name}
        maxLength={24}
        placeholder={t('online.namePlaceholder')}
        onChange={(e) => setName(e.target.value)}
        onFocus={(e) => requestOnScreenKeyboard(e.currentTarget)}
      />
      <button className="button--small" onClick={() => void save()}>
        {t('online.nameSave')}
      </button>
      {message && <p className="panel__hint weekly__error">{message}</p>}
    </div>
  );
}

/** 本人確認: デスクトップ版は Steam、Web 版は人間確認 */
function SignIn({ onRegistered }: { onRegistered: () => void }) {
  return getPlatform().kind === 'desktop' ? (
    <SteamSignIn onRegistered={onRegistered} />
  ) : (
    <HumanCheck onRegistered={onRegistered} />
  );
}
