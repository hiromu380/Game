import { useEffect, useMemo, useState } from 'react';
import {
  DOHYOIRI,
  dokiOf,
  giveKojo,
  SEKITORI_MONTHLY,
  ranksOf,
  type BashoReport,
  type Dohyoiri,
  type GameState,
  type KojoWord,
} from '@ichimon/sim';
import { Lore } from './Glossary';
import { Icon } from '../art/Icon';
import { useI18n, type MessageKey } from '../i18n';
import { bashoName, money, rankName } from '../format';
import { RikishiPortrait } from '../art/Portraits';
import { PALETTE } from '../art/palette';
import { useSettings } from '../settings';
import { playSound, type SoundKind } from '../sound';
import { kojoChoices, type Highlight } from '../highlights';
import { escortsOf, yumitoriOf } from '../ceremony';
import { DanpatsuCard } from './DanpatsuCard';
import { recordValue } from './RecordsPanel';
import { RaceCard } from './RacePanel';
import { YearCard } from './YearCard';
import { Confetti } from './Confetti';
import { SkipButton } from './SkipButton';
import { BigBoutCard } from './BigBoutCard';

/** 賜杯（優勝のしるし） */
function Cup() {
  return (
    <svg className="highlight__cup" viewBox="0 0 80 90" aria-hidden="true">
      <path
        d="M14 10 H66 Q66 46 40 54 Q14 46 14 10 Z"
        fill={PALETTE.odo}
        stroke={PALETTE.sumi}
        strokeWidth={3}
      />
      <path d="M14 16 Q2 18 6 30 Q10 40 20 40" fill="none" stroke={PALETTE.sumi} strokeWidth={3} />
      <path
        d="M66 16 Q78 18 74 30 Q70 40 60 40"
        fill="none"
        stroke={PALETTE.sumi}
        strokeWidth={3}
      />
      <rect
        x={34}
        y={54}
        width={12}
        height={14}
        fill={PALETTE.odo}
        stroke={PALETTE.sumi}
        strokeWidth={3}
      />
      <rect x={20} y={68} width={40} height={10} rx={2} fill={PALETTE.sumi} />
    </svg>
  );
}

/** 場所の見せ場（自分の部屋の昇進・優勝・三賞）を1枚ずつ。大関・横綱は昇進伝達式で口上を選ぶ */
/** 新十両の見せ場: 十両で変わること（明け荷は同期生から） */
function SekitoriChanges({ game, id }: { game: GameState; id: number }) {
  const { t, lang } = useI18n();
  const doki = dokiOf(game, id);
  return (
    <div className="highlight__changes">
      <h3>
        <Icon id="ui_tegata" />
        {t('highlight.sekitori.changes')}
      </h3>
      <ul>
        <li>{t('highlight.sekitori.room')}</li>
        <li>{t('highlight.sekitori.pay', { yen: money(t, SEKITORI_MONTHLY.juryo, lang) })}</li>
        <li>{t('highlight.sekitori.tsukebito')}</li>
        <li>{t('highlight.sekitori.hair')}</li>
        <li>{t('highlight.sekitori.dress')}</li>
        <li>
          {doki > 0
            ? t('highlight.sekitori.akeni', { n: doki })
            : t('highlight.sekitori.akeniNone')}
        </li>
      </ul>
    </div>
  );
}

/** 新横綱の見せ場: 綱打ち・土俵入りの太刀持ちと露払い・弓取式 */
function YokozunaChanges({ game, id }: { game: GameState; id: number }) {
  const { t } = useI18n();
  const { tachi, tsuyu } = escortsOf(game, id);
  const name = (x: number | null) =>
    x === null
      ? t('highlight.yokozuna.escortIchimon')
      : (game.rikishi.find((r) => r.id === x)?.name ?? '?');
  const yumi = yumitoriOf(game);
  return (
    <div className="highlight__changes">
      <h3>{t('highlight.yokozuna.changes')}</h3>
      <ul>
        <li>{t('highlight.yokozuna.tsuna')}</li>
        <li>{t('highlight.yokozuna.escort', { tachi: name(tachi), tsuyu: name(tsuyu) })}</li>
        <li>
          {yumi === null
            ? t('highlight.yokozuna.yumitoriNone')
            : t('highlight.yokozuna.yumitori', { name: name(yumi) })}
        </li>
      </ul>
    </div>
  );
}

/** 見せ場に添える、しきたりの1行 */
function loreOf(h: Highlight): string | null {
  if (h.kind === 'promotion')
    return { sekitori: 'sekitori', makuuchi: 'kesho', O: 'dentatsu', Y: 'tsuna' }[h.to];
  if (h.kind === 'sansho') return 'sansho';
  if (h.kind === 'yusho') return 'senshuraku';
  if (h.kind === 'shusse') return 'shusse';
  return null;
}

export function HighlightDialog({
  game,
  report,
  highlights,
  setGame,
  onDone,
}: {
  game: GameState;
  report: BashoReport;
  highlights: Highlight[];
  setGame: (g: GameState) => void;
  onDone: () => void;
}) {
  const { t, lang } = useI18n();
  const { settings } = useSettings();
  const [index, setIndex] = useState(0);
  const [word, setWord] = useState<KojoWord | null>(null);
  const [dohyoiri, setDohyoiri] = useState<Dohyoiri | null>(null);
  const [spoken, setSpoken] = useState(false);
  const ranks = useMemo(() => ranksOf(game.banzuke, game.titles), [game.banzuke, game.titles]);
  const h = highlights[index]!;
  const r =
    h.kind === 'danpatsu' || h.kind === 'year'
      ? undefined
      : game.rikishi.find((x) => x.id === h.id);
  useEffect(() => {
    // 音は見せ場の大きさで分ける（優勝・大関や横綱の昇進 ＞ 新十両・新入幕・記録 ＞ ほか）
    if (settings.sound) playSound(soundOf(highlights[index]!));
  }, [index, settings.sound, highlights]);
  const last = index === highlights.length - 1;
  const next = () => {
    setWord(null);
    setDohyoiri(null);
    setSpoken(false);
    if (last) onDone();
    else setIndex(index + 1);
  };
  const counter = highlights.length > 1 ? ` ${index + 1} / ${highlights.length}` : '';
  if (h.kind === 'danpatsu') {
    return (
      <DanpatsuCard
        key={index}
        game={game}
        report={report}
        h={h}
        counter={counter}
        last={last}
        onNext={next}
        onSkip={onDone}
      />
    );
  }
  if (h.kind === 'year') {
    return (
      <YearCard
        key={index}
        game={game}
        lastIndex={h.lastIndex}
        counter={counter}
        last={last}
        onNext={next}
        onSkip={onDone}
      />
    );
  }
  if (h.kind === 'bigBout') {
    return (
      <BigBoutCard
        key={index}
        game={game}
        report={report}
        h={h}
        counter={counter}
        last={last}
        onNext={next}
        onSkip={onDone}
      />
    );
  }
  if (h.kind === 'race') {
    return (
      <RaceCard
        key={index}
        game={game}
        report={report}
        id={h.id}
        counter={counter}
        last={last}
        onNext={next}
        onSkip={onDone}
      />
    );
  }
  if (!r) return null;
  const rank = ranks.get(r.id) ?? null;
  const ceremony = h.kind === 'promotion' && (h.to === 'O' || h.to === 'Y');

  let title: string;
  let body: string;
  if (h.kind === 'promotion') {
    title = t(`highlight.promotion.${h.to}.title` as MessageKey);
    body = t(`highlight.promotion.${h.to}.body` as MessageKey, {
      name: r.name,
      rank: rank ? rankName(t, rank) : '',
    });
  } else if (h.kind === 'yusho') {
    title = t('highlight.yusho.title', {
      division: t(`rank.division.${h.division}` as MessageKey),
    });
    body = t(h.division === 'makuuchi' ? 'highlight.yusho.makuuchi' : 'highlight.yusho.body', {
      name: r.name,
      wins: h.wins,
      losses: h.losses,
    });
  } else if (h.kind === 'shusse') {
    title = t('highlight.shusse.title');
    // 化粧まわしは部屋のいちばん上の関取から、いなければ師匠から借りる
    const ranksNow = ranksOf(game.banzuke, game.titles);
    const senior = game.banzuke.find((id) => {
      const x = game.rikishi.find((y) => y.id === id);
      const k = ranksNow.get(id);
      return (
        x?.stableId === game.player.stableId &&
        k &&
        (k.division === 'makuuchi' || k.division === 'juryo')
      );
    });
    const seniorName =
      senior === undefined ? null : game.rikishi.find((y) => y.id === senior)!.name;
    body = `${t('highlight.shusse.body', {
      names: h.ids.map((id) => game.rikishi.find((y) => y.id === id)?.name ?? '?').join('・'),
      lender: seniorName
        ? t('highlight.shusse.sekitori', { name: seniorName })
        : t('highlight.shusse.master'),
    })}${t('highlight.shusse.teuchi')}`;
  } else if (h.kind === 'record') {
    title = t('highlight.record.title');
    body = t('highlight.record.body', {
      name: r.name,
      record: t(`records.key.${h.news.key}` as MessageKey),
      value: recordValue(t, lang, h.news.key, h.news.holder.value),
      prevName: h.news.previous.name,
      prevValue: recordValue(t, lang, h.news.key, h.news.previous.value),
    });
  } else {
    title = t('highlight.sansho.title');
    body = t('highlight.sansho.body', {
      name: r.name,
      prizes: h.prizes.map((p) => t(`sansho.${p}`)).join('・'),
    });
  }

  const kojoRank = h.kind === 'promotion' && h.to === 'Y' ? t('rank.title.Y') : t('rank.title.O');
  const ready = word !== null && (h.kind !== 'promotion' || h.to !== 'Y' || dohyoiri !== null);

  return (
    <div className="modal" role="dialog" aria-modal="true" aria-labelledby="highlight-title">
      <div className="modal__box highlight">
        <h2 id="highlight-title" className="highlight__title">
          {title}
        </h2>
        <p className="highlight__basho">
          {bashoName(t, report.bashoIndex)}
          {counter}
        </p>
        <div className="highlight__stage">
          {celebrate(h) && <Confetti key={index} />}
          {h.kind === 'yusho' && <Cup />}
          <RikishiPortrait r={r} rank={rank} variant="full" size={120} />
        </div>
        <p className="highlight__body">{body}</p>
        {h.kind === 'promotion' && h.to === 'sekitori' && <SekitoriChanges game={game} id={r.id} />}
        {h.kind === 'promotion' && h.to === 'Y' && <YokozunaChanges game={game} id={r.id} />}
        {loreOf(h) && <Lore id={loreOf(h)!} />}

        {ceremony && !spoken && (
          <div className="highlight__ceremony">
            <p>{t('highlight.ceremony.lead', { rank: kojoRank })}</p>
            <div className="segmented" role="group" aria-label={t('highlight.ceremony.word')}>
              {kojoChoices(r.id).map((w) => (
                <button
                  key={w}
                  className={`segmented__btn ${word === w ? 'is-active' : ''}`}
                  aria-pressed={word === w}
                  onClick={() => setWord(w)}
                >
                  {t(`kojo.${w}` as MessageKey)}
                </button>
              ))}
            </div>
            {h.kind === 'promotion' && h.to === 'Y' && (
              <>
                <p>{t('highlight.ceremony.dohyoiri')}</p>
                <div
                  className="segmented"
                  role="group"
                  aria-label={t('highlight.ceremony.dohyoiri')}
                >
                  {DOHYOIRI.map((d) => (
                    <button
                      key={d}
                      className={`segmented__btn ${dohyoiri === d ? 'is-active' : ''}`}
                      aria-pressed={dohyoiri === d}
                      onClick={() => setDohyoiri(d)}
                    >
                      {t(`dohyoiri.${d}.name` as MessageKey)}
                    </button>
                  ))}
                </div>
                {dohyoiri && (
                  <p className="muted">{t(`dohyoiri.${dohyoiri}.desc` as MessageKey)}</p>
                )}
              </>
            )}
          </div>
        )}
        {ceremony && spoken && word && (
          <blockquote className="highlight__kojo">
            {t('highlight.ceremony.kojo', {
              rank: kojoRank,
              word: t(`kojo.${word}` as MessageKey),
            })}
          </blockquote>
        )}

        <div className="modal__actions">
          {ceremony && !spoken ? (
            <>
              <button className="button" onClick={next}>
                {t('highlight.ceremony.skip')}
              </button>
              <button
                className="button button--primary"
                disabled={!ready}
                onClick={() => {
                  setGame(giveKojo(game, r.id, word!, dohyoiri ?? undefined));
                  setSpoken(true);
                }}
              >
                {t('highlight.ceremony.speak')}
              </button>
            </>
          ) : (
            <>
              {!last && <SkipButton onSkip={onDone} />}
              <button className="button button--primary" onClick={next}>
                {last ? t('highlight.toReport') : t('highlight.next')}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/** 見せ場の大きさに合わせた音 */
function soundOf(h: Highlight): SoundKind {
  if (
    (h.kind === 'yusho' && h.division === 'makuuchi') ||
    (h.kind === 'promotion' && (h.to === 'O' || h.to === 'Y'))
  )
    return 'roll';
  if (h.kind === 'yusho' || h.kind === 'promotion' || h.kind === 'record') return 'drumCheer';
  return 'drum';
}

/** 紙吹雪を出す見せ場（幕内優勝・大関や横綱の昇進・新十両） */
function celebrate(h: Highlight): boolean {
  return soundOf(h) === 'roll' || (h.kind === 'promotion' && h.to === 'sekitori');
}
