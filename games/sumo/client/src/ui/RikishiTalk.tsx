import {
  setIntensity,
  setPolicy,
  type GameState,
  type Intensity,
  type Policy,
  type Rank,
  type Rikishi,
} from '@ichimon/sim';
import { useI18n, type MessageKey } from '../i18n';
import { rankLabel } from '../format';
import { RikishiPortrait } from '../art/Portraits';
import { woundName } from '../injury';
import { voiceOf } from '../voice';

const POLICIES: Policy[] = ['oshi', 'yotsu', 'waza', 'body', 'rest'];
const INTENSITIES: Intensity[] = ['light', 'normal', 'hard'];

/** 稽古の量を選ぶ（軽め・ふつう・猛稽古）。休養のときは効かないので選べない */
export function IntensityPicker({ r, onChange }: { r: Rikishi; onChange: (i: Intensity) => void }) {
  const { t } = useI18n();
  const now = r.intensity ?? 'normal';
  return (
    <div className="policy policy--intensity" role="group" aria-label={t('intensity.label')}>
      <span className="policy__label">{t('intensity.label')}</span>
      {INTENSITIES.map((i) => (
        <button
          key={i}
          className={`policy__btn ${now === i ? 'is-selected' : ''} ${i === 'hard' ? 'policy__btn--hard' : ''}`}
          aria-pressed={now === i}
          disabled={r.policy === 'rest' || r.injury > 0}
          title={t(`intensity.desc.${i}`)}
          onClick={() => onChange(i)}
        >
          {t(`intensity.${i}`)}
        </button>
      ))}
    </div>
  );
}

/** 箱庭で押した弟子に話しかける: 一言・疲れとけが・稽古の方針と量 */
export function RikishiTalk({
  game,
  r,
  rank,
  setGame,
  onDetail,
  onClose,
}: {
  game: GameState;
  r: Rikishi;
  rank: Rank | null;
  setGame: (g: GameState) => void;
  onDetail?: (id: number) => void;
  onClose: () => void;
}) {
  const { t } = useI18n();
  return (
    <div className="talk" role="group" aria-label={t('talk.title', { name: r.name })}>
      <div className="talk__who">
        <RikishiPortrait r={r} rank={rank} size={64} />
        <div className="talk__main">
          <div className="talk__name">
            <strong>{r.name}</strong>
            <span className="muted">
              {rankLabel(t, rank)}・
              {t('rikishi.meta', { age: r.age, height: r.height, weight: Math.round(r.weight) })}
            </span>
          </div>
          <blockquote className="talk__voice">{t(voiceOf(game, r, rank) as MessageKey)}</blockquote>
        </div>
      </div>
      <div className="talk__state">
        <span className="talk__meter" aria-label={`${t('talk.fatigue')} ${Math.round(r.fatigue)}`}>
          <span className="muted">{t('talk.fatigue')}</span>
          <span className="bar" aria-hidden="true">
            <span
              className={`bar__fill ${r.fatigue >= 70 ? 'bar__fill--warn' : ''}`}
              style={{ width: `${Math.min(100, r.fatigue)}%` }}
            />
          </span>
          <span className="abilities__num">{Math.round(r.fatigue)}</span>
        </span>
        {r.injury > 0 && (
          <span className="tag tag--warn">
            {r.wound
              ? t('rikishi.injuryPart', { part: woundName(t, r.wound), basho: r.injury })
              : t('rikishi.injury', { basho: r.injury })}
          </span>
        )}
      </div>
      <div className="policy" role="group" aria-label={t('policy.label')}>
        <span className="policy__label">{t('policy.label')}</span>
        {POLICIES.map((p) => (
          <button
            key={p}
            className={`policy__btn ${r.policy === p ? 'is-selected' : ''}`}
            aria-pressed={r.policy === p}
            onClick={() => setGame(setPolicy(game, r.id, p))}
          >
            {t(`policy.${p}`)}
          </button>
        ))}
      </div>
      <IntensityPicker r={r} onChange={(i) => setGame(setIntensity(game, r.id, i))} />
      <p className="note">{t(`intensity.desc.${r.intensity ?? 'normal'}`)}</p>
      <div className="talk__actions">
        {onDetail && (
          <button className="button" onClick={() => onDetail(r.id)}>
            {t('talk.detail')}
          </button>
        )}
        <button className="button" onClick={onClose}>
          {t('talk.close')}
        </button>
      </div>
    </div>
  );
}
