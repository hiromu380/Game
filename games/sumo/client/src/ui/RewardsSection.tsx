import { useI18n, type MessageKey } from '../i18n';
import { money } from '../format';
import type { RewardLine } from '../rewards';
import { HONMEI } from '@ichimon/sim';
import { Icon } from '../art/Icon';

/** 部屋への影響の行のアイコン */
function iconOf(x: RewardLine): string {
  switch (x.kind) {
    case 'prestige':
      return 'ui_rosette';
    case 'patrons':
      return x.tone === 'good' ? 'ui_heart' : 'ui_heart_broken';
    case 'patronJoin':
      return 'ui_letter';
    case 'patronLeave':
      return 'ui_heart_broken';
    case 'sekitoriUp':
      return 'ui_arrow_up';
    case 'sekitoriDown':
      return 'ui_arrow_down';
    case 'injury':
      return 'ui_bandage';
    case 'henka':
      return 'ui_hand';
    case 'vsOutlook':
      return 'ui_coins';
    case 'pledge':
      return x.kept ? 'ui_taru' : 'ui_coin_bag';
    case 'honmei':
      return 'ui_trophy';
    case 'kimarite':
      return 'ui_gunbai';
  }
}

/** 場所の結果の「部屋への影響」: 成績が経営に返ってきたものを、原因つきで1行ずつ */
export function RewardsSection({ lines }: { lines: RewardLine[] }) {
  const { t, lang } = useI18n();
  const yen = (n: number) => (n >= 0 ? '+' : '−') + money(t, Math.abs(n), lang);
  const signed = (n: number) => (n > 0 ? `+${n}` : `${n}`.replace('-', '−'));
  /** 1行: 何が（ラベル）と、どれだけ（札） */
  const parts = (x: RewardLine): [string, string] => {
    switch (x.kind) {
      case 'prestige':
        return [t('rewards.label.prestige'), signed(x.delta)];
      case 'patrons':
        return [
          t(x.cause ? `rewards.label.patrons.${x.cause.result}` : 'rewards.label.patrons.cold', {
            name: x.cause?.name ?? '',
            count: x.count,
          } as Record<string, string | number>),
          signed(x.delta),
        ];
      case 'patronJoin':
      case 'patronLeave':
        return [
          t(`patron.kind.${x.patron.kind}` as MessageKey, { surname: x.patron.surname }),
          t(`rewards.chip.${x.kind}`),
        ];
      case 'sekitoriUp':
      case 'sekitoriDown':
        return [
          t(`rewards.label.${x.kind}`, { name: x.name }),
          t('rewards.chip.perBasho', { yen: yen(x.perBasho) }),
        ];
      case 'injury':
        return [
          t('rewards.label.injury', { name: x.name }),
          t('rewards.chip.injury', { basho: x.basho }),
        ];
      case 'henka':
        return [t('rewards.label.henka', { name: x.name }), t('rewards.chip.henka')];
      case 'pledge':
        return [
          t('rewards.label.pledge', { pledge: t(`pledge.${x.pledge}.short` as MessageKey) }),
          t(x.kept ? 'rewards.chip.pledgeKept' : 'rewards.chip.pledgeBroken'),
        ];
      case 'vsOutlook':
        return [t('rewards.label.vsOutlook'), yen(x.delta)];
      case 'kimarite':
        return [
          t('rewards.label.kimarite', {
            kimarite: t(`kimarite.${x.kimarite}` as MessageKey),
            name: x.name,
          }),
          t('rewards.chip.kimarite'),
        ];
      case 'honmei':
        return [
          t('rewards.label.honmei', { name: x.name }),
          t('rewards.chip.honmei', { n: HONMEI.prestige }),
        ];
    }
  };
  return (
    <>
      <h3>{t('rewards.title')}</h3>
      {lines.length === 0 ? (
        <p className="rewards__none">{t('rewards.none')}</p>
      ) : (
        <ul className="rewards">
          {lines.map((x, i) => (
            <li key={i} className={`rewards__line is-${x.tone}`}>
              <span className="rewards__mark" aria-hidden="true">
                {x.tone === 'good' ? '▲' : '▼'}
              </span>
              <Icon id={iconOf(x)} />
              <span className="visually-hidden">
                {t(x.tone === 'good' ? 'rewards.good' : 'rewards.bad')}
              </span>
              <span className="rewards__label">{parts(x)[0]}</span>
              <span className={`rewards__chip is-${x.tone}`}>{parts(x)[1]}</span>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
