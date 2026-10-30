/**
 * ゲームの状態から絵を出す（力士・親方・入門希望者）
 */
import {
  isSekitori,
  type Alumnus,
  type Candidate,
  type Oyakata,
  type Rank,
  type Rikishi,
} from '@ichimon/sim';
import { Figure } from './Figure';
import { oyakataLook, rikishiLook } from './look';

/** 現役の力士の見た目（今の番付・体重・けが・疲れから） */
export function lookOfRikishi(r: Rikishi, rank: Rank | null) {
  return rikishiLook({
    id: r.id,
    weight: r.weight,
    stableId: r.stableId,
    careerBasho: r.career.basho,
    sekitori: rank !== null && isSekitori(rank),
    yokozuna: rank?.title === 'Y',
    injured: r.injury > 0,
    fatigue: r.fatigue,
  });
}

/** 引退した力士の見た目（最高位のころの姿） */
export function lookOfAlumnus(a: Alumnus, stableId: number) {
  const top = a.career.highestRank;
  return rikishiLook({
    id: a.id,
    weight: 140,
    stableId,
    careerBasho: a.career.basho,
    sekitori: top !== null && isSekitori(top),
    yokozuna: top?.title === 'Y',
    injured: false,
    fatigue: 0,
  });
}

export function RikishiPortrait({
  r,
  rank,
  size = 72,
  variant = 'bust',
}: {
  r: Rikishi;
  rank: Rank | null;
  size?: number;
  variant?: 'bust' | 'full';
}) {
  return <Figure look={lookOfRikishi(r, rank)} variant={variant} size={size} />;
}

/** 入門希望者（まだ髷のない、ざんばら頭） */
export function CandidatePortrait({ c, size = 56 }: { c: Candidate; size?: number }) {
  const look = rikishiLook({
    id: c.id,
    weight: c.weight,
    stableId: 0,
    careerBasho: 0,
    sekitori: false,
    yokozuna: false,
    injured: false,
    fatigue: 0,
  });
  return <Figure look={look} variant="bust" size={size} />;
}

export function OyakataPortrait({
  o,
  size = 56,
}: {
  o: Pick<Oyakata, 'id' | 'age' | 'stableId'>;
  size?: number;
}) {
  return <Figure look={oyakataLook(o)} variant="bust" size={size} />;
}
