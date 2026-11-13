import type { TrainingResult } from '@ichimon/sim';
import { useI18n } from '../i18n';
import { signedPoints } from '../points';

/** 符号つきの数（小数1桁。動いていなければ ±0） */
export function signed(n: number): string {
  const v = Math.round(n * 10) / 10;
  if (v === 0) return '±0';
  return (v > 0 ? '+' : '−') + Math.abs(v).toFixed(1);
}

/** 稽古の成果: 場所の後の稽古で、能力・体重・疲れがどれだけ動いたか（伸びた順） */
export function TrainingSection({
  results,
  nameOf,
}: {
  results: TrainingResult[];
  nameOf: (id: number) => string;
}) {
  const { t } = useI18n();
  const sorted = [...results].sort(
    (a, b) => b.oshi + b.yotsu + b.waza - (a.oshi + a.yotsu + a.waza) || a.id - b.id,
  );
  return (
    <>
      <h3>{t('report.training')}</h3>
      <div className="table-wrap">
        <table className="training">
          <thead>
            <tr>
              <th scope="col">{t('report.training.name')}</th>
              <th scope="col">{t('style.oshi')}</th>
              <th scope="col">{t('style.yotsu')}</th>
              <th scope="col">{t('style.waza')}</th>
              <th scope="col">{t('report.training.weight')}</th>
              <th scope="col">{t('talk.fatigue')}</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((r) => (
              <tr key={r.id}>
                <th scope="row">
                  {nameOf(r.id)}
                  {r.intensity !== 'normal' && (
                    <span className={`tag ${r.intensity === 'hard' ? 'tag--warn' : ''}`}>
                      {t(`intensity.${r.intensity}`)}
                    </span>
                  )}
                  {(r.wall ?? 0) > 0 && (
                    <span className="tag tag--wall">{t('report.training.broke')}</span>
                  )}
                  {r.injured && (
                    <span className="tag tag--warn">{t('report.training.injured')}</span>
                  )}
                </th>
                {([r.oshi, r.yotsu, r.waza] as const).map((v, i) => (
                  <td key={i} className={v > 0.05 ? 'up' : v < -0.05 ? 'down' : ''}>
                    {signedPoints(v)}
                  </td>
                ))}
                <td>{signed(r.weight)}</td>
                <td className={r.fatigue > 0.05 ? 'down' : r.fatigue < -0.05 ? 'up' : ''}>
                  {signed(r.fatigue)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
