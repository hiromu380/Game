import { useMemo } from 'react';
import type { GameState } from '@ichimon/sim';
import { useI18n, type MessageKey } from '../i18n';
import { money } from '../format';
import { yearSummary } from '../yearSummary';
import { achievedOf, ACHIEVEMENTS, nearAchievements, tierOf } from '../achievements';
import { goalsOf, nextGoal } from '../goals';
import { SkipButton } from './SkipButton';
import { useCountUp } from './CountUp';

/** 年の終わりの見せ場: 1年のふりかえり（数字を札で並べ、部屋の格で締める） */
export function YearCard({
  game,
  lastIndex,
  counter,
  last,
  onNext,
  onSkip,
}: {
  game: GameState;
  lastIndex: number;
  counter: string;
  last: boolean;
  onNext: () => void;
  /** 残りの見せ場をまとめて飛ばす（なければ出さない） */
  onSkip?: () => void;
}) {
  const { t, lang } = useI18n();
  // 数え上げで描き直すたびに数え直さない
  const y = useMemo(() => yearSummary(game, lastIndex), [game, lastIndex]);
  const net = useCountUp(y.net);
  const done = useMemo(() => achievedOf(game).length, [game]);
  const next = useMemo(() => nextGoal(goalsOf(game)), [game]);
  const near = useMemo(() => nearAchievements(game, 1)[0] ?? null, [game]);
  const signedNum = (n: number) => (n > 0 ? `▲${n}` : n < 0 ? `▼${-n}` : '±0');
  return (
    <div className="modal" role="dialog" aria-modal="true" aria-labelledby="highlight-title">
      <div className="modal__box highlight">
        <h2 id="highlight-title" className="highlight__title">
          {t('year.title', { year: y.year })}
        </h2>
        <p className="highlight__basho">{counter}</p>
        <dl className="tiles">
          <div className="tile">
            <dt>{t('year.record')}</dt>
            <dd>{t('year.winsLosses', { wins: y.wins, losses: y.losses })}</dd>
          </div>
          <div className="tile">
            <dt>{t('year.kachikoshi')}</dt>
            <dd>{t('year.ofTotal', { n: y.kachikoshi, total: y.appearances })}</dd>
          </div>
          <div className="tile">
            <dt>{t('year.net')}</dt>
            <dd className={y.net < 0 ? 'is-minus' : ''}>{money(t, net, lang)}</dd>
          </div>
          {y.place && (
            <div className="tile">
              <dt>{t('year.place')}</dt>
              <dd>
                {t('report.tile.place', { place: y.place.to })}
                {y.place.from !== y.place.to && (
                  <span
                    className={`rewards__chip is-${y.place.from > y.place.to ? 'good' : 'bad'}`}
                  >
                    {signedNum(y.place.from - y.place.to)}
                  </span>
                )}
              </dd>
            </div>
          )}
        </dl>
        {y.mvp && (
          <p className="headline year__mvp">
            <span className="headline__big">{t('year.mvp', { name: y.mvp.name })}</span>
            <span className="year__mvpRecord">
              {t('year.winsLosses', { wins: y.mvp.wins, losses: y.mvp.losses })}
            </span>
          </p>
        )}
        <ul className="plain-list year__list">
          <li>
            {t('year.events', { promotions: y.promotions, yusho: y.yusho, joined: y.joined })}
          </li>
          {y.prestige !== null && (
            <li>{t('year.prestige', { delta: signedNum(Math.round(y.prestige * 10) / 10) })}</li>
          )}
          <li>
            {t('year.standing', {
              tier: t(`achv.tierName.${tierOf(done)}`),
              done,
              total: ACHIEVEMENTS.length,
            })}
          </li>
        </ul>
        {/* 来年の目標（目の前に吊るす）: 部屋の歩みの次の節目と、もうすぐ届く実績 */}
        {(next || near) && (
          <p className="callout year__next">
            <strong>{t('year.next')}</strong> {next && t(`goals.${next.id}.name` as MessageKey)}
            {next && near && '・'}
            {near &&
              t('achv.nearItem', {
                name: t(`achv.${near.id}.name` as MessageKey),
                now: near.now,
                of: near.of,
              })}
          </p>
        )}
        <div className="modal__actions">
          {onSkip && !last && <SkipButton onSkip={onSkip} />}
          <button className="button button--primary" onClick={onNext}>
            {last ? t('highlight.toReport') : t('highlight.next')}
          </button>
        </div>
      </div>
    </div>
  );
}
