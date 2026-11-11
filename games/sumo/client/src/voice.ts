/**
 * 弟子の一言: 今の様子（けが・疲れ・先場所の成績・地位・個性・稽古の方針）から、話しかけたときの言葉を決める（純粋関数）
 * 同じ場所のあいだは同じ言葉。場所が変わると変わる
 */
import {
  isSekitori,
  traitsOf,
  TRAITS,
  type GameState,
  type Rank,
  type Rikishi,
} from '@ichimon/sim';

/** 一言の種類（文言は i18n の voice.<種類>.<番号>） */
export const VOICE_VARIANTS = {
  injured: 3,
  newcomer: 2,
  tired: 3,
  hard: 2,
  great: 2,
  kachikoshi: 3,
  makekoshi: 3,
  nearSekitori: 2,
  sekitori: 3,
  veteran: 2,
  diligent: 1,
  lazy: 1,
  glutton: 1,
  sensitive: 1,
  oshi: 2,
  yotsu: 2,
  waza: 2,
  body: 2,
  rest: 2,
} as const;
export type VoiceKind = keyof typeof VOICE_VARIANTS;

function pick(kind: VoiceKind, salt: number): string {
  return `voice.${kind}.${salt % VOICE_VARIANTS[kind]}`;
}

/** 話しかけたときの一言（i18n のキー） */
export function voiceOf(
  game: Pick<GameState, 'bashoIndex'>,
  r: Rikishi,
  rank: Rank | null,
): string {
  // 力士と場所で決まるばらつき（乱数を使わない）
  const salt = (Math.imul(r.id, 2654435761) ^ Math.imul(game.bashoIndex + 1, 40503)) >>> 0;
  if (r.injury > 0) return pick('injured', salt);
  if (r.career.basho === 0) return pick('newcomer', salt);
  if (r.fatigue >= 75) return pick('tired', salt);
  if ((r.intensity ?? 'normal') === 'hard' && r.fatigue >= 45) return pick('hard', salt);
  // 話の種を集めて、その中から1つ
  const pool: VoiceKind[] = [];
  const last = r.recent[0];
  if (last) {
    const bouts = last.wins + last.losses + last.absences;
    if (last.yusho || last.wins >= Math.ceil(bouts * 0.8)) pool.push('great', 'great');
    else if (last.wins * 2 > bouts) pool.push('kachikoshi');
    else pool.push('makekoshi', 'makekoshi');
  }
  if (rank && isSekitori(rank)) pool.push('sekitori');
  else if (rank?.division === 'makushita' && rank.number <= 10)
    pool.push('nearSekitori', 'nearSekitori');
  if (r.age >= 32) pool.push('veteran');
  if (r.career.basho >= TRAITS.knownAfterBasho) {
    for (const t of traitsOf(r))
      if (t === 'diligent' || t === 'lazy' || t === 'glutton' || t === 'sensitive') pool.push(t);
  }
  pool.push(r.policy);
  return pick(pool[salt % pool.length]!, salt >>> 8);
}
