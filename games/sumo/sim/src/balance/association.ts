/**
 * 協会（親方・年寄名跡・一門）。docs/realism.md「親方（年寄）」「一門」
 */
export const ASSOCIATION = {
  /** 年寄名跡の数（一代年寄を除く） */
  names: 105,
  /** 一門の数（2018年からすべての親方がどれかに属する） */
  ichimon: 5,
  /** ゲーム開始時: 空いている名跡・参与の数（推定） */
  startFreeNames: 3,
  startSanyo: 5,
  /** 定年（65歳）の後、参与として再雇用される確率と、その上限の年齢 */
  sanyoChance: 0.7,
  sanyoUntil: 70,
  /** 架空の部屋の部屋付き親方が独立する確率（1年あたり。条件は自分の部屋と同じ。推定） */
  npcIndependencePerYear: 0.03,
  /** 独立で連れて出る内弟子の数（架空の部屋） */
  npcTakeDisciples: 2,
  /** 部屋の数の上限（これ以上は独立できない。推定） */
  maxStables: 50,
  /** 師匠の年齢の幅（ゲーム開始時の架空の部屋） */
  masterAge: [38, 64] as const,
  heyatsukiAge: [33, 64] as const,
};
