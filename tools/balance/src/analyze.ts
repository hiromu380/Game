/**
 * バランス検証の詳しい分析（pnpm balance が書き出した .json を読む）
 *
 * 使い方: pnpm --filter @chain-factory/balance analyze reports/<日時>.json [...]
 *
 * - 1シフト目で出荷量 0 になったランの原因の内訳
 * - 今日の出来事の選択率と、選んだ日のクリア率
 * - メタ進行の解放条件に1ランで届いた割合（累計の条件は、必要なラン数の目安）
 * - パーツ別の出現・購入率（ショップに並ばなかったパーツは「未出現」と分ける）
 */
import { readFileSync } from 'node:fs';
import { BALANCE, PART_IDS, type MetaCondition } from '@chain-factory/sim';
import type { RunLog } from '@chain-factory/bots';

interface ReportJson {
  meta: Record<string, unknown>;
  logs: Record<string, RunLog[]>;
}

const pct = (n: number, d: number) => (d === 0 ? '-' : `${Math.round((n / d) * 100)}%`);

/** 1シフト目の出荷量 0 の原因 */
function zeroCauses(logs: RunLog[]) {
  const zero = logs.filter((l) => l.shifts[0]?.score === '0');
  const causes = { randomOverestimate: 0, noRoute: 0, other: 0 };
  for (const l of zero) {
    const s = l.shifts[0]!;
    if (BigInt(s.expected) > 0n && s.junkbot) causes.randomOverestimate++;
    else if (BigInt(s.expected) === 0n) causes.noRoute++;
    else causes.other++;
  }
  return { runs: logs.length, zero: zero.length, ...causes };
}

/** 今日の出来事: 候補に出た回数・選んだ回数・選んだ日を最後まで（その日の全シフト）クリアした回数 */
function eventStats(logs: RunLog[]) {
  const perDay = BALANCE.shiftsPerDay;
  const stats: Record<string, { offered: number; chosen: number; dayCleared: number }> = {};
  for (const l of logs) {
    for (let i = 0; i < l.shifts.length; i++) {
      const s = l.shifts[i]!;
      if (i % perDay !== 0 || !s.eventChoices || !s.event) continue;
      for (const c of s.eventChoices)
        (stats[c] ??= { offered: 0, chosen: 0, dayCleared: 0 }).offered++;
      const entry = stats[s.event]!;
      entry.chosen++;
      const day = l.shifts.slice(i, i + perDay);
      if (day.length === perDay && day.every((d) => d.cleared)) entry.dayCleared++;
    }
  }
  return stats;
}

/** メタ進行の解放条件に、1ランで届いた割合 */
function metaReach(logs: RunLog[]) {
  const reached = (l: RunLog, c: MetaCondition): boolean | null => {
    const scores = l.shifts.map((s) => BigInt(s.score));
    switch (c.kind) {
      case 'bestChain':
        return Math.max(0, ...l.shifts.map((s) => s.chainCount)) >= c.value;
      case 'reachShift':
        return l.shifts.length >= c.value;
      case 'bestShiftScore':
        return scores.some((v) => v >= BigInt(c.value));
      case 'totalShipped':
        return scores.reduce((a, b) => a + b, 0n) >= BigInt(c.value);
      case 'clears':
        return c.value <= 1 ? l.cleared : null;
      case 'runsPlayed':
        return null;
    }
  };
  const clearRate = logs.filter((l) => l.cleared).length / Math.max(1, logs.length);
  const row = (label: string, c: MetaCondition) => {
    const values = logs.map((l) => reached(l, c));
    if (values[0] === null) {
      // 累計の条件: 必要なラン数の目安
      const runs =
        c.kind === 'clears' ? (clearRate > 0 ? Math.ceil(c.value / clearRate) : Infinity) : c.value;
      return `| ${label} | ${c.kind} ${c.value} | 累計（目安 ${runs} ラン） |`;
    }
    return `| ${label} | ${c.kind} ${c.value} | ${pct(values.filter(Boolean).length, logs.length)} |`;
  };
  return [
    ...BALANCE.meta.partUnlocks.map((u) => row(u.partId, u.condition)),
    ...BALANCE.meta.boardExpansions.map((c, i) => row(`工場拡張 ${i + 1}`, c)),
  ];
}

function report(file: string) {
  const json = JSON.parse(readFileSync(file, 'utf8')) as ReportJson;
  const lines = [`# ${file}`, '', '```', JSON.stringify(json.meta), '```', ''];
  for (const [bot, logs] of Object.entries(json.logs)) {
    lines.push(`## ${bot}（${logs.length} ラン）`, '');
    const z = zeroCauses(logs);
    lines.push(
      `- 1シフト目の出荷量 0: ${z.zero} ラン（${pct(z.zero, z.runs)}）` +
        ` / ランダム要素の見込み違い ${z.randomOverestimate}・見込みも 0（経路が作れない） ${z.noRoute}・その他 ${z.other}`,
      '',
    );
    const events = eventStats(logs);
    if (Object.keys(events).length > 0) {
      lines.push(
        '| 出来事 | 候補に出た | 選んだ（選択率） | その日を最後までクリア |',
        '|---|---|---|---|',
      );
      for (const [id, e] of Object.entries(events)) {
        lines.push(
          `| ${id} | ${e.offered} | ${e.chosen}（${pct(e.chosen, e.offered)}） | ${pct(e.dayCleared, e.chosen)} |`,
        );
      }
      lines.push('');
    }
    lines.push('| 解放 | 条件 | 1ランで届いた割合 |', '|---|---|---|', ...metaReach(logs), '');
    const offered: Record<string, number> = Object.fromEntries(PART_IDS.map((id) => [id, 0]));
    const bought: Record<string, number> = Object.fromEntries(PART_IDS.map((id) => [id, 0]));
    for (const l of logs) {
      for (const id of PART_IDS) {
        offered[id] = (offered[id] ?? 0) + (l.offered[id] ?? 0);
        bought[id] = (bought[id] ?? 0) + (l.bought[id] ?? 0);
      }
    }
    lines.push(
      '| パーツ | 出現 | 購入率 |',
      '|---|---|---|',
      ...PART_IDS.filter((id) => id !== 'switch').map((id) =>
        offered[id] === 0
          ? `| ${id} | 未出現 | - |`
          : `| ${id} | ${offered[id]} | ${pct(bought[id]!, offered[id]!)} |`,
      ),
      '',
    );
  }
  return lines.join('\n');
}

for (const file of process.argv.slice(2)) console.log(report(file));
