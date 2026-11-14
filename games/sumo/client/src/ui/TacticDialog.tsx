import { useMemo, useState } from 'react';
import { ranksOf, styleOf, TACTIC, TACTICS, type GameState, type Tactic } from '@ichimon/sim';
import { useI18n } from '../i18n';
import { dayLabel, rankLabel } from '../format';
import type { Highlight } from '../highlights';

type Choice = Tactic | 'normal';
const CHOICES: Choice[] = ['normal', ...TACTICS];

/**
 * 大一番の作戦: 勝ち越しをかけた最後の一番の前に止まり、相手の型を見て、立ち合いの作戦を授ける。
 * 作戦はその一番だけに効く（場所はここまでと同じ星のまま続く）
 */
export function TacticDialog({
  game,
  bouts,
  onGo,
}: {
  game: GameState;
  bouts: Extract<Highlight, { kind: 'bigBout' }>[];
  onGo: (tactic: Record<number, Tactic>) => void;
}) {
  const { t } = useI18n();
  const [tactic, setTactic] = useState<Record<number, Tactic>>({});
  const [pointed, setPointed] = useState<{ id: number; c: Choice } | null>(null);
  const ranks = useMemo(() => ranksOf(game.banzuke, game.titles), [game.banzuke, game.titles]);
  const byId = new Map(game.rikishi.map((r) => [r.id, r]));
  const choose = (id: number, c: Choice) => {
    const next = { ...tactic };
    if (c === 'normal') delete next[id];
    else next[id] = c;
    setTactic(next);
  };
  // 指している（なければ最後に選んだ）作戦の1行の説明。自分の型に合わなければ添える
  const help = (() => {
    const p = pointed;
    if (!p) return t('tactic.desc.none');
    const own = byId.get(p.id);
    const off =
      p.c !== 'normal' && own !== undefined && styleOf(own.abilities) !== TACTIC[p.c].fits;
    return `${t(`tactic.desc.${p.c}`)}${off ? t('tactic.offStyle', { name: own.name }) : ''}`;
  })();
  return (
    <div className="modal" role="dialog" aria-modal="true" aria-labelledby="tactic-title">
      <div className="modal__box mid tactic">
        <h2 id="tactic-title">{t('tactic.title')}</h2>
        <p className="note">{t('tactic.lead')}</p>
        <ul className="mid__list">
          {bouts.map((h) => {
            const r = byId.get(h.id);
            const oppId = h.bout.eastId === h.id ? h.bout.westId : h.bout.eastId;
            const opp = byId.get(oppId);
            return (
              <li key={h.id} className="mid__row tactic__row">
                <span className="mid__rank">{rankLabel(t, ranks.get(h.id) ?? null)}</span>
                <strong>{r?.name ?? '?'}</strong>
                <span className="mid__record">
                  {t('race.record', { wins: h.wins, losses: h.losses })}
                </span>
                {r && <span className="tag">{t(`style.${styleOf(r.abilities)}`)}</span>}
                <span className="tactic__vs">
                  {t('tactic.vs', {
                    day: dayLabel(t, h.bout.day),
                    rank: rankLabel(t, ranks.get(oppId) ?? null),
                    name: opp?.name ?? '?',
                  })}
                  {opp && (
                    <span className="tag tag--wall">{t(`style.${styleOf(opp.abilities)}`)}</span>
                  )}
                </span>
                <div
                  className="segmented mid__stance"
                  role="group"
                  aria-label={t('tactic.group', { name: r?.name ?? '?' })}
                >
                  {CHOICES.map((c) => {
                    const now = (tactic[h.id] ?? 'normal') === c;
                    return (
                      <button
                        key={c}
                        className={`segmented__btn ${now ? 'is-active' : ''}`}
                        aria-pressed={now}
                        onPointerEnter={() => setPointed({ id: h.id, c })}
                        onFocus={() => setPointed({ id: h.id, c })}
                        onClick={() => {
                          choose(h.id, c);
                          setPointed({ id: h.id, c });
                        }}
                      >
                        {t(`tactic.${c}`)}
                      </button>
                    );
                  })}
                </div>
              </li>
            );
          })}
        </ul>
        <p className="prep__help" aria-live="polite">
          {help}
        </p>
        <div className="modal__actions">
          <button className="button button--primary" onClick={() => onGo(tactic)}>
            {t('tactic.go')}
          </button>
        </div>
      </div>
    </div>
  );
}
