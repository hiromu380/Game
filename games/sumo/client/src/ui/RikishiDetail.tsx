import {
  toshiyoriProgress,
  tokuiWaza,
  type Abilities,
  type TraitId,
  type Career,
  type Rank,
  type TrackEntry,
} from '@ichimon/sim';
import { useI18n, type MessageKey } from '../i18n';
import { money, rankLabel } from '../format';
import { Figure } from '../art/Figure';
import type { Look } from '../art/look';
import { RankChart } from './RankChart';

export interface DetailSubject {
  name: string;
  look: Look;
  rank: Rank | null;
  /** 現役なら年齢・体格・能力 */
  age: number;
  height?: number;
  weight?: number;
  abilities?: Abilities;
  foreign: boolean;
  career: Career;
  track: readonly TrackEntry[];
  /** 引退した力士なら、引退のときの説明 */
  retiredNote?: string;
  /** 個性（まだ分からなければ null。引退した力士は持たない） */
  traits?: readonly TraitId[] | null;
}

/** 力士の詳細: 経歴・番付の推移・稼いだお金・年寄名跡の資格まで */
export function RikishiDetail({
  subject: s,
  onClose,
}: {
  subject: DetailSubject;
  onClose: () => void;
}) {
  const { t, lang } = useI18n();
  const c = s.career;
  const progress = toshiyoriProgress(s);
  const eligible =
    progress !== null &&
    (progress.sanyaku === 0 || progress.makuuchi === 0 || progress.sekitori === 0);
  return (
    <div className="modal" role="dialog" aria-modal="true" aria-labelledby="detail-title">
      <div className="modal__box modal__box--wide">
        <h2 id="detail-title">{s.name}</h2>
        <div className="detail">
          <div className="detail__figure">
            <Figure look={s.look} size={120} />
          </div>
          <dl className="detail__facts">
            <div>
              <dt>{t('detail.rank')}</dt>
              <dd>{s.retiredNote ?? rankLabel(t, s.rank)}</dd>
            </div>
            {s.traits !== undefined && (
              <div>
                <dt>{t('detail.traits')}</dt>
                <dd>
                  {s.traits === null
                    ? t('traits.unknown')
                    : s.traits.length === 0
                      ? t('traits.none')
                      : s.traits.map((tr) => (
                          <span key={tr} className="block">
                            <strong>{t(`trait.${tr}.name` as MessageKey)}</strong>{' '}
                            <span className="muted">{t(`trait.${tr}.desc` as MessageKey)}</span>
                          </span>
                        ))}
                </dd>
              </div>
            )}
            <div>
              <dt>{t('detail.tokui')}</dt>
              <dd>
                {tokuiWaza(c) ? t(`kimarite.${tokuiWaza(c)}` as MessageKey) : t('detail.tokuiNone')}
              </dd>
            </div>
            <div>
              <dt>{t('detail.highest')}</dt>
              <dd>{c.highestRank ? rankLabel(t, c.highestRank) : '—'}</dd>
            </div>
            <div>
              <dt>{t('detail.body')}</dt>
              <dd>
                {s.height && s.weight
                  ? t('rikishi.meta', {
                      age: s.age,
                      height: s.height,
                      weight: Math.round(s.weight),
                    })
                  : t('detail.age', { age: s.age })}
              </dd>
            </div>
            <div>
              <dt>{t('detail.record')}</dt>
              <dd>
                {t('detail.recordValue', {
                  basho: c.basho,
                  wins: c.wins,
                  losses: c.losses,
                  absences: c.absences,
                })}
              </dd>
            </div>
            <div>
              <dt>{t('detail.tenure')}</dt>
              <dd>
                {t('detail.tenureValue', {
                  makuuchi: c.makuuchiBasho,
                  sekitori: c.sekitoriBasho,
                  sanyaku: c.sanyakuBasho,
                })}
              </dd>
            </div>
            <div>
              <dt>{t('detail.honors')}</dt>
              <dd>
                {t('detail.honorsValue', {
                  yusho: c.makuuchiYusho,
                  other: c.otherYusho,
                  shukun: c.sansho.shukun,
                  kanto: c.sansho.kanto,
                  gino: c.sansho.gino,
                  kinboshi: c.kinboshi,
                })}
              </dd>
            </div>
            <div>
              <dt>{t('detail.money')}</dt>
              <dd>
                {t('detail.moneyValue', {
                  earned: money(t, c.earnings, lang),
                  mochikyukin: c.mochikyukinHalf / 2,
                })}
              </dd>
            </div>
            <div>
              <dt>{t('detail.toshiyori')}</dt>
              <dd>
                {progress === null
                  ? t('detail.toshiyoriForeign')
                  : eligible
                    ? t('detail.toshiyoriOk')
                    : t('detail.toshiyoriLeft', progress)}
              </dd>
            </div>
          </dl>
        </div>
        {s.abilities && (
          <p className="detail__abilities">
            {t('detail.abilities', {
              oshi: Math.round(s.abilities.oshi),
              yotsu: Math.round(s.abilities.yotsu),
              waza: Math.round(s.abilities.waza),
            })}
          </p>
        )}
        <h3>{t('detail.chart')}</h3>
        <RankChart track={s.track} />
        <div className="modal__actions">
          <button className="button button--primary" onClick={onClose} autoFocus>
            {t('common.close')}
          </button>
        </div>
      </div>
    </div>
  );
}
