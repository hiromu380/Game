/**
 * ボスシフトの表示: 夜は「適用中のルール」、同じ日の朝・昼は「夜シフトの予告」を出す
 */
import type { BossPlanEntry, RunState } from '@chain-factory/sim';
import { useI18n, type TranslateFn } from '../i18n';
import { BOSS_ICONS } from '../assets/manifest';

/** 今表示すべきボス情報（適用中 or 夜シフトの予告）。なければ null */
export function findBossToShow(run: RunState): { entry: BossPlanEntry; isNow: boolean } | null {
  const now = run.config.bossPlan[run.shiftIndex];
  if (now) return { entry: now, isNow: true };
  // 同じ日のうちで次に来るボスシフトを探す
  const perDay = run.config.shiftsPerDay;
  const dayEnd = (Math.floor(run.shiftIndex / perDay) + 1) * perDay;
  for (let i = run.shiftIndex + 1; i < dayEnd; i++) {
    const entry = run.config.bossPlan[i];
    if (entry) return { entry, isNow: false };
  }
  return null;
}

/** ボス修正ルールの説明文（効果量は RunConfig から埋め込む） */
export function describeBoss(t: TranslateFn, run: RunState, entry: BossPlanEntry): string {
  const p = run.config.bossParams;
  const signed = (n: number) => (n > 0 ? `+${n}` : String(n));
  switch (entry.id) {
    case 'lowOil':
      return t('boss.lowOil.desc', { delta: signed(p.lowOilConveyorDelta) });
    case 'repairWork':
      return t('boss.repairWork.desc', { cells: entry.blockedCells.length });
    case 'strictInspection':
      return t('boss.strictInspection.desc', { divisor: p.strictInspectionDivisor });
    case 'shortShift':
      return t('boss.shortShift.desc', { ticks: p.shortShiftTickLimit });
    case 'partShortage':
      return t('boss.partShortage.desc', { delta: signed(p.partShortageOffersDelta) });
  }
}

export function BossNotice({ run }: { run: RunState }) {
  const { t } = useI18n();
  const boss = findBossToShow(run);
  // デイリーの特殊ルール（全シフトにかかる）
  const special = run.config.globalModifier;
  if (!boss && !special) return null;

  return (
    <>
      {special && (
        <div className="boss-notice boss-notice--now">
          <img className="boss-notice__icon" src={BOSS_ICONS[special.id]} alt="" />
          <span className="boss-notice__label">{t('daily.specialRule')}</span>
          <strong>{t(`boss.${special.id}.name`)}</strong>
          <span className="boss-notice__desc">{describeBoss(t, run, special)}</span>
        </div>
      )}
      {boss && (
        <div className={`boss-notice ${boss.isNow ? 'boss-notice--now' : ''}`}>
          <img className="boss-notice__icon" src={BOSS_ICONS[boss.entry.id]} alt="" />
          <span className="boss-notice__label">
            {boss.isNow ? t('boss.now') : t('boss.upcoming')}
          </span>
          <strong>{t(`boss.${boss.entry.id}.name`)}</strong>
          <span className="boss-notice__desc">{describeBoss(t, run, boss.entry)}</span>
        </div>
      )}
    </>
  );
}
