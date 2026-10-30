/**
 * ゲームの状態から絵を出す（力士・親方・入門希望者）。
 * 3D肖像は一枚の静止画にしてキャッシュし、画面外は描画しない。
 */
import { isSekitori, type Candidate, type Oyakata, type Rank, type Rikishi } from '@ichimon/sim';
import { ThreePortrait } from './ThreePortrait';
import { oyakataLook, rikishiLook } from './look';

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
  const look = rikishiLook({
    id: r.id,
    weight: r.weight,
    stableId: r.stableId,
    careerBasho: r.career.basho,
    sekitori: rank !== null && isSekitori(rank),
    yokozuna: rank?.title === 'Y',
    injured: r.injury > 0,
    fatigue: r.fatigue,
  });
  return <ThreePortrait look={look} variant={variant} size={size} />;
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
  return <ThreePortrait look={look} variant="bust" size={size} />;
}

export function OyakataPortrait({
  o,
  size = 56,
}: {
  o: Pick<Oyakata, 'id' | 'age' | 'stableId'>;
  size?: number;
}) {
  return <ThreePortrait look={oyakataLook(o)} variant="bust" size={size} />;
}
