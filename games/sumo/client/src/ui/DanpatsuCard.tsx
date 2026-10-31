import { useState } from 'react';
import type { BashoReport, GameState } from '@ichimon/sim';
import { useI18n } from '../i18n';
import { bashoName, rankLabel } from '../format';
import { lookOfAlumnus } from '../art/Portraits';
import { ThreePortrait } from '../art/ThreePortrait';
import { useSettings } from '../settings';
import { playSound } from '../sound';
import type { Highlight } from '../highlights';

/** 引退相撲・断髪式の1枚。師匠が止めばさみを入れると髷が落ちる */
export function DanpatsuCard({
  game,
  report,
  h,
  counter,
  last,
  onNext,
}: {
  game: GameState;
  report: BashoReport;
  h: Extract<Highlight, { kind: 'danpatsu' }>;
  counter: string;
  last: boolean;
  onNext: () => void;
}) {
  const { t } = useI18n();
  const { settings } = useSettings();
  const [cut, setCut] = useState(false);
  const a = game.player.alumni.find((x) => x.id === h.alumnusId);
  if (!a) return null;
  const master = game.stables.find((s) => s.id === game.player.stableId)?.name ?? '';
  const look = lookOfAlumnus(a, game.player.stableId);
  const sep = t('highlight.danpatsu.sep');
  // 文と文のあいだ（日本語は詰める）
  const gap = t('highlight.danpatsu.gap');
  const guests = [
    ...h.patrons.map((name) => t('highlight.danpatsu.patron', { name })),
    ...(h.rival ? [t('highlight.danpatsu.rival', { name: h.rival })] : []),
  ];
  const vars = {
    name: a.name,
    rank: a.career.highestRank ? rankLabel(t, a.career.highestRank) : '',
    hasami: h.hasami,
  };
  return (
    <div className="modal" role="dialog" aria-modal="true" aria-labelledby="highlight-title">
      <div className="modal__box highlight">
        <h2 id="highlight-title" className="highlight__title">
          {t(
            h.venue === 'kokugikan'
              ? 'highlight.danpatsu.titleKokugikan'
              : 'highlight.danpatsu.title',
          )}
        </h2>
        <p className="highlight__basho">
          {bashoName(t, report.bashoIndex)}
          {counter}
        </p>
        <div className="highlight__stage">
          <ThreePortrait look={cut ? { ...look, hair: 'short' } : look} variant="full" size={120} />
        </div>
        <p className="highlight__body">
          {t(
            h.venue === 'kokugikan' ? 'highlight.danpatsu.kokugikan' : 'highlight.danpatsu.hotel',
            vars,
          )}
          {guests.length > 0 &&
            `${gap}${t('highlight.danpatsu.guests', { guests: guests.join(sep) })}`}
        </p>
        {cut && (
          <p className="highlight__body" aria-live="polite">
            {t('highlight.danpatsu.cut', { master })}
            {`${gap}${t(a.becameOyakata ? 'highlight.danpatsu.afterOyakata' : 'highlight.danpatsu.afterLeave', { name: a.name })}`}
          </p>
        )}
        <div className="modal__actions">
          {cut ? (
            <button className="button button--primary" onClick={onNext}>
              {last ? t('highlight.toReport') : t('highlight.next')}
            </button>
          ) : (
            <button
              className="button button--primary"
              onClick={() => {
                if (settings.sound) playSound('clap');
                setCut(true);
              }}
            >
              {t('highlight.danpatsu.cutButton')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
