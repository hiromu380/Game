/**
 * 集計と Markdown レポートの作成
 */
import { BALANCE, PART_IDS, type PartId, type ShiftSpec } from '@chain-factory/sim';
import type { BotName } from './bots';
import type { RunLog } from './runner';

export interface BotSummary {
  bot: BotName;
  runs: number;
  /** 全シフトクリア率 */
  clearRate: number;
  /** シフト i に到達した割合と、そのうちクリアした割合 */
  shifts: {
    reached: number;
    cleared: number;
    ratioP10: number;
    ratioP50: number;
    ratioP90: number;
  }[];
  parts: Record<PartId, { offered: number; bought: number; onBoard: number }>;
  /** ボス修正ルール別: 挑戦回数とクリア回数 */
  bosses: Record<string, { attempts: number; cleared: number }>;
  /** 床の利用（全シフトの合計）: 効果のある床のマス・そのうちパーツを置いたマス・床の効果を受けた回数 */
  floor: { cells: number; onFloor: number; applied: number; shifts: number };
  /** クリアできなかったシード（どのシフトで脱落したか） */
  failed: { seed: number; failedShift: number }[];
  avgMs: number;
}

function percentile(values: number[], p: number): number {
  if (values.length === 0) return NaN;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * p))]!;
}

/** スコア ÷ ノルマ（大きな値でも比較できるよう桁数で丸める） */
function ratio(score: string, quota: number): number {
  return Number((BigInt(score) * 1000n) / BigInt(Math.max(1, quota))) / 1000;
}

/** shiftSpecs: シフト表（通常ランは BALANCE.shifts、デイリーは BALANCE.daily.shifts） */
export function summarize(
  bot: BotName,
  logs: RunLog[],
  shiftSpecs: readonly ShiftSpec[] = BALANCE.shifts,
): BotSummary {
  const shiftCount = shiftSpecs.length;
  const shifts = Array.from({ length: shiftCount }, (_, i) => {
    const records = logs.map((l) => l.shifts[i]).filter((s) => s !== undefined);
    const ratios = records.map((s) => ratio(s.score, s.quota));
    return {
      reached: records.length / logs.length,
      cleared: records.filter((s) => s.cleared).length / logs.length,
      ratioP10: percentile(ratios, 0.1),
      ratioP50: percentile(ratios, 0.5),
      ratioP90: percentile(ratios, 0.9),
    };
  });

  const parts = {} as BotSummary['parts'];
  for (const id of PART_IDS) {
    parts[id] = {
      offered: logs.reduce((n, l) => n + (l.offered[id] ?? 0), 0),
      bought: logs.reduce((n, l) => n + (l.bought[id] ?? 0), 0),
      onBoard: logs.reduce((n, l) => n + (l.onBoard[id] ?? 0), 0),
    };
  }

  const bosses: BotSummary['bosses'] = {};
  for (const log of logs) {
    for (const shift of log.shifts) {
      if (!shift.boss) continue;
      const entry = (bosses[shift.boss] ??= { attempts: 0, cleared: 0 });
      entry.attempts++;
      if (shift.cleared) entry.cleared++;
    }
  }

  const allShifts = logs.flatMap((l) => l.shifts);
  const floor = {
    cells: allShifts.reduce((n, s) => n + (s.floorCells ?? 0), 0),
    onFloor: allShifts.reduce((n, s) => n + (s.partsOnFloor ?? 0), 0),
    applied: allShifts.reduce((n, s) => n + (s.floorApplied ?? 0), 0),
    shifts: allShifts.length,
  };

  return {
    bot,
    runs: logs.length,
    bosses,
    floor,
    clearRate: logs.filter((l) => l.cleared).length / logs.length,
    shifts,
    parts,
    failed: logs
      .filter((l) => !l.cleared)
      .map((l) => ({ seed: l.seed, failedShift: l.shifts.length - 1 })),
    avgMs: logs.reduce((n, l) => n + l.ms, 0) / logs.length,
  };
}

const pct = (x: number) => (Number.isNaN(x) ? '-' : `${(x * 100).toFixed(0)}%`);
const num = (x: number) => (Number.isNaN(x) ? '-' : x >= 100 ? x.toFixed(0) : x.toFixed(2));

export function toMarkdown(
  summaries: BotSummary[],
  meta: Record<string, string | number>,
  shiftSpecs: readonly ShiftSpec[] = BALANCE.shifts,
): string {
  const lines: string[] = [];
  lines.push('# バランス検証レポート', '');
  lines.push(
    Object.entries(meta)
      .map(([k, v]) => `- ${k}: ${v}`)
      .join('\n'),
    '',
  );

  lines.push('## ボット別の全シフトクリア率', '');
  lines.push('| ボット | ラン数 | クリア率 | 平均時間/ラン |', '|---|---|---|---|');
  for (const s of summaries) {
    lines.push(`| ${s.bot} | ${s.runs} | ${pct(s.clearRate)} | ${(s.avgMs / 1000).toFixed(2)}s |`);
  }
  lines.push('');

  lines.push('## シフト別（到達率 / クリア率 / スコア÷ノルマ p10・p50・p90）', '');
  const header = ['シフト', 'ノルマ', ...summaries.map((s) => s.bot)];
  lines.push(`| ${header.join(' | ')} |`, `|${header.map(() => '---').join('|')}|`);
  shiftSpecs.forEach((shift, i) => {
    const cells = summaries.map((s) => {
      const r = s.shifts[i]!;
      return `${pct(r.reached)} / ${pct(r.cleared)} / ${num(r.ratioP10)}・${num(r.ratioP50)}・${num(r.ratioP90)}`;
    });
    lines.push(
      `| ${i + 1}${shift.kind === 'boss' ? '（夜）' : ''} | ${shift.quota} | ${cells.join(' | ')} |`,
    );
  });
  lines.push('');

  lines.push('## ボス修正ルール別のクリア率（挑戦回数）', '');
  const bossIds = [...new Set(summaries.flatMap((s) => Object.keys(s.bosses)))].sort();
  lines.push(
    `| ルール | ${summaries.map((s) => s.bot).join(' | ')} |`,
    `|---|${summaries.map(() => '---').join('|')}|`,
  );
  for (const id of bossIds) {
    const cells = summaries.map((s) => {
      const b = s.bosses[id];
      return b ? `${pct(b.cleared / b.attempts)}（${b.attempts}）` : '-';
    });
    lines.push(`| ${id} | ${cells.join(' | ')} |`);
  }
  lines.push('');

  lines.push(
    '## 床の利用（床の上に置いた割合 = パーツを置いた床 ÷ 効果のある床、床の効果 = 1シフトあたり床の効果を受けた回数）',
    '',
  );
  lines.push('| ボット | 床の上に置いた割合 | 床の効果/シフト |', '|---|---|---|');
  for (const s of summaries) {
    const f = s.floor;
    lines.push(
      `| ${s.bot} | ${f.cells ? pct(f.onFloor / f.cells) : '-'} | ${f.shifts ? num(f.applied / f.shifts) : '-'} |`,
    );
  }
  lines.push('');

  lines.push('## パーツ別（購入率 = 購入 ÷ 出現、盤面 = 本番時に盤面にあった延べ数 ÷ ラン数）', '');
  const partHeader = ['パーツ', ...summaries.flatMap((s) => [`${s.bot} 購入率`, `${s.bot} 盤面`])];
  lines.push(`| ${partHeader.join(' | ')} |`, `|${partHeader.map(() => '---').join('|')}|`);
  for (const id of PART_IDS) {
    if (id === 'switch') continue;
    const cells = summaries.flatMap((s) => {
      const p = s.parts[id];
      return [p.offered ? pct(p.bought / p.offered) : '-', num(p.onBoard / s.runs)];
    });
    lines.push(`| ${id} | ${cells.join(' | ')} |`);
  }
  lines.push('');

  const strongest = summaries.at(-1);
  if (strongest) {
    lines.push(`## ${strongest.bot} ボットでもクリアできなかったシード（再現用）`, '');
    if (strongest.failed.length === 0) lines.push('なし');
    for (const f of strongest.failed.slice(0, 50)) {
      lines.push(`- seed ${f.seed}: シフト ${f.failedShift + 1} で脱落（\`?seed=${f.seed}\`）`);
    }
    lines.push('');
  }
  return lines.join('\n');
}
