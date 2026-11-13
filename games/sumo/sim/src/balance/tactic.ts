/**
 * 大一番の作戦（すべて推定。docs/balance-log.md）
 * 勝ち越しをかけた最後の一番（7勝7敗・3勝3敗）だけ、親方が立ち合いの作戦を授けられる。
 * 作戦ごとに効く相手の型がある（型の三すくみと同じ向き: 当たる → 技・差す → 押し・変化 → 四つ）。自分の型に合わない作戦は少し不利。
 * 変化はまわしを取りに頭から来る四つ相撲によく効くが、読まれると大きく不利で、決まっても名声が下がり、タニマチが渋い顔をする
 */
import type { Style } from '../model/types';

const fit = (counters: Style, fits: Style) => ({ counters, fits });

export const TACTIC = {
  /** 作戦ごとの、効く相手の型と、合う自分の型 */
  atari: fit('waza', 'oshi'),
  sashi: fit('oshi', 'yotsu'),
  henka: fit('yotsu', 'waza'),
  /** 当たる・差すが相手の型に効いたときの、強さの足し */
  counterEdge: 4,
  /** 自分の型に合わない作戦の減点 */
  offStyle: 2,
  /** 変化: 効いたときの足し・読まれたとき（四つ以外の相手）の減点・決まったときの名声とタニマチの関係の減り */
  henkaEdge: 7,
  henkaMiss: 5,
  henkaPrestige: 1,
  henkaFavor: 3,
  /** 変化で勝ったときの決まり手 */
  henkaKimarite: 'hatakikomi',
} as const;

/** 作戦の並び（画面の順） */
export const TACTICS = ['atari', 'sashi', 'henka'] as const;
