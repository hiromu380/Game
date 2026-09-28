/**
 * デイリーチャレンジのメニュー（モーダル）
 *
 * 今日のデイリーを取得し、状況に応じて「本番に挑戦 / 続きから / 終了済み」「練習」「ランキング」を出す。
 * - 初めての参加時だけ本人確認して登録する（Web 版は人間確認 Turnstile、デスクトップ版は Steam）
 * - 練習は本番を終えた後に解放する（CLAUDE.md「挑戦後は同じ条件の練習モードを遊べる」）
 * 表示名の変更もここで行う。
 */
import type { DailyInfo, DailySessionView } from '@chain-factory/shared';
import type { RunState } from '@chain-factory/sim';
import { useCallback, useEffect, useState } from 'react';
import { useI18n } from '../../i18n';
import { api, OnlineError, type OnlineErrorCode } from '../../online/api';
import { buildDailyRun, buildPracticeRun } from '../../online/dailyRun';
import { loadIdentity } from '../../online/identity';
import { getPlatform, requestOnScreenKeyboard } from '../../platform';
import { HumanCheck } from './HumanCheck';
import { SteamSignIn } from './SteamSignIn';
import type { PlayMode } from '../../state/gameReducer';
import { describeBoss } from '../BossNotice';
import { RankingView } from './RankingView';

interface Props {
  /** 最初からランキングを開く（デイリーの結果画面から来たとき） */
  initialView?: 'menu' | 'ranking';
  onEnter: (run: RunState, mode: PlayMode) => void;
  onClose: () => void;
  /** ランキングで自分の順位を受け取った（上位○% の実績の判定に使う） */
  onRanked: (topPercent: number) => void;
}

/** 取得した今日のデイリーと自分の進行状況（fetchedAt は締め切りまでの残り時間の表示用） */
type Loaded = { info: DailyInfo; session: DailySessionView | null; fetchedAt: number };

const MINUTE = 60_000;

async function fetchDaily(): Promise<Loaded> {
  const info = await api.getToday();
  const session = await api.getSession(info.dailyId);
  return { info, session, fetchedAt: Date.now() };
}

export function DailyMenu({ initialView = 'menu', onEnter, onClose, onRanked }: Props) {
  const { t } = useI18n();
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [error, setError] = useState<OnlineErrorCode | null>(null);
  const [view, setView] = useState(initialView);
  const [busy, setBusy] = useState(false);
  /** 匿名登録済みか（まだなら人間確認を出す） */
  const [registered, setRegistered] = useState(() => loadIdentity() !== null);

  // 今日のデイリーと自分の進行状況を取得する（開いたとき・再読み込みのとき）
  const load = useCallback(() => {
    fetchDaily()
      .then((result) => {
        setLoaded(result);
        setError(null);
      })
      .catch((e: unknown) => setError(e instanceof OnlineError ? e.code : 'network'));
  }, []);

  useEffect(load, [load]);

  // 登録できたら進行状況を取り直す（Steam では別の端末で始めたデイリーの続きがあり得る）
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
      const session = loaded!.session ?? (await api.start(info.dailyId));
      onEnter(buildDailyRun(info, session), {
        kind: 'daily',
        dailyId: info.dailyId,
        number: info.number,
      });
    });

  const practice = () => {
    const { info } = loaded!;
    onEnter(buildPracticeRun(info), {
      kind: 'practice',
      dailyId: info.dailyId,
      number: info.number,
    });
  };

  const body = (() => {
    if (!loaded) {
      return (
        <>
          <p className="panel__hint">{error ? t('daily.offline') : t('daily.loading')}</p>
          {error && (
            <div className="button-row">
              <button
                onClick={() => {
                  setError(null);
                  load();
                }}
              >
                {t('daily.retry')}
              </button>
            </div>
          )}
        </>
      );
    }
    const { info, session, fetchedAt } = loaded;
    if (view === 'ranking') {
      return (
        <RankingView
          dailyId={info.dailyId}
          number={info.number}
          onBack={() => setView('menu')}
          onRanked={onRanked}
        />
      );
    }
    const rule = info.config.globalModifier;
    // 表示用の仮ラン（説明文の効果量は RunConfig から埋め込む）
    const preview = buildPracticeRun(info);
    const left = Math.max(0, info.closesAt - fetchedAt);
    const finished = session?.status === 'finished';

    return (
      <>
        <h2 className="panel__title">{t('daily.title', { number: info.number })}</h2>
        <p className="panel__hint">{t('daily.description')}</p>
        {rule && (
          <div className="boss-notice boss-notice--now">
            <span className="boss-notice__label">{t('daily.specialRule')}</span>
            <strong>{t(`boss.${rule.id}.name`)}</strong>
            <span className="boss-notice__desc">{describeBoss(t, preview, rule)}</span>
          </div>
        )}
        <p className="panel__hint">
          {t('daily.timeLeft', {
            hours: Math.floor(left / (60 * MINUTE)),
            minutes: Math.floor((left % (60 * MINUTE)) / MINUTE),
          })}
        </p>

        {!registered && <SignIn onRegistered={onRegistered} />}
        <div className="button-row daily__actions">
          {finished ? (
            <p className="panel__hint">{t('daily.finished')}</p>
          ) : (
            <button
              className="button--primary"
              disabled={busy || !registered}
              onClick={() => void playRanked()}
            >
              {session ? t('daily.resume', { shift: session.ops.length + 1 }) : t('daily.start')}
            </button>
          )}
          <button disabled={busy || !finished} onClick={practice}>
            {t('daily.practice')}
          </button>
          <button disabled={busy} onClick={() => setView('ranking')}>
            {t('daily.ranking')}
          </button>
        </div>
        <p className="panel__hint">
          {finished ? t('daily.practiceHint') : t('daily.practiceLocked')}
        </p>
        {error && <p className="panel__hint daily__error">{t(`error.online.${error}`)}</p>}

        {registered && <NameEditor />}
        <p className="daily__commitment">
          {t('daily.seedCommitment', { hash: info.seedCommitment.slice(0, 16) })}
        </p>
      </>
    );
  })();

  return (
    <div className="modal" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="modal__body panel daily" onClick={(e) => e.stopPropagation()}>
        {body}
        <div className="button-row">
          <button className="button--ghost" onClick={onClose}>
            {t('daily.close')}
          </button>
        </div>
      </div>
    </div>
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
    <div className="settings__row daily__name">
      <label htmlFor="daily-name">{t('online.name')}</label>
      <input
        id="daily-name"
        value={name}
        maxLength={24}
        placeholder={t('online.namePlaceholder')}
        onChange={(e) => setName(e.target.value)}
        onFocus={(e) => requestOnScreenKeyboard(e.currentTarget)}
      />
      <button className="button--small" onClick={() => void save()}>
        {t('online.nameSave')}
      </button>
      {message && <p className="panel__hint daily__error">{message}</p>}
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
