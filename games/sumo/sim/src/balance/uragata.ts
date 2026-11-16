/**
 * 裏方（行司・呼出・床山）。どれも相撲部屋に所属する協会員で、給料は協会が払う（docs/rikishi-life.md「部屋の人たち」）。
 * 若いうちに部屋に入り、年を重ねて格が上がる。部屋への効き目と志望者の来やすさは推定
 */
export type UragataRole = 'tokoyama' | 'yobidashi' | 'gyoji';
export const URAGATA_ROLES: readonly UragataRole[] = ['tokoyama', 'yobidashi', 'gyoji'];

export const URAGATA = {
  /** その役がいない部屋に、場所ごとに志望者が来る確率（推定） */
  applyChance: 0.15,
  /** 志望者が来るのに要る弟子の数 */
  minDeshi: 3,
  /** 志望者の年齢 */
  age: [15, 19] as const,
  /** 協会員の定年 */
  retireAge: 65,
  /** 床山: 関取の髷を結い、身の回りを整える。関取の疲れの抜け */
  tokoyamaRecovery: 1.5,
  /** 呼出: 稽古場の土俵を整える。けがの確率の倍率 */
  yobidashiInjury: 0.95,
  /** 行司: 部屋の書き物や巡業の手配を手伝う。場所ごとの名声 */
  gyojiPrestige: 0.15,
} as const;
