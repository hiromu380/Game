/**
 * 昇進伝達式（大関・横綱）。協会の使者に口上で答える。近年は口上に四字熟語を入れることが多い（docs/realism.md「昇進伝達式」）
 */

/** 口上でよく使われる四字熟語（ゲームではここから3つを候補に出す） */
export const KOJO_WORDS = [
  'fudoFukutsu',
  'fushakuShinmyo',
  'kenninFubatsu',
  'ichiiSenshin',
  'seishinIttou',
  'shiseiIkkan',
  'yuuouMaishin',
  'zenshinZenrei',
] as const;

export type KojoWord = (typeof KOJO_WORDS)[number];

/** 横綱の土俵入りの型 */
export const DOHYOIRI = ['unryu', 'shiranui'] as const;
export type Dohyoiri = (typeof DOHYOIRI)[number];
