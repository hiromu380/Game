/**
 * 称号: 力士の記録・得意技・型・体つきから決まる呼び名（純粋関数。最大2つ。セーブに持たない）
 * 上にあるものほど先に付く
 */
import { styleOf, tokuiWaza, type Rikishi } from '@ichimon/sim';

export type TitleId =
  | 'yusho'
  | 'kinboshi'
  | 'sansho'
  | 'tokui'
  | 'oshiMaster'
  | 'yotsuMaster'
  | 'wazaMaster'
  | 'ironman'
  | 'veteran'
  | 'rising'
  | 'giant'
  | 'small';

export interface Title {
  id: TitleId;
  /** 文言に入れる値（得意技の決まり手・優勝の回数など） */
  kimarite?: string;
  n?: number;
}

export const TITLE_RULES = {
  /** 金星をこの数から */
  kinboshi: 3,
  /** 三賞の合計をこの数から */
  sansho: 5,
  /** 型の能力がこの値から「◯◯の名手」 */
  master: 75,
  /** 休まずに番付に載った場所数 */
  ironmanBasho: 60,
  /** 関取でこの年齢から */
  veteranAge: 33,
  /** 関取でこの年齢まで */
  risingAge: 21,
  giantKg: 185,
  smallKg: 115,
  max: 2,
} as const;

export function titlesOf(r: Rikishi, sekitori: boolean): Title[] {
  const c = r.career;
  const out: Title[] = [];
  if (c.makuuchiYusho > 0) out.push({ id: 'yusho', n: c.makuuchiYusho });
  if (c.kinboshi >= TITLE_RULES.kinboshi) out.push({ id: 'kinboshi', n: c.kinboshi });
  const sansho = c.sansho.shukun + c.sansho.kanto + c.sansho.gino;
  if (sansho >= TITLE_RULES.sansho) out.push({ id: 'sansho', n: sansho });
  const waza = tokuiWaza(c);
  if (waza && sekitori) out.push({ id: 'tokui', kimarite: waza });
  const style = styleOf(r.abilities);
  // 得意技の称号があれば、型の称号は重ねない（「押し出しの名手」と「押し相撲の名手」は同じことを言う）
  if (!(waza && sekitori) && r.abilities[style] >= TITLE_RULES.master)
    out.push({
      id: style === 'oshi' ? 'oshiMaster' : style === 'yotsu' ? 'yotsuMaster' : 'wazaMaster',
    });
  if (c.basho >= TITLE_RULES.ironmanBasho && c.absences === 0) out.push({ id: 'ironman' });
  if (sekitori && r.age >= TITLE_RULES.veteranAge) out.push({ id: 'veteran' });
  if (sekitori && r.age <= TITLE_RULES.risingAge) out.push({ id: 'rising' });
  if (r.weight >= TITLE_RULES.giantKg) out.push({ id: 'giant' });
  else if (sekitori && r.weight < TITLE_RULES.smallKg) out.push({ id: 'small' });
  return out.slice(0, TITLE_RULES.max);
}
