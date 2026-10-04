/**
 * ボスシフトの表示: 夜は「適用中のルール」、同じ日の朝・昼は「夜シフトの予告」を出す
 */
import type { BossModifierId, BossPlanEntry, PartId, RunState } from '@chain-factory/sim';
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

/** ルールが効くパーツ（1種類だけに効くルール）。手持ち・盤面・ショップのどこにもなければ、今は関係ないと出す */
const BOSS_TARGET: Partial<Record<BossModifierId, PartId>> = { lowOil: 'conveyor' };

/** ルールの対象のパーツが手元（手持ち・盤面・ショップ）にあるか */
export function hasBossTarget(run: RunState, id: BossModifierId): boolean {
  const target = BOSS_TARGET[id];
  if (!target) return true;
  return (
    (run.inventory[target] ?? 0) > 0 ||
    run.board.cells.some((c) => c?.id === target) ||
    run.shop.some((o) => o.partId === target && !o.sold)
  );
}

function TargetNote({ run, id }: { run: RunState; id: BossModifierId }) {
  const { t } = useI18n();
  const target = BOSS_TARGET[id];
  if (!target || hasBossTarget(run, id)) return null;
  return (
    <span className="boss-notice__target">
      {t('rule.noTarget', { part: t(`part.${target}.name`) })}
    </span>
  );
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
          <span className="boss-notice__period">{t('rule.period.allShifts')}</span>
          <strong>
            {t(`boss.${special.id}.sender`)} / {t(`boss.${special.id}.name`)}
          </strong>
          <span className="boss-notice__story">{t(`boss.${special.id}.story`)}</span>
          <span className="boss-notice__desc">{describeBoss(t, run, special)}</span>
          <TargetNote run={run} id={special.id} />
        </div>
      )}
      {boss && (
        <div className={`boss-notice ${boss.isNow ? 'boss-notice--now' : ''}`}>
          <img className="boss-notice__icon" src={BOSS_ICONS[boss.entry.id]} alt="" />
          <span className="boss-notice__label">
            {boss.isNow ? t('boss.now') : t('boss.upcoming')}
          </span>
          <span className="boss-notice__period">
            {t(boss.isNow ? 'rule.period.thisShift' : 'rule.period.tonight')}
          </span>
          <strong>
            {t(`boss.${boss.entry.id}.sender`)} / {t(`boss.${boss.entry.id}.name`)}
          </strong>
          <span className="boss-notice__story">{t(`boss.${boss.entry.id}.story`)}</span>
          <span className="boss-notice__desc">{describeBoss(t, run, boss.entry)}</span>
          <TargetNote run={run} id={boss.entry.id} />
        </div>
      )}
    </>
  );
}
