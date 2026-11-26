import { useEffect, useState } from 'react';
import type { GameState, Rank, WeekResult } from '@ichimon/sim';
import { useI18n } from '../i18n';
import { useSettings } from '../settings';
import { playSound } from '../sound';
import { PixelPortrait } from '../art/PixelPortrait';
import { lookOfRikishi } from '../art/Portraits';
import { oyakataLook, rikishiLook, type Look } from '../art/look';
import { points, signedPoints } from '../points';
import { bandOf, weekEffect, type EffectRow, type StatMove, type Verdict } from '../weekEffect';

/** 演出の段: 0 ぶつかる前 → 1 ぶつかった（バーが伸びる） → 2 判子（ランク・壁・けが） */
type Stage = 0 | 1 | 2;
/** 段ごとの時刻（ミリ秒）。短く、飛ばせる */
const AT = { hit: 380, stamp: 1300 } as const;

const reduced = () =>
  typeof window !== 'undefined' &&
  (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false);

/** 胸を貸すよその関取（顔は週で決まる。だれかは言わない） */
const guestLook = (seed: number): Look =>
  rikishiLook({
    id: 900_000 + seed,
    weight: 175,
    stableId: -1 - seed,
    careerBasho: 40,
    sekitori: true,
    yokozuna: false,
    injured: false,
    fatigue: 0,
  });

/**
 * 稽古の結果カード: 週の行動を決めたら、ぶつかる場面と、能力のバーが伸びるところを短く見せる。
 * バーは「次のランクまで」（1週の伸びが目に見える幅）。ランクが上がる・壁を破る・けがは判子で。
 * 押す・Esc・Enter で閉じる（桜井氏の「演出は必ずスキップできる」）
 */
export function TrainingCut({
  game,
  week,
  ranks,
  onDone,
}: {
  game: GameState;
  week: WeekResult;
  ranks: ReadonlyMap<number, Rank>;
  onDone: () => void;
}) {
  const { t } = useI18n();
  const { settings } = useSettings();
  const [stage, setStage] = useState<Stage>(() => (reduced() ? 2 : 0));
  const rows = weekEffect(game, week);
  const a = week.action;
  const lookOf = (id: number) => {
    const r = game.rikishi.find((x) => x.id === id);
    return r ? lookOfRikishi(r, ranks.get(id) ?? null) : undefined;
  };
  const master = game.oyakata.find((o) => o.id === game.player.oyakataId);
  // 左右の顔: 個別指導は親方、胸を借りるはよその関取、申し合いは2人。大勢の週は並べる
  const pair: [Look | undefined, Look | undefined] | null =
    a.kind === 'coach'
      ? [lookOf(a.id), master && oyakataLook(master)]
      : a.kind === 'mune'
        ? [lookOf(a.id), guestLook(game.bashoIndex * 4 + week.week)]
        : a.kind === 'spar'
          ? [lookOf(a.a), lookOf(a.b)]
          : null;
  const anyUp = rows.some((r) => r.verdict.kind === 'gradeUp');
  const anyWall = rows.some((r) => r.verdict.kind === 'wall');
  const anyHurt = rows.some((r) => r.verdict.kind === 'hurt');
  useEffect(() => {
    if (stage === 2) return;
    const hit = setTimeout(() => {
      setStage(1);
      if (settings.sound && a.kind !== 'rest') playSound('hit');
    }, AT.hit);
    const stamp = setTimeout(() => {
      setStage(2);
      if (!settings.sound) return;
      if (anyHurt) playSound('fall');
      else if (anyWall) playSound('drum');
      else if (anyUp) playSound('clap');
    }, AT.stamp);
    return () => {
      clearTimeout(hit);
      clearTimeout(stamp);
    };
    // 1回だけ流す（週が変われば作り直される）
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const others = week.gains.length - rows.length;
  return (
    <div
      className="modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="cut-title"
      onClick={onDone}
    >
      <div className={`modal__box cut is-stage${stage}`}>
        <h2 id="cut-title" className="cut__title">
          <span className="cut__weekno">{t('prep.week', { n: week.week })}</span>{' '}
          {t(`prep.cmd.${a.kind}`)}
        </h2>
        <div
          className={`cut__stage ${pair ? 'is-pair' : 'is-crowd'} is-${a.kind}`}
          aria-hidden="true"
        >
          {pair ? (
            <>
              <span className="cut__face cut__face--l">
                {pair[0] && <PixelPortrait look={pair[0]} size={72} />}
              </span>
              <span className="cut__bang">{t('cut.bang')}</span>
              <span className="cut__face cut__face--r">
                {pair[1] && <PixelPortrait look={pair[1]} size={72} />}
              </span>
            </>
          ) : (
            rows.map((r, i) => (
              <span
                key={r.id}
                className="cut__face cut__face--hop"
                style={{ animationDelay: `${i * 90}ms` }}
              >
                {lookOf(r.id) && <PixelPortrait look={lookOf(r.id)!} size={48} />}
                {a.kind === 'rest' && <span className="cut__zzz">Zzz</span>}
              </span>
            ))
          )}
        </div>
        {pair && a.kind !== 'spar' && (
          <p className="cut__vs">{t(a.kind === 'coach' ? 'cut.withMaster' : 'cut.withGuest')}</p>
        )}
        <ul className="cut__rows">
          {rows.map((r) => (
            <CutRow key={r.id} row={r} stage={stage} rest={a.kind === 'rest'} />
          ))}
        </ul>
        {others > 0 && <p className="note">{t('cut.others', { n: others })}</p>}
        <div className="modal__actions">
          <button className="button button--primary" data-dismiss autoFocus onClick={onDone}>
            {t('highlight.next')}
          </button>
        </div>
      </div>
    </div>
  );
}

function CutRow({ row, stage, rest }: { row: EffectRow; stage: Stage; rest: boolean }) {
  const { t } = useI18n();
  return (
    <li className="cut__row">
      <div className="cut__who">
        <strong>{row.name}</strong>
        {stage === 2 && <VerdictStamp v={row.verdict} />}
        {stage === 2 && row.tired && <span className="tag tag--warn">{t('cut.tired')}</span>}
      </div>
      {!rest && (
        <div className="cut__stats">
          {row.stats.map((m) => (
            <StatBar key={m.key} m={m} stage={stage} />
          ))}
        </div>
      )}
      <div className="cut__fatigue">
        <span className="muted">{t('talk.fatigue')}</span>
        <span className="bar" aria-hidden="true">
          <span
            className={`bar__fill cut__fill ${row.fatigue.after >= 70 ? 'bar__fill--warn' : ''}`}
            style={{
              width: `${Math.min(100, stage === 0 ? row.fatigue.before : row.fatigue.after)}%`,
            }}
          />
        </span>
        <span className="abilities__num">
          {Math.round(row.fatigue.after)}
          {stage > 0 && Math.round(row.fatigue.after - row.fatigue.before) !== 0 && (
            <small className={row.fatigue.after > row.fatigue.before ? 'cut__down' : 'cut__up'}>
              {' '}
              {row.fatigue.after > row.fatigue.before ? '+' : '−'}
              {Math.abs(Math.round(row.fatigue.after - row.fatigue.before))}
            </small>
          )}
        </span>
      </div>
    </li>
  );
}

/** 能力1つ: ランクの札と「次のランクまで」のバー。ランクが上がる伸びは、満タンにしてから新しいランクへ */
function StatBar({ m, stage }: { m: StatMove; stage: Stage }) {
  const { t } = useI18n();
  const before = bandOf(m.before);
  const after = bandOf(m.after);
  const crossed = after.grade !== before.grade;
  const grade = stage === 2 ? after.grade : before.grade;
  const width =
    stage === 0
      ? before.pos
      : stage === 1
        ? crossed
          ? m.after > m.before
            ? 1
            : 0
          : after.pos
        : after.pos;
  const delta = signedPoints(m.after - m.before);
  return (
    <div
      className={`cut__stat ${crossed && stage === 2 ? 'is-crossed' : ''} ${delta === '±0' ? 'is-still' : ''}`}
      aria-label={`${t(`style.${m.key}`)} ${after.grade} ${delta}`}
    >
      <span className="cut__label">{t(`style.${m.key}`)}</span>
      <span className={`grade grade--${grade}`}>{grade}</span>
      <span className="bar" aria-hidden="true">
        <span
          className={`bar__fill cut__fill ${stage === 2 && crossed ? 'is-reset' : ''}`}
          style={{ width: `${Math.round(width * 100)}%` }}
        />
      </span>
      <span
        className={`cut__delta ${delta.startsWith('+') ? 'cut__up' : delta === '±0' ? 'muted' : 'cut__down'}`}
      >
        {stage > 0 ? delta : ''}
      </span>
    </div>
  );
}

/** 判子の色の向き: よい・ふつう・伸びなかった・悪い */
const TONE: Record<Verdict['kind'], 'great' | 'good' | 'flat' | 'bad'> = {
  hurt: 'bad',
  wall: 'great',
  gradeUp: 'great',
  grew: 'good',
  aged: 'flat',
  capped: 'flat',
  flat: 'flat',
  fell: 'bad',
  rested: 'good',
  fresh: 'flat',
};

/** 1人の週の結果の判子（判定は weekEffect の verdictOf。どの場合も必ず1つ出す） */
export function VerdictStamp({ v }: { v: Verdict }) {
  const { t } = useI18n();
  const text = (() => {
    switch (v.kind) {
      case 'gradeUp':
        return t('cut.v.gradeUp', { what: t(`style.${v.stat}`), grade: v.grade });
      case 'grew':
        return v.next
          ? t('cut.v.grew', { grade: v.next, n: Math.max(1, points(v.toNext)) })
          : t('cut.v.grewTop', { what: t(`style.${v.stat}`) });
      default:
        return t(`cut.v.${v.kind}`);
    }
  })();
  return <span className={`cut__stamp is-${TONE[v.kind]}`}>{text}</span>;
}
