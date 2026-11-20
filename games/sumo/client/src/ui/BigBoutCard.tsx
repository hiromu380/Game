import { useMemo, useState } from 'react';
import { ranksOf, type BashoReport, type GameState } from '@ichimon/sim';
import { useI18n, type MessageKey } from '../i18n';
import { bashoName, dayLabel } from '../format';
import { RikishiPortrait } from '../art/Portraits';
import { useSettings } from '../settings';
import { playSound } from '../sound';
import type { Highlight } from '../highlights';
import { BoutViewer } from './BoutViewer';
import { useNames } from './RacePanel';

/** 場所の見せ場: 勝ち越しをかけた最後の一番。取組を見てから（または飛ばして）結果を明かす */
export function BigBoutCard({
  game,
  report,
  h,
  counter,
  last,
  nextLabel,
  onNext,
}: {
  game: GameState;
  report: BashoReport;
  h: Extract<Highlight, { kind: 'bigBout' }>;
  counter: string;
  last: boolean;
  /** 「次へ」の代わりの字（本場所の途中で見せるとき） */
  nextLabel?: string;
  onNext: () => void;
}) {
  const { t } = useI18n();
  const { settings } = useSettings();
  const [phase, setPhase] = useState<'before' | 'watching' | 'after'>('before');
  const ranks = useMemo(() => ranksOf(game.banzuke, game.titles), [game.banzuke, game.titles]);
  const n = useNames(game, report);
  const r = game.rikishi.find((x) => x.id === h.id);
  const opponent = h.bout.eastId === h.id ? h.bout.westId : h.bout.eastId;
  const won = h.bout.winnerId === h.id;
  const reveal = () => {
    setPhase('after');
    if (settings.sound) playSound(won ? 'clap' : 'fall');
  };
  if (phase === 'watching') {
    return <BoutViewer game={game} bout={h.bout} sound={settings.sound} onClose={reveal} />;
  }
  const vars = {
    name: n.name(h.id),
    opponent: n.name(opponent),
    stable: n.stable(opponent),
    kimarite: t(`kimarite.${h.bout.kimarite}` as MessageKey),
  };
  return (
    <div className="modal" role="dialog" aria-modal="true" aria-labelledby="highlight-title">
      <div className="modal__box highlight">
        <h2 id="highlight-title" className="highlight__title">
          {t('bigBout.title')}
        </h2>
        <p className="highlight__basho">
          {bashoName(t, report.bashoIndex)}
          {counter}
        </p>
        {r && (
          <div className="highlight__stage">
            <RikishiPortrait r={r} rank={ranks.get(r.id) ?? null} size={120} />
          </div>
        )}
        {phase === 'before' ? (
          <p className="highlight__body">
            {t('bigBout.stakes', {
              ...vars,
              wins: h.wins,
              losses: h.losses,
              day: dayLabel(t, h.bout.day),
            })}
            {h.bout.tactic && h.bout.tacticBy === h.id && (
              <>{t('bigBout.tactic', { tactic: t(`tactic.${h.bout.tactic}`) })}</>
            )}
          </p>
        ) : (
          <p className="highlight__body" role="status">
            <span className={`tag ${won ? '' : 'tag--warn'}`}>
              {t(won ? 'bigBout.wonTag' : 'bigBout.lostTag')}
            </span>{' '}
            {t(won ? 'bigBout.won' : 'bigBout.lost', {
              ...vars,
              wins: h.wins + (won ? 1 : 0),
              losses: h.losses + (won ? 0 : 1),
            })}
          </p>
        )}
        <div className="modal__actions">
          {phase === 'before' ? (
            <>
              <button className="button" onClick={reveal}>
                {t('bigBout.skip')}
              </button>
              <button className="button button--primary" onClick={() => setPhase('watching')}>
                {t('bigBout.watch')}
              </button>
            </>
          ) : (
            <button className="button button--primary" onClick={onNext}>
              {nextLabel ?? (last ? t('highlight.toReport') : t('highlight.next'))}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
