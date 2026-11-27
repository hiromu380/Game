import {
  atWall,
  isSekitori,
  styleOf,
  tokuiWaza,
  traitsOf,
  TRAITS,
  type TraitId,
  type Intensity,
  type Policy,
  type Rank,
  type Rikishi,
  type Treatment,
} from '@ichimon/sim';
import { IntensityPicker } from './RikishiTalk';
import { partName, woundName } from '../injury';
import { PrepTrend } from './PrepTrend';
import { useI18n, type MessageKey } from '../i18n';
import { RikishiPortrait } from '../art/Portraits';
import { points } from '../points';
import { gradeOf, overallOf } from '../grade';
import { titlesOf } from '../titles';
import { TargetLine } from './TargetLine';
import type { TargetInfo } from '../targets';
import { rankLabel, recordLabel } from '../format';

const POLICIES: Policy[] = ['oshi', 'yotsu', 'waza', 'body', 'rest'];

/** 弟子のカード: 顔・能力・状態・目標と、稽古の方針・量・けがの扱い */
export function RikishiCard({
  r,
  rank,
  target,
  sekitoriYen,
  onPolicy,
  onIntensity,
  onPlayHurt,
  askTreatment,
  onTreatment,
  onDetail,
  prepNow = null,
}: {
  r: Rikishi;
  rank: Rank | null;
  target: TargetInfo | null;
  sekitoriYen: number | null;
  onPolicy: (p: Policy) => void;
  onIntensity: (i: Intensity) => void;
  onPlayHurt: (play: boolean) => void;
  askTreatment: boolean;
  onTreatment: (t: Treatment) => void;
  onDetail: () => void;
  /** 今の場所前に稽古で伸びた量（場所前の週が始まっていなければ null） */
  prepNow?: number | null;
}) {
  const { t } = useI18n();
  const last = r.recent[0];
  return (
    <li className="card">
      <button
        className="card__portrait"
        onClick={onDetail}
        aria-label={t('detail.open', { name: r.name })}
      >
        <RikishiPortrait r={r} rank={rank} size={88} />
      </button>
      <div className="card__head">
        <span className="card__rank">{rankLabel(t, rank)}</span>
        <strong className="card__name">{r.name}</strong>
        {titlesOf(r, rank !== null && isSekitori(rank)).map((x) => (
          <span key={x.id} className="tag tag--gold title-tag">
            {t(`title.${x.id}` as MessageKey, {
              n: x.n ?? 0,
              kimarite: x.kimarite ? t(`kimarite.${x.kimarite}` as MessageKey) : '',
            })}
          </span>
        ))}
        <span className="card__meta">
          {t('rikishi.meta', { age: r.age, height: r.height, weight: Math.round(r.weight) })}
        </span>
        <TargetLine info={target} sekitoriYen={sekitoriYen} />
      </div>
      <div className="card__body">
        <dl className="abilities">
          {(['oshi', 'yotsu', 'waza'] as const).map((k) => (
            <div key={k} className="abilities__item">
              <dt>{t(`style.${k}`)}</dt>
              <dd>
                <span className="bar" aria-hidden="true">
                  <span
                    className="bar__fill"
                    style={{ width: `${Math.min(100, r.abilities[k])}%` }}
                  />
                </span>
                <span className={`grade grade--${gradeOf(r.abilities[k])}`}>
                  {gradeOf(r.abilities[k])}
                </span>
                <span className="abilities__num">{points(r.abilities[k])}</span>
              </dd>
            </div>
          ))}
          <div className="abilities__item abilities__item--overall">
            <dt>{t('grade.overall')}</dt>
            <dd>
              <span className={`grade grade--${gradeOf(overallOf(r.abilities))}`}>
                {gradeOf(overallOf(r.abilities))}
              </span>
              <span className="abilities__num">{points(overallOf(r.abilities))}</span>
            </dd>
          </div>
        </dl>
        <div className="card__status">
          <span>{t('rikishi.style', { style: t(`style.${styleOf(r.abilities)}`) })}</span>
          <span>{t('rikishi.fatigue', { value: Math.round(r.fatigue) })}</span>
          {atWall(r) && (
            <span className="tag tag--wall" title={t('prep.wallDesc')}>
              {t('prep.wall')}
            </span>
          )}
          {r.injury > 0 && (
            <span className="tag tag--warn">
              {r.wound
                ? t('rikishi.injuryPart', { part: woundName(t, r.wound), basho: r.injury })
                : t('rikishi.injury', { basho: r.injury })}
              {r.wound?.treatment === 'surgery' && t('rikishi.afterSurgery')}
            </span>
          )}
          {(r.oldInjuries ?? []).length > 0 && (
            <span className="tag" title={t('rikishi.oldInjuryDesc')}>
              {t('rikishi.oldInjury', {
                parts: r.oldInjuries!.map((p) => partName(t, p)).join(t('rikishi.oldInjurySep')),
              })}
            </span>
          )}
          {last && <span>{t('rikishi.last', { record: recordLabel(t, last) })}</span>}
          {r.kesho && (
            <span>
              {t('card.kesho')}: {t(`card.kesho.${r.kesho.from}`, { by: r.kesho.by ?? '' })}
            </span>
          )}
          {(knownTraits(r) ?? []).map((tr) => (
            <span key={tr} className="tag tag--trait" title={t(`trait.${tr}.desc` as MessageKey)}>
              ◆{t(`trait.${tr}.name` as MessageKey)}
            </span>
          ))}
          {tokuiWaza(r.career) && (
            <span>
              {t('rikishi.tokui', { kimarite: t(`kimarite.${tokuiWaza(r.career)}` as MessageKey) })}
            </span>
          )}
        </div>
        <PrepTrend track={r.track} now={prepNow} />
      </div>
      {askTreatment && r.wound && (
        <div className="hurt" role="group" aria-label={t('treatment.label')}>
          <span className="hurt__note">
            {t('treatment.note', { part: woundName(t, r.wound), total: r.wound.total })}
          </span>
          <button className="policy__btn" onClick={() => onTreatment('surgery')}>
            {t('treatment.surgery')}
          </button>
          <button className="policy__btn" onClick={() => onTreatment('rest')}>
            {t('treatment.rest')}
          </button>
        </div>
      )}
      {r.injury > 0 && !askTreatment && r.wound?.treatment !== 'surgery' && (
        <div className="hurt" role="group" aria-label={t('hurt.label')}>
          <span className="hurt__note">{t('hurt.note')}</span>
          <button
            className={`policy__btn ${!r.playHurt ? 'is-selected' : ''}`}
            aria-pressed={!r.playHurt}
            onClick={() => onPlayHurt(false)}
          >
            {t('hurt.rest')}
          </button>
          <button
            className={`policy__btn ${r.playHurt ? 'is-selected' : ''}`}
            aria-pressed={r.playHurt}
            onClick={() => onPlayHurt(true)}
          >
            {t('hurt.play')}
          </button>
        </div>
      )}
      <div className="policy" role="group" aria-label={t('policy.label')}>
        <span className="policy__label">{t('policy.label')}</span>
        {POLICIES.map((p) => (
          <button
            key={p}
            className={`policy__btn ${r.policy === p ? 'is-selected' : ''}`}
            aria-pressed={r.policy === p}
            onClick={() => onPolicy(p)}
          >
            {t(`policy.${p}`)}
          </button>
        ))}
      </div>
      <IntensityPicker r={r} onChange={onIntensity} />
    </li>
  );
}

/** 自分の弟子の個性（番付に載って何場所かたつと分かってくる。それまでは null） */
export function knownTraits(r: Rikishi): readonly TraitId[] | null {
  return r.career.basho >= TRAITS.knownAfterBasho ? traitsOf(r) : null;
}
