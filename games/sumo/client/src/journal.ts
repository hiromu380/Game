/**
 * 部屋の日誌の1行を文にする・分類する（文言は i18n から）
 */
import type { JournalEntry } from '@ichimon/sim';
import type { MessageKey, TranslateFn } from './i18n';
import { rankName } from './format';

export type JournalGroup = 'stable' | 'lineage' | 'business';

export function journalGroup(e: JournalEntry): JournalGroup | null {
  switch (e.kind) {
    case 'join':
    case 'promote':
    case 'yusho':
    case 'sansho':
    case 'retire':
      return 'stable';
    case 'open':
    case 'successor':
    case 'independence':
    case 'branchSucceeded':
    case 'branchClosed':
    case 'kakun':
      return 'lineage';
    case 'happening':
    case 'facility':
    case 'diet':
    case 'staffHire':
    case 'staffLeave':
      return 'business';
    case 'kojo':
      return 'stable';
    case 'rival':
      return 'lineage';
    case 'earlier':
      return null;
  }
}

/** 大きな出来事（印を付けて目立たせる） */
export function isMilestone(e: JournalEntry): boolean {
  return (
    (e.kind === 'promote' && (e.to === 'Y' || e.to === 'O')) ||
    (e.kind === 'yusho' && e.division === 'makuuchi') ||
    e.kind === 'kojo' ||
    (e.kind === 'rival' && e.event !== 'new') ||
    e.kind === 'successor' ||
    e.kind === 'independence' ||
    e.kind === 'open'
  );
}

export function journalText(t: TranslateFn, e: JournalEntry): string {
  switch (e.kind) {
    case 'open':
      return t('journal.open', { stable: e.stable, shikona: e.shikona });
    case 'join':
      return t('journal.join', { shikona: e.shikona, age: e.age });
    case 'promote':
      return t(`journal.promote.${e.to}`, { shikona: e.shikona, stable: e.stable });
    case 'yusho':
      return t('journal.yusho', {
        shikona: e.shikona,
        stable: e.stable,
        division: t(`rank.division.${e.division}` as MessageKey),
        wins: e.wins,
      });
    case 'sansho':
      return t('journal.sansho', { shikona: e.shikona, prize: t(`sansho.${e.prize}`) });
    case 'retire': {
      const base = t('journal.retire', {
        shikona: e.shikona,
        age: e.age,
        highest: e.highest ? rankName(t, e.highest) : t('rank.maezumo'),
      });
      if (e.oyakata === null) return base;
      return (
        base +
        (e.oyakata ? t('journal.retire.oyakata', { name: e.oyakata }) : t('journal.retire.stays'))
      );
    }
    case 'happening': {
      const k = `happening.${e.id}.${e.option}`;
      const vars = { name: e.name ?? '' };
      const text = t('journal.happening', {
        title: t(`happening.${e.id}.title` as MessageKey),
        option: t(k as MessageKey, vars),
      });
      if (e.hit === undefined) return text;
      return `${text} ${t(`${k}.${e.hit ? 'hit' : 'miss'}` as MessageKey, vars)}`;
    }
    case 'independence':
      return t('journal.independence', { stable: e.stable, shikona: e.shikona });
    case 'successor':
      return t('journal.successor', {
        generation: e.generation,
        stable: e.stable,
        shikona: e.shikona,
      });
    case 'kakun':
      return t('journal.kakun', { name: t(`kakun.${e.id}.name`) });
    case 'facility':
      return t('journal.facility', { name: t(`facility.${e.id}.name`), level: e.level });
    case 'branchSucceeded':
      return t('journal.branchSucceeded', { stable: e.stable, shikona: e.shikona });
    case 'branchClosed':
      return t('journal.branchClosed', { stable: e.stable });
    case 'rival':
      return t(`journal.rival.${e.event}` as MessageKey, {
        stable: e.stable,
        shikona: e.shikona ?? '',
      });
    case 'kojo':
      return e.dohyoiri
        ? t('journal.kojoDohyoiri', {
            shikona: e.shikona,
            word: t(`kojo.${e.word}` as MessageKey),
            dohyoiri: t(`dohyoiri.${e.dohyoiri}.name` as MessageKey),
          })
        : t('journal.kojo', {
            shikona: e.shikona,
            rank: t(`rank.title.${e.to}` as MessageKey),
            word: t(`kojo.${e.word}` as MessageKey),
          });
    case 'diet':
      return t('journal.diet', { name: t(`diet.${e.diet}.name`) });
    case 'staffHire':
      return t('journal.staffHire', { name: e.name, role: t(`staff.${e.role}.name`) });
    case 'staffLeave':
      return t(e.retired ? 'journal.staffRetire' : 'journal.staffLeave', {
        name: e.name,
        role: t(`staff.${e.role}.name`),
      });
    case 'earlier':
      return t('journal.earlier');
  }
}
